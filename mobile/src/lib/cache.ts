/**
 * Stale-while-revalidate cache for a flaky-connectivity context (airport,
 * metro, rural Umrah groups). The store is injected so the logic is unit
 * testable without React Native — the device path uses AsyncStorage.
 */

export interface KvStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type CacheState = "fresh" | "stale";

export interface CacheEntry<T> {
  key: string;
  value: T;
  fetchedAt: number;
  state: CacheState;
  ageMs: number;
}

export interface TtlCacheOptions {
  store: KvStore;
  /** Namespace so unrelated payloads never collide in the shared store. */
  namespace: string;
  ttlMs: number;
  /** Entries older than this are dropped on read instead of surfaced as stale. */
  maxAgeMs?: number;
  now?: () => number;
}

export interface TtlCache<T> {
  read(): Promise<CacheEntry<T> | null>;
  write(value: T): Promise<number>;
  clear(): Promise<void>;
  readonly key: string;
}

/**
 * `undefined` from a storage implementation means "unavailable" and is treated
 * exactly like a read failure: never fatal, always a cache miss.
 */
export function isUsableStore(store: Partial<KvStore> | null | undefined): store is KvStore {
  return Boolean(
    store &&
      typeof store.getItem === "function" &&
      typeof store.setItem === "function" &&
      typeof store.removeItem === "function",
  );
}

function payloadFor<T>(value: T, fetchedAt: number): string {
  return JSON.stringify({ v: value, at: fetchedAt });
}

export function createTtlCache<T>(options: TtlCacheOptions): TtlCache<T> {
  const { store, namespace, ttlMs, maxAgeMs = 24 * 60 * 60_000 } = options;
  const now = options.now ?? (() => Date.now());
  const key = `tj:${namespace}`;

  return {
    key,
    async read() {
      try {
        const raw = await store.getItem(key);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) return null;
        const record = parsed as { v?: unknown; at?: unknown };
        if (typeof record.at !== "number" || !Number.isFinite(record.at)) return null;

        const ageMs = Math.max(0, now() - record.at);
        if (ageMs > maxAgeMs) {
          await store.removeItem(key).catch(() => undefined);
          return null;
        }
        return {
          key,
          value: record.v as T,
          fetchedAt: record.at,
          ageMs,
          state: ageMs <= ttlMs ? "fresh" : "stale",
        };
      } catch {
        // Corrupt or unreadable entries must never break a screen.
        return null;
      }
    },
    async write(value) {
      const fetchedAt = now();
      try {
        await store.setItem(key, payloadFor(value, fetchedAt));
      } catch {
        // Storage quota / unavailable native module: keep the in-memory result only.
      }
      return fetchedAt;
    },
    async clear() {
      try {
        await store.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

/** In-memory store used by tests, previews and the no-native-module fallback. */
export function createMemoryStore(initial: Record<string, string> = {}): KvStore & {
  snapshot(): Record<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    async getItem(k) {
      return data.get(k) ?? null;
    },
    async setItem(k, value) {
      data.set(k, value);
    },
    async removeItem(k) {
      data.delete(k);
    },
    snapshot() {
      return Object.fromEntries(data.entries());
    },
  };
}
