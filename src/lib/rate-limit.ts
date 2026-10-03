/**
 * RATE LIMITING & AI COST GOVERNANCE UTILITY
 *
 * Implements an in-memory token bucket for low-cost abuse resistance.
 * IMPORTANT: this is process-local. It reduces accidental/low-effort abuse but
 * is not a distributed hard cap across multiple serverless instances.
 */

export interface RateLimitCheck {
  allowed: boolean;
  currentRequests: number;
  maxRequests: number;
  resetSeconds: number;
}

export class MemoryRateLimiter {
  private requestCounts: Map<string, { count: number; resetAt: number }> = new Map();

  /** Check a limit for a caller key (IP, account id, tool key, etc.). */
  public checkRateLimit(
    key: string,
    maxRequests = 30,
    windowSeconds = 60,
  ): RateLimitCheck {
    const now = Date.now();
    const existing = this.requestCounts.get(key);

    if (!existing || existing.resetAt < now) {
      const resetAt = now + windowSeconds * 1000;
      this.requestCounts.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        currentRequests: 1,
        maxRequests,
        resetSeconds: windowSeconds,
      };
    }

    if (existing.count >= maxRequests) {
      const resetSeconds = Math.ceil((existing.resetAt - now) / 1000);
      return {
        allowed: false,
        currentRequests: existing.count,
        maxRequests,
        resetSeconds,
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      currentRequests: existing.count,
      maxRequests,
      resetSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
}

/**
 * Best-effort caller IP as supplied by the hosting proxy. Never use this value
 * as an authorization primitive; it is only a throttle key.
 */
export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export const rateLimiter = new MemoryRateLimiter();
