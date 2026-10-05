import { Resend } from "resend";
import { providerSignal } from "@/lib/provider-deadline";
import { BRAND } from "@/lib/brand";

/**
 * EMAIL PROVIDER ABSTRACTION — Resend Integration & Domain Verification
 *
 * Doctrine: Email is a delivery channel for business events, NOT the source of truth.
 * In-app notifications and audit logs remain the immutable business records.
 *
 * Domain Rule: Resend requires a verified sending domain. If no verified domain exists,
 * the email provider reports CONFIGURATION_REQUIRED and does NOT pretend mail was sent.
 */

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
}

export interface EmailResult {
  sent: boolean;
  status: "DELIVERED" | "QUEUED" | "CONFIGURATION_REQUIRED" | "FAILED";
  id?: string;
  error?: string;
}

export interface EmailProbeResult {
  status: "CONNECTED" | "NOT_CONFIGURED" | "DEGRADED" | "CONFIGURATION_REQUIRED";
  verifiedDomain?: string;
  fromEmail?: string;
  latencyMs: number | null;
  error?: string;
}

function configuredSender(): { address: string; domain: string; domainId: string } | null {
  const address = process.env.RESEND_FROM_EMAIL?.trim();
  const domainId = process.env.RESEND_SENDING_DOMAIN_ID?.trim();
  if (!address || address.length > 254 || !domainId) return null;
  const match = address.match(/^[^\s@<>]+@([a-z0-9.-]+)$/i);
  return match ? { address, domain: match[1].toLowerCase(), domainId } : null;
}

class DeadlineResend extends Resend {
  constructor(key: string, private readonly parentSignal?: AbortSignal) { super(key); }
  override fetchRequest<T>(path: string, options: RequestInit = {}) {
    const signal = this.parentSignal && options.signal ? AbortSignal.any([this.parentSignal, options.signal]) : this.parentSignal ?? options.signal ?? undefined;
    return super.fetchRequest<T>(path, { ...options, signal: providerSignal(signal, path.startsWith("/domains/") ? 4000 : 12000) });
  }
}

function getResendKey(): string | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || typeof key !== "string") return null;
  const trimmed = key.trim();
  if (trimmed.length < 10) return null;
  return trimmed;
}

export class EmailProvider {
  private apiKey: string | null;
  private client: Resend | null = null;
  private probeCache?: { key: string; result: EmailProbeResult; expiresAt: number };
  private probeInFlight?: { key: string; promise: Promise<EmailProbeResult> };

  constructor(apiKey = getResendKey(), client?: Resend) {
    this.apiKey = apiKey;
    if (this.apiKey) {
      this.client = client ?? new DeadlineResend(this.apiKey);
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.client);
  }

  private scopedClient(signal?: AbortSignal): Resend {
    // A client per operation carries its own signal; concurrent sends never
    // share mutable cancellation state. Injected test clients remain supported.
    return signal && this.client instanceof DeadlineResend ? new DeadlineResend(this.apiKey!, signal) : this.client!;
  }

  /**
   * Probe API key and check sending domain verification status.
   */
  public async probe(signal?: AbortSignal): Promise<EmailProbeResult> {
    if (!this.apiKey || !this.client) {
      return { status: "NOT_CONFIGURED", latencyMs: null };
    }

    const sender = configuredSender();
    if (!sender) {
      return {
        status: "CONFIGURATION_REQUIRED",
        latencyMs: null,
        error: "RESEND_FROM_EMAIL and RESEND_SENDING_DOMAIN_ID must identify a verified sender.",
      };
    }

    const key = JSON.stringify([sender.address, sender.domainId]);
    if (this.probeCache?.key === key && this.probeCache.expiresAt > Date.now()) {
      return this.probeCache.result;
    }
    if (this.probeInFlight?.key === key) return this.probeInFlight.promise;

    const promise = this.probeSender(sender, signal).then((result) => {
      this.probeCache = {
        key,
        result,
        expiresAt: Date.now() + (result.status === "CONNECTED" ? 60_000 : 15_000),
      };
      return result;
    }).finally(() => {
      if (this.probeInFlight?.promise === promise) this.probeInFlight = undefined;
    });
    this.probeInFlight = { key, promise };
    return promise;
  }

  private async probeSender(sender: { address: string; domain: string; domainId: string }, signal?: AbortSignal): Promise<EmailProbeResult> {
    const t0 = Date.now();
    try {
      const response = await this.scopedClient(signal).domains.get(sender.domainId);

      if (response.error) {
        return {
          status: "DEGRADED",
          latencyMs: Date.now() - t0,
          error: "EMAIL_PROBE_FAILED",
        };
      }

      const domain = response.data;

      if (
        !domain ||
        domain.name.toLowerCase() !== sender.domain ||
        domain.status !== "verified" ||
        domain.capabilities.sending !== "enabled"
      ) {
        return {
          status: "CONFIGURATION_REQUIRED",
          latencyMs: Date.now() - t0,
          error: "The configured sender must match a verified domain with sending enabled.",
        };
      }

      return {
        status: "CONNECTED",
        verifiedDomain: domain.name,
        fromEmail: sender.address,
        latencyMs: Date.now() - t0,
      };
    } catch {
      return {
        status: "DEGRADED",
        latencyMs: Date.now() - t0,
        error: "EMAIL_PROBE_FAILED",
      };
    }
  }

  /**
   * Send transactional email using verified domain via Resend SDK.
   */
  public async sendEmail(params: EmailParams, signal?: AbortSignal): Promise<EmailResult> {
    if (!this.apiKey || !this.client) {
      return {
        sent: false,
        status: "CONFIGURATION_REQUIRED",
        error: "RESEND_API_KEY is missing",
      };
    }

    const health = await this.probe(signal);
    if (health.status !== "CONNECTED" || !health.fromEmail) {
      return {
        sent: false,
        status: health.status === "DEGRADED" ? "FAILED" : "CONFIGURATION_REQUIRED",
        error: "Resend requires a verified configured sender before sending mail.",
      };
    }

    try {
      signal?.throwIfAborted();
      const response = await this.scopedClient(signal).emails.send({
        from: `${BRAND.nameEn} <${health.fromEmail}>`,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }, params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined);

      if (response.error || !response.data?.id) {
        this.probeCache = undefined;
        return {
          sent: false,
          status: "FAILED",
          error: "EMAIL_SEND_FAILED",
        };
      }

      return {
        sent: true,
        // Resend accepted the message for delivery. Mailbox delivery is only
        // proven later by a signed email.delivered webhook event.
        status: "QUEUED",
        id: response.data?.id,
      };
    } catch {
      this.probeCache = undefined;
      return {
        sent: false,
        status: "FAILED",
        error: "EMAIL_SEND_FAILED",
      };
    }
  }
}

export const emailProvider = new EmailProvider();
