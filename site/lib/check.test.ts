import test from "node:test";
import assert from "node:assert/strict";
import { listingCheck } from "./check";
import { readDataset } from "./data";
import { verdict } from "./math";

test("latest listing verdict survives midnight, other stores collecting, and unordered logs without claiming a price held", async () => {
  const data = await readDataset();
  const product = data.products.find((p) => p.id === "hisense-hs5100")!;
  const store = "hificorp",
    url = product.stores[store];
  const original = data.observations.find((o) => o.url === url)!;
  const reading = { ...original, observed_at: "2026-11-11T22:00:00+02:00" };
  const otherStore = {
    ...reading,
    store: "incredible",
    url: product.stores.incredible,
    observed_at: "2026-11-12T02:00:00+02:00",
  };
  const wrongVariant = {
    ...reading,
    url: url + "?variant=other",
    observed_at: "2026-11-12T03:00:00+02:00",
    price: 1,
  };
  const dataset = {
    ...data,
    date: "2026-11-12",
    observations: [
      otherStore,
      wrongVariant,
      reading,
      { ...reading, observed_at: "2026-11-10T20:00:00+02:00", price: 3000 },
    ],
  };
  const beforeMidnight = listingCheck(dataset, product, store, "2026-11-11");
  const afterMidnight = listingCheck(dataset, product, store, "2026-11-12");
  assert.equal(beforeMidnight.stale, false);
  assert.equal(afterMidnight.stale, true);
  assert.equal(afterMidnight.as_of, "2026-11-11");
  assert.deepEqual(afterMidnight.reading, reading);
  assert.deepEqual(afterMidnight.verdict, beforeMidnight.verdict);
  assert.deepEqual(
    afterMidnight.verdict,
    verdict(reading, dataset.observations, dataset.references, "2026-11-11"),
  );
  assert.equal(
    afterMidnight.other_stores.length,
    0,
    "newer other-store prices must not appear under the old date",
  );
  assert.equal(
    dataset.observations.length,
    4,
    "displaying history never appends today's reading",
  );
});

test("an exact offer with no readings remains empty", async () => {
  const data = await readDataset();
  const result = listingCheck(
    { ...data, observations: [] },
    data.products[0],
    Object.keys(data.products[0].stores)[0],
    "2026-11-12",
  );
  assert.equal(result.reading, null);
  assert.equal(result.verdict, null);
  assert.equal(result.as_of, null);
  assert.equal(result.stale, false);
  assert.deepEqual(result.other_stores, []);
});
