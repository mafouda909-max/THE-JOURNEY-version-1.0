import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createMemoryStore, createTtlCache, isUsableStore } from "../src/lib/cache";

const HOUR = 3_600_000;

function clock(start = 1_000) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("createTtlCache", () => {
  it("namespaces keys so payloads cannot collide", async () => {
    const store = createMemoryStore();
    const offers = createTtlCache<string[]>({ store, namespace: "offers:v1:all", ttlMs: 60_000 });
    const agents = createTtlCache<string[]>({ store, namespace: "agents:v1", ttlMs: 60_000 });
    assert.equal(offers.key, "tj:offers:v1:all");
    assert.equal(agents.key, "tj:agents:v1");

    await offers.write(["a"]);
    assert.equal(await agents.read(), null);
  });

  it("reads back a fresh entry and reports its age", async () => {
    const time = clock();
    const store = createMemoryStore();
    const cache = createTtlCache<{ id: number }[]>({
      store,
      namespace: "offers",
      ttlMs: 60_000,
      now: time.now,
    });

    const writtenAt = await cache.write([{ id: 1 }]);
    time.advance(10_000);
    const hit = await cache.read();
    assert.equal(writtenAt, 1_000);
    assert.equal(hit?.state, "fresh");
    assert.equal(hit?.ageMs, 10_000);
    assert.deepEqual(hit?.value, [{ id: 1 }]);
  });

  it("marks an entry stale once the TTL passes, then drops it at maxAge", async () => {
    const time = clock();
    const store = createMemoryStore();
    const cache = createTtlCache<string[]>({
      store,
      namespace: "offers",
      ttlMs: 60_000,
      maxAgeMs: 2 * HOUR,
      now: time.now,
    });

    await cache.write(["x"]);
    time.advance(61_000);
    assert.equal((await cache.read())?.state, "stale");

    time.advance(2 * HOUR);
    assert.equal(await cache.read(), null);
    assert.deepEqual(store.snapshot(), {}, "an expired entry must be evicted, not left to rot");
  });

  it("treats storage failures as a miss rather than an exception", async () => {
    const broken = {
      getItem: async () => {
        throw new Error("native module unavailable");
      },
      setItem: async () => {
        throw new Error("quota exceeded");
      },
      removeItem: async () => {
        throw new Error("nope");
      },
    };
    const cache = createTtlCache<string[]>({ store: broken, namespace: "offers", ttlMs: 60_000 });
    assert.equal(await cache.read(), null);
    assert.equal(typeof await cache.write(["a"]), "number");
    await cache.clear();
  });

  it("ignores corrupt or hand-edited payloads", async () => {
    const store = createMemoryStore({
      "tj:offers": "{not json",
      "tj:agents": JSON.stringify({ value: [], at: "yesterday" }),
      "tj:media": JSON.stringify([1, 2, 3]),
    });
    for (const namespace of ["offers", "agents", "media"]) {
      const cache = createTtlCache<unknown>({ store, namespace, ttlMs: 60_000 });
      assert.equal(await cache.read(), null, `${namespace} should be a miss`);
    }
  });

  it("clear removes the entry", async () => {
    const store = createMemoryStore();
    const cache = createTtlCache<string[]>({ store, namespace: "offers", ttlMs: 60_000 });
    await cache.write(["a"]);
    await cache.clear();
    assert.equal(await cache.read(), null);
  });
});

describe("isUsableStore", () => {
  it("accepts only a complete KvStore", () => {
    assert.equal(isUsableStore(createMemoryStore()), true);
    assert.equal(isUsableStore({ getItem: async () => null }), false);
    assert.equal(isUsableStore(null), false);
    assert.equal(isUsableStore(undefined), false);
    assert.equal(isUsableStore({}), false);
  });
});
