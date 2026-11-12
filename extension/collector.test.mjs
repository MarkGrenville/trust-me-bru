import test from "node:test";
import assert from "node:assert/strict";
import { createCollector } from "./background.mjs";
import { dayAt, pause, makeQueue, finishTask, nextTask } from "./core.mjs";
const product = {
  id: "tv",
  name: "TV",
  model: "TV1",
  stores: {
    takealot: "https://www.takealot.com/tv/PLID123",
    incredible: "https://www.incredible.co.za/tv",
  },
};
const data = {
  day: "2026-11-12",
  products: [product],
  stores: [
    { key: "takealot", status: "tracked" },
    { key: "incredible", status: "tracked" },
    { key: "game", status: "human-check" },
  ],
  completed: [],
};
function harness() {
  let now = Date.parse("2026-11-12T08:00:00+02:00"),
    id = 0;
  const storage = {},
    tabs = new Map(),
    alarms = new Map(),
    visits = [],
    posts = [];
  let capture = {
      reading: { observed_at: "2026-11-12T08:00:10+02:00", price: 100 },
    },
    online = true,
    recorded = [];
  const chrome = {
    storage: {
      local: {
        async get(keys) {
          return Object.fromEntries(
            [keys].flat().map((k) => [k, structuredClone(storage[k])]),
          );
        },
        async set(values) {
          Object.assign(storage, structuredClone(values));
        },
      },
    },
    alarms: {
      async create(name, a) {
        alarms.set(name, a);
      },
      async clear(name) {
        alarms.delete(name);
      },
    },
    tabs: {
      async create(tab) {
        tabs.set(++id, { ...tab, id, status: "complete" });
        return { id };
      },
      async update(id, tab) {
        visits.push({ id, url: tab.url, now });
        Object.assign(tabs.get(id), tab);
      },
      async get(id) {
        if (!tabs.has(id)) throw Error("closed");
        return tabs.get(id);
      },
      async remove(id) {
        tabs.delete(id);
      },
    },
    scripting: {
      async executeScript() {
        return [{ result: structuredClone(capture) }];
      },
    },
  };
  const fetcher = async (url, options) => {
    if (!online) throw Error("offline");
    if (url.endsWith("/api/collection"))
      return Response.json({ ...data, completed: recorded });
    posts.push(JSON.parse(options.body));
    return Response.json({ ok: true }, { status: 201 });
  };
  const make = () =>
    createCollector(
      chrome,
      fetcher,
      () => now,
      () => 0.5,
    );
  return {
    make,
    chrome,
    storage,
    tabs,
    alarms,
    visits,
    posts,
    advance(ms) {
      now += ms;
    },
    capture(value) {
      capture = value;
    },
    completed(keys) {
      recorded = keys;
    },
    offline() {
      online = false;
    },
    async read(c) {
      await c.tick();
      await c.tick();
      this.advance(8000);
      await c.tick();
    },
  };
}
test("queue uses tracked exact URLs, skips today, SAST day and 20–30 second limits", () => {
  const q = makeQueue({ ...data, completed: ["tv|takealot"] });
  assert.equal(q[0].status, "already");
  assert.equal(q[1].url, product.stores.incredible);
  assert.equal(dayAt(Date.parse("2026-11-11T22:30:00Z")), "2026-11-12");
  assert.equal(
    pause(() => 0),
    20000,
  );
  assert.equal(
    pause(() => 0.999999),
    30000,
  );
});
test("block stops store immediately, three ordinary failures stop it, success resets failures", () => {
  const state = {
    queue: Array.from({ length: 5 }, (_, i) => ({
      key: String(i),
      store: "takealot",
      status: "pending",
    })),
    failures: {},
    stopped: {},
  };
  finishTask(state, state.queue[0], {
    ok: false,
    reason: "captcha",
    blocked: true,
  });
  assert.equal(state.queue[1].status, "stopped");
  assert.equal(nextTask(state), undefined);
  state.stopped = {};
  state.queue.forEach((t) => (t.status = "pending"));
  state.failures = {};
  finishTask(state, state.queue[0], { ok: false });
  finishTask(state, state.queue[1], { ok: true });
  assert.equal(state.failures.takealot, 0);
  for (const t of state.queue.slice(2)) finishTask(state, t, { ok: false });
  assert.ok(state.stopped.takealot);
});
test("durable collector owns one tab, survives worker recreation, and respects next store deadline", async () => {
  const h = harness();
  let c = h.make();
  await c.start();
  await c.tick();
  assert.equal(h.tabs.size, 1);
  c = h.make();
  await c.tick();
  h.advance(8000);
  await c.tick();
  assert.equal(h.posts.length, 1);
  assert.equal(h.tabs.size, 0);
  await c.tick();
  assert.equal(h.tabs.size, 1);
  assert.equal(h.visits[1].url, product.stores.incredible);
  await c.cancel();
  assert.equal(h.tabs.size, 0);
  assert.equal(h.storage.collection.running, false);
  // Fresh button press retains the per-store last-visit pacing.
  await c.start();
  await c.tick();
  assert.equal(h.visits.length, 2);
  assert.ok(h.alarms.get("collect-next").when > 0);
});
test("bot block never posts and stays stopped on another button press the same day", async () => {
  const h = harness(),
    c = h.make();
  h.capture({ blocked: true, reason: "Human check" });
  await c.start();
  await h.read(c);
  assert.equal(h.posts.length, 0);
  assert.equal(h.storage.collection.stopped.takealot, "Human check");
  await c.cancel();
  await c.start();
  assert.equal(h.storage.collection.queue[0].status, "stopped");
});
test("offline local API stops collection and closes its tab without posting another page", async () => {
  const h = harness(),
    c = h.make();
  await c.start();
  await c.tick();
  await c.tick();
  h.offline();
  h.advance(8000);
  await c.tick();
  assert.equal(h.storage.collection.running, false);
  assert.match(h.storage.collection.error, /offline/);
  assert.equal(h.tabs.size, 0);
  assert.equal(h.visits.length, 1);
});
test("daily switch is opt-in, once per SAST day, and preserves blocked stores", async () => {
  const h = harness(),
    c = h.make();
  await c.daily();
  assert.equal(h.visits.length, 0);
  assert.equal(h.storage.collection, undefined);
  await h.chrome.storage.local.set({ autoDaily: true });
  await c.daily();
  assert.equal(h.storage.lastAutoDay, data.day);
  await c.cancel();
  await c.daily();
  assert.equal(h.storage.collection.running, false);
});
test("crossing midnight closes active tab without recording a price", async () => {
  const h = harness(),
    c = h.make();
  await c.start();
  await c.tick();
  h.advance(86400000);
  await c.tick();
  assert.equal(h.posts.length, 0);
  assert.equal(h.tabs.size, 0);
  assert.match(h.storage.collection.error, /date changed/);
});

test("newly recorded offers are skipped before opening a retailer tab", async () => {
  const h = harness(),
    c = h.make();
  await c.start();
  h.completed(["tv|takealot"]);
  await c.tick();
  assert.equal(h.storage.collection.queue[0].status, "already");
  assert.equal(h.visits.length, 0);
});
test("an offline checker prevents opening the next retailer page", async () => {
  const h = harness(),
    c = h.make();
  await c.start();
  h.offline();
  await c.tick();
  assert.equal(h.visits.length, 0);
  assert.equal(h.storage.collection.running, false);
});
