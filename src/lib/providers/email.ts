import { Resend } from "resend";

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

  constructor() {
    this.apiKey = getResendKey();
    if (this.apiKey) {
      this.client = new Resend(this.apiKey);
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.client);
  }

  /**
   * Probe API key and check sending domain verification status.
   */
  public async probe(): Promise<{
    status: "CONNECTED" | "NOT_CONFIGURED" | "DEGRADED" | "CONFIGURATION_REQUIRED";
    verifiedDomain?: string;
    latencyMs: number | null;
    error?: string;
  }> {
    if (!this.apiKey || !this.client) {
      return { status: "NOT_CONFIGURED", latencyMs: null };
    }

    const t0 = Date.now();
    try {
      const response = await this.client.domains.list();

      if (response.error) {
        return {
          status: "DEGRADED",
          latencyMs: Date.now() - t0,
          error: response.error.message || "Resend API returned error",
        };
      }

      const domains = response.data?.data || [];
      const verified = domains.find((d: any) => d.status === "verified");

      if (!verified) {
        return {
          status: "CONFIGURATION_REQUIRED",
          latencyMs: Date.now() - t0,
          error: "No verified sending domain configured in Resend.",
        };
      }

      return {
        status: "CONNECTED",
        verifiedDomain: verified.name,
        latencyMs: Date.now() - t0,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      return {
        status: "DEGRADED",
        latencyMs: Date.now() - t0,
        error: msg,
      };
    }
  }

  /**
   * Send transactional email using verified domain via Resend SDK.
   */
  public async sendEmail(params: EmailParams): Promise<EmailResult> {
    if (!this.apiKey || !this.client) {
      return {
        sent: false,
        status: "CONFIGURATION_REQUIRED",
        error: "RESEND_API_KEY is missing",
      };
    }

    const health = await this.probe();
    if (health.status === "CONFIGURATION_REQUIRED" || !health.verifiedDomain) {
      return {
        sent: false,
        status: "CONFIGURATION_REQUIRED",
        error: "Resend requires a verified sending domain before sending mail.",
      };
    }

    try {
      const response = await this.client.emails.send({
        from: `THE JOURNEY <notifications@${health.verifiedDomain}>`,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        headers: params.idempotencyKey ? { "X-Entity-Ref-ID": params.idempotencyKey } : undefined,
      });

      if (response.error) {
        return {
          sent: false,
          status: "FAILED",
          error: response.error.message,
        };
      }

      return {
        sent: true,
        status: "DELIVERED",
        id: response.data?.id,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send email";
      return {
        sent: false,
        status: "FAILED",
        error: msg,
      };
    }
  }
}

export const emailProvider = new EmailProvider();
