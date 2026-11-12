import test from "node:test";
import assert from "node:assert/strict";
import {
  claimed,
  realSaving,
  stampFor,
  verdict,
  wasSpread,
  leaderboard,
  shiftDay,
  localDay,
  priceIncrease,
  latestOnDay,
} from "./math";
import type { Observation, Reference, Store } from "./types";
import { money } from "./format";
import { readFileSync } from "node:fs";

const reading = (changes: Partial<Observation> = {}): Observation => ({
  product_id: "tv",
  store: "a",
  observed_at: "2026-11-11T12:00:00+02:00",
  price: 80,
  was_price: 100,
  was_label: "Normal Price",
  claimed_pct: null,
  promo_label: null,
  in_stock: true,
  url: "https://store.test/tv",
  source: "codex-browser",
  seller: "A",
  is_marketplace: false,
  ...changes,
});
const history = (days: number, changes: Partial<Observation> = {}) =>
  Array.from({ length: days }, (_, i) =>
    reading({
      observed_at: `${shiftDay("2026-11-11", -i - 1)}T12:00:00+02:00`,
      price: 90,
      ...changes,
    }),
  );
// Fictional reference prices; no tracker history is bundled in these tests.
const reference = (changes: Partial<Reference> = {}): Reference =>
  ({
    product_id: "tv",
    store: "a",
    retailer_url: reading().url,
    source: "Example tracker",
    source_url: "https://tracker.test/product/test",
    highest_price: 100,
    historical_conditions_known: false,
    is_marketplace: null,
    promo_label: null,
    context_point_before_window: { date: "2026-09-01", price: 95 },
    history: [
      { date: "2026-10-01", price: 100 },
      { date: "2026-11-01", price: 80 },
    ],
    ...changes,
  }) as Reference;

test("claimed, real and negative real saving", () => {
  assert.equal(claimed(80, 100), 20);
  assert.equal(claimed(100, null), null);
  assert.equal(claimed(100, 80), null);
  assert.equal(realSaving(80, 100), 20);
  assert.equal(realSaving(110, 100), 0);
  assert.deepEqual(priceIncrease(110, 100), { amount: 10, percent: 10 });
  assert.equal(priceIncrease(90, 100), null);
  assert.equal(priceIncrease(100, null), null);
});
test("stamp boundaries and an unseen comparison price", () => {
  assert.equal(stampFor(5), "LEGIT");
  assert.equal(stampFor(5.01), "MEH");
  assert.equal(stampFor(15), "MEH");
  assert.equal(stampFor(15.01), "TRUST ME BRU");
  assert.equal(
    verdict(reading(), history(14, { price: 95 }), [], "2026-11-11").stamp,
    "LEGIT",
  );
});
test("one day and 13 pre-reduction days stamp nothing without a reference", () => {
  for (const rows of [[reading()], history(13)]) {
    const v = verdict(reading(), rows, [], "2026-11-11");
    assert.equal(v.stamp, null);
    assert.equal(v.real, null);
  }
});
test("a reduction inside the window uses the low BEFORE the reduction, not sale days", () => {
  const before = Array.from({ length: 14 }, (_, i) =>
    reading({
      observed_at: `${shiftDay("2026-11-01", -i - 1)}T12:00:00+02:00`,
      price: i === 5 ? 95 : 100,
    }),
  );
  const during = Array.from({ length: 11 }, (_, i) =>
    reading({ observed_at: `${shiftDay("2026-11-01", i)}T12:00:00+02:00` }),
  );
  const v = verdict(reading(), [...before, ...during], [], "2026-11-11");
  assert.equal(v.began, "2026-11-01");
  assert.equal(v.baseline, 95);
  assert.equal(v.priorDays, 14);
  assert.ok(v.real! > 15);
  assert.equal(v.stamp, "LEGIT");
});
test("same price held for more than 30 days has zero real saving", () => {
  const v = verdict(
    reading(),
    [reading(), ...history(35, { price: 80 })],
    [],
    "2026-11-11",
  );
  assert.equal(v.baseline, 80);
  assert.equal(v.real, 0);
  assert.equal(v.stamp, "TRUST ME BRU");
  assert.equal(v.basis, "own");
});
test("missing dates and duplicate dates do not establish a price run or a 14-day baseline", () => {
  const v = verdict(
    reading(),
    [
      ...history(13),
      history(1)[0],
      reading({ observed_at: "2026-10-01T12:00:00+02:00" }),
    ],
    [],
    "2026-11-11",
  );
  assert.equal(v.priorDays, 13);
  assert.equal(v.stamp, null);
  assert.equal(
    verdict(reading(), history(14, { price: 80 }), [], "2026-11-11").stamp,
    null,
  );
});
test("member daily prices require the same condition, ignoring sale expiry", () => {
  const member = reading({
    promo_label: "with +more; Sale ends Sunday, 22 November 2026",
  });
  assert.equal(verdict(member, history(14), [], "2026-11-11").real, null);
  assert.equal(
    verdict(
      member,
      history(14, {
        promo_label: "with +more; Sale ends Monday, 30 November 2026",
      }),
      [],
      "2026-11-11",
    ).priorDays,
    14,
  );
});
test("monthly reference chooses latest point at least 30 days old and exposes the next point", () => {
  const v = verdict(
    reading({ promo_label: "with +more" }),
    [],
    [reference()],
    "2026-11-11",
  );
  assert.equal(v.baseline, 100);
  assert.equal(v.real, 20);
  assert.equal(v.stamp, "LEGIT");
  assert.equal(v.reference?.date, "2026-10-01");
  assert.deepEqual(v.reference?.next, { date: "2026-11-01", price: 80 });
  assert.deepEqual(v.sources, ["Example tracker"]);
  assert.equal(v.basis, "reference");
  assert.equal(
    verdict(
      reading(),
      [],
      [reference({ retailer_url: "https://another-listing.test" })],
      "2026-11-11",
    ).stamp,
    null,
  );
  assert.equal(
    verdict(
      reading(),
      [],
      [
        reference({
          context_point_before_window: null,
          history: [{ date: "2026-11-01", price: 100 }],
        }),
      ],
      "2026-11-11",
    ).stamp,
    null,
  );
});
test("exactly 30-day reference qualifies, no claim yields no stamp, stock and marketplace are explicit", () => {
  const r = reference({
    context_point_before_window: null,
    history: [{ date: "2026-10-12", price: 100 }],
  });
  assert.equal(verdict(reading(), [], [r], "2026-11-11").stamp, "LEGIT");
  assert.equal(
    verdict(
      reading({ was_price: null, was_label: null }),
      [],
      [r],
      "2026-11-11",
    ).stamp,
    null,
  );
  assert.equal(
    verdict(reading({ in_stock: false }), [], [r], "2026-11-11").stamp,
    null,
  );
  assert.equal(
    verdict(reading({ is_marketplace: true }), [], [r], "2026-11-11").stamp,
    null,
  );
});
test("spread compares the same product at distinct stores", () => {
  const rows = [
    reading({ was_price: 400 }),
    reading({ store: "b", was_price: 200 }),
    reading({ product_id: "other", store: "c", was_price: 100 }),
  ];
  assert.equal(wasSpread(rows[0], rows), 100);
  assert.equal(wasSpread(reading(), [reading()]), null);
});
test("leaderboard has separate column samples, member counts, stamps and exclusions", () => {
  const stores: Store[] = [
    { key: "a", display_name: "A", home_url: "", status: "tracked" },
    { key: "b", display_name: "B", home_url: "", status: "tracked" },
  ];
  const rows = Array.from({ length: 5 }, (_, i) =>
    reading({
      product_id: `p${i}`,
      promo_label: i === 0 ? "with +more" : null,
    }),
  );
  const peers = rows
    .slice(0, 4)
    .map((o) => ({ ...o, store: "b", was_price: 90 }));
  const refs = rows.map((o) => reference({ product_id: o.product_id }));
  const [a] = leaderboard(
    stores,
    [
      ...rows,
      ...peers,
      reading({ product_id: "out", in_stock: false }),
      reading({ product_id: "market", is_marketplace: true }),
      reading({ product_id: "unknown", is_marketplace: null }),
    ],
    refs,
    "2026-11-11",
  );
  assert.equal(a.count, 5);
  assert.equal(a.members, 1);
  assert.equal(a.enough, true);
  assert.equal(a.spreadCount, 4);
  assert.equal(a.spread, null);
  assert.equal(a.gapCount, 5);
  assert.equal(a.gap, 0);
  assert.equal(a.stamps.LEGIT, 5);
  assert.equal(
    leaderboard(stores, rows.slice(0, 4), refs, "2026-11-11")[0].gap,
    null,
  );
});
test("South African dates roll over at UTC+02", () =>
  assert.equal(localDay(new Date("2026-11-11T22:30:00Z")), "2026-11-12"));
test("rand amounts keep unambiguous thousands and decimal separators", () => {
  assert.equal(money(2499.99), "R2,499.99");
  assert.equal(money(19.99), "R19.99");
});

test("an old reading is not evidence that its price held through missing days", () => {
  const v = verdict(reading(), [reading()], [reference()], "2026-12-12");
  assert.equal(v.heldDays, 0);
  assert.equal(v.real, null);
  assert.equal(v.stamp, null);
});

test("the highest-price card comes from the selected reference source", () => {
  const old = reference({
    source: "Older tracker",
    source_url: "https://old.test",
    history: [{ date: "2026-09-01", price: 110 }],
    highest_price: 150,
  });
  const chosen = reference({ highest_price: 105 });
  const v = verdict(reading(), [], [old, chosen], "2026-11-11");
  assert.equal(v.reference?.source, "Example tracker");
  assert.equal(v.trackerHighest?.source, "Example tracker");
  assert.equal(v.trackerHighest?.price, 105);
});

test("the shared short collection has no stamps without reference history", () => {
  const observations: Observation[] = readFileSync(
    new URL("../../data/observations.jsonl", import.meta.url),
    "utf8",
  )
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const date = "2026-11-11";
  const today = latestOnDay(observations, date);
  assert.ok(today.length > 0);
  for (const o of today) {
    const result = verdict(o, observations, [], date);
    assert.equal(result.stamp, null);
    assert.equal(result.basis, null);
    assert.equal(result.real, null);
    if (o.was_price !== null) {
      if (o.store === "takealot") assert.equal(o.was_label, "List Price");
      if (o.store === "incredible" || o.store === "hificorp")
        assert.equal(o.was_label, "Normal Price");
      if (o.store === "hirschs") assert.equal(o.was_label, "was");
    }
  }
});
