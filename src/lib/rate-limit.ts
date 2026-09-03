/**
 * RATE LIMITING & AI COST GOVERNANCE UTILITY
 *
 * Implements in-memory token bucket rate limiting for public endpoints and AI/Tavily cost controls.
 */

export interface RateLimitCheck {
  allowed: boolean;
  currentRequests: number;
  maxRequests: number;
  resetSeconds: number;
}

class MemoryRateLimiter {
  private requestCounts: Map<string, { count: number; resetAt: number }> = new Map();

  /**
   * Check rate limit for a given key (e.g. IP, Account ID, or Tool Key).
   */
  public checkRateLimit(
    key: string,
    maxRequests = 30, // 30 requests per minute default
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

export const rateLimiter = new MemoryRateLimiter();
