import { CapabilityError, type CapabilityAdapter, type CapabilityActor, type CapabilityDefinition, type CapabilityId, type CapabilityObservation, type CapabilityState, type CapabilityStatus, type FailureCode } from "./contracts";

interface Health { status: CapabilityStatus; checkedAt: number; latencyMs: number | null; lastSuccessAt: number | null; failures: number; openUntil: number; code: FailureCode | null }

export class CapabilityRuntime {
  private readonly adapters = new Map<CapabilityId, CapabilityAdapter>();
  private readonly health = new Map<CapabilityId, Health>();
  private readonly probes = new Map<CapabilityId, Promise<CapabilityState>>();
  constructor(private readonly catalog: readonly CapabilityDefinition[], private readonly observe: (event: CapabilityObservation) => void = () => {}, private readonly now = Date.now) {}

  register(id: CapabilityId, adapter: CapabilityAdapter) {
    const spec = this.definition(id);
    if (!spec.implemented || this.adapters.has(id)) throw new Error("INVALID_CAPABILITY_REGISTRATION");
    this.adapters.set(id, adapter);
  }

  private definition(id: CapabilityId) {
    const definition = this.catalog.find((item) => item.id === id);
    if (!definition) throw new CapabilityError("UNKNOWN_OPERATION");
    return definition;
  }

  private snapshot(id: CapabilityId): CapabilityState {
    const spec = this.definition(id), adapter = this.adapters.get(id), health = this.health.get(id);
    const status = !spec.implemented || !adapter ? "PLANNED" : adapter.enabled?.() === false ? "GATED" : !adapter.configured() ? "NOT_CONFIGURED" : health?.status ?? "DEGRADED";
    return { ...spec, provider: adapter?.provider ?? null, status, ready: status === "READY", checkedAt: health ? new Date(health.checkedAt).toISOString() : null, latencyMs: health?.latencyMs ?? null, lastSuccessAt: health?.lastSuccessAt != null ? new Date(health.lastSuccessAt).toISOString() : null, failureCode: status === "READY" ? null : ["PLANNED", "GATED", "NOT_CONFIGURED"].includes(status) ? status as FailureCode : health?.code ?? "PROVIDER_UNAVAILABLE", consecutiveFailures: health?.failures ?? 0, circuit: health?.openUntil ? health.openUntil > this.now() ? "open" : "half_open" : "closed", observationScope: "current_runtime" };
  }

  private record(id: CapabilityId, status: CapabilityStatus, latencyMs: number, code: FailureCode | null) {
    const before = this.health.get(id), spec = this.definition(id);
    const failures = status === "DEGRADED" ? (before?.failures ?? 0) + 1 : 0;
    this.health.set(id, { status, checkedAt: this.now(), latencyMs, lastSuccessAt: status === "READY" ? this.now() : before?.lastSuccessAt ?? null, failures, openUntil: failures >= spec.policy.failureThreshold ? this.now() + spec.policy.cooldownMs : 0, code });
  }

  private emit(event: CapabilityObservation) { try { this.observe(event); } catch { /* instrumentation cannot break business actions */ } }

  private async bounded<T>(operation: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { reject(new CapabilityError("TIMEOUT")); controller.abort(); }, ms); });
    try { return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), deadline]); }
    finally { clearTimeout(timer!); }
  }

  async probe(id: CapabilityId, force = false): Promise<CapabilityState> {
    const state = this.snapshot(id);
    const adapter = this.adapters.get(id);
    if (!this.definition(id).implemented || !adapter || adapter.enabled?.() === false || !adapter.configured()) return state;
    const existing = this.probes.get(id);
    if (existing) return existing;
    const before = this.health.get(id), spec = this.definition(id);
    if (before?.openUntil && before.openUntil > this.now()) return { ...state, status: "DEGRADED", ready: false, failureCode: "CIRCUIT_OPEN" };
    if (!force && before && this.now() - before.checkedAt < spec.policy.cacheMs) return state;
    const pending = (async () => {
      const start = this.now();
      let status: CapabilityStatus = "DEGRADED", code: FailureCode | null = "PROVIDER_UNAVAILABLE";
      try {
        const result = await this.bounded((signal) => this.adapters.get(id)!.probe(signal), spec.policy.probeTimeoutMs);
        status = result.status;
        code = status === "READY" ? null : status === "DEGRADED" ? "PROVIDER_UNAVAILABLE" : status;
      } catch (error) { code = error instanceof CapabilityError ? error.code : "PROVIDER_UNAVAILABLE"; }
      this.record(id, status, this.now() - start, code);
      this.emit({ capability: id, operation: "probe", outcome: status === "READY" ? "success" : "failure", code, durationMs: this.now() - start });
      return this.snapshot(id);
    })().finally(() => { this.probes.delete(id); });
    this.probes.set(id, pending);
    return pending;
  }

  async all(force = false): Promise<CapabilityState[]> { return Promise.all(this.catalog.map((spec) => this.probe(spec.id, force))); }

  recordFallback(id: CapabilityId) {
    const state = this.snapshot(id);
    this.emit({ capability: id, operation: "call", outcome: "fallback", code: state.failureCode, durationMs: 0 });
  }

  // Invoked only by owned server gateways after the route/domain/Agent Policy
  // has authorized its operation. This registry never grants new user rights.
  async call<T>(id: CapabilityId, actor: CapabilityActor, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const spec = this.definition(id);
    if (!spec.actors.includes(actor)) throw new CapabilityError("FORBIDDEN");
    const state = this.snapshot(id);
    if (["PLANNED", "GATED", "NOT_CONFIGURED"].includes(state.status)) throw new CapabilityError(state.status as FailureCode);
    if (state.circuit === "open") throw new CapabilityError("CIRCUIT_OPEN");
    const start = this.now();
    // Never retry sends/writes; paid reads also opt out in the catalog.
    const attempts = spec.readOnly ? Math.min(spec.policy.retries + 1, 2) : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const result = await this.bounded(operation, spec.policy.callTimeoutMs);
        this.record(id, "READY", this.now() - start, null);
        this.emit({ capability: id, operation: "call", outcome: "success", code: null, durationMs: this.now() - start });
        return result;
      } catch (error) {
        const code = error instanceof CapabilityError ? error.code : "PROVIDER_UNAVAILABLE";
        if (attempt + 1 === attempts || code === "TIMEOUT") {
          this.record(id, ["NOT_CONFIGURED", "CONFIGURATION_REQUIRED", "GATED", "PLANNED"].includes(code) ? code as CapabilityStatus : "DEGRADED", this.now() - start, code);
          this.emit({ capability: id, operation: "call", outcome: "failure", code, durationMs: this.now() - start });
          throw new CapabilityError(code);
        }
      }
    }
    throw new CapabilityError("PROVIDER_UNAVAILABLE");
  }
}
