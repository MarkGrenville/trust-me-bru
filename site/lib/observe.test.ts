import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  appendObservation,
  RequestError,
  requireLoopback,
  validateObservation,
} from "./observe";
import type { Observation, Product } from "./types";
import { eligible } from "./math";

const products: Product[] = [
  {
    id: "test",
    name: "Test",
    brand: "Test",
    model: "TEST",
    category: "test",
    stores: { store: "https://example.test/item?colour=black" },
  },
];
const reading: Observation = {
  product_id: "test",
  store: "store",
  observed_at: "2026-11-11T12:00:00+02:00",
  price: 5999,
  was_price: 8999,
  was_label: "Normal Price",
  claimed_pct: null,
  promo_label: "with +more",
  in_stock: true,
  url: products[0].stores.store,
  source: "extension",
  seller: "Store",
  is_marketplace: false,
};
const now = new Date("2026-11-12T00:00:00+02:00");
test("Takealot seller identity controls leaderboard eligibility and cannot contradict its marketplace flag", () => {
  const list = [{ ...products[0], stores: { takealot: reading.url } }];
  const native = {
    ...reading,
    store: "takealot",
    seller: "Takealot",
    is_marketplace: false,
  };
  assert.equal(eligible(validateObservation(native, list, now)), true);
  assert.equal(
    eligible(
      validateObservation(
        { ...native, seller: "The Cool Shop", is_marketplace: true },
        list,
        now,
      ),
    ),
    false,
  );
  assert.equal(
    eligible(
      validateObservation(
        { ...native, seller: null, is_marketplace: null },
        list,
        now,
      ),
    ),
    false,
  );
  assert.throws(
    () =>
      validateObservation({ ...native, seller: "The Cool Shop" }, list, now),
    RequestError,
  );
  const missing = { ...native } as Record<string, unknown>;
  delete missing.seller;
  delete missing.is_marketplace;
  assert.throws(() => validateObservation(missing, list, now), RequestError);
});
test("validates exact variants, amounts, dates, required fields and seller identity", () => {
  assert.equal(
    validateObservation(reading, products, now).promo_label,
    "with +more",
  );
  for (const changes of [
    { url: "https://example.test/item?colour=white" },
    { price: -1 },
    { price: 1.001 },
    { observed_at: "2026-02-30T12:00:00+02:00" },
    { observed_at: "2026-11-13T12:00:00+02:00" },
    { claimed_pct: 101 },
    { seller: null },
    { unknown: true },
    { in_stock: "yes" },
    { observed_at: "2026-11-11T10:00:00Z" },
  ])
    assert.throws(
      () => validateObservation({ ...reading, ...changes }, products, now),
      RequestError,
    );
  const missing = { ...reading } as Partial<Observation>;
  delete missing.was_price;
  assert.throws(
    () => validateObservation(missing, products, now),
    RequestError,
  );
});
test("local API rejects external hosts and web origins", () => {
  assert.doesNotThrow(() =>
    requireLoopback(
      new Request("http://localhost:3210/api/observe", {
        headers: {
          host: "localhost:3210",
          origin: "chrome-extension://" + "a".repeat(32),
        },
      }),
    ),
  );
  for (const headers of [
    { host: "evil.test" },
    { host: "localhost:3210", origin: "https://evil.test" },
    { host: "localhost:3210", "x-forwarded-host": "evil.test" },
  ] as Record<string, string>[])
    assert.throws(
      () =>
        requireLoopback(
          new Request("http://localhost:3210/api/observe", { headers }),
        ),
      RequestError,
    );
});
test("concurrent daily duplicates append once; next day is a separate reading", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "trust-me-bru-"));
  try {
    const results = await Promise.allSettled([
      appendObservation(directory, reading),
      appendObservation(directory, reading),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const rejected = results.find(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult;
    assert.equal(rejected.reason.status, 409);
    await appendObservation(directory, {
      ...reading,
      observed_at: "2026-11-12T00:01:00+02:00",
    });
    assert.equal(
      (await readFile(path.join(directory, "observations.jsonl"), "utf8"))
        .trim()
        .split("\n").length,
      2,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("comparison-label notes are preserved and validated", () => {
  const note = "Page code: Regular Price. Shopper-visible label: Normal Price.";
  assert.equal(
    validateObservation({ ...reading, was_label_note: note }, products, now)
      .was_label_note,
    note,
  );
  for (const value of [42, "", "x".repeat(501)])
    assert.throws(
      () =>
        validateObservation(
          { ...reading, was_label_note: value },
          products,
          now,
        ),
      RequestError,
    );
  assert.throws(
    () =>
      validateObservation(
        { ...reading, was_price: null, was_label: null, was_label_note: note },
        products,
        now,
      ),
    RequestError,
  );
});
