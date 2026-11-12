import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { latestReadings, wasSpread, leaderboard, verdict } from "./math";
import { readDataset } from "./data";
import { listingCheck } from "./check";
import { readingDates } from "./format";
import { exampleReading, exampleStore } from "./test-fixtures";
import ProductPage from "../app/p/[id]/page";
import Home from "../app/page";

const old = { ...exampleReading, observed_at: "2026-11-11T12:00:00+02:00" };
const newer = { ...old, observed_at: "2026-11-12T02:00:00+02:00", price: 110 };

test("latest readings keep each store's date, reject other variants and never replace a new unavailable offer with an old price", () => {
  const product = {
    id: old.product_id,
    name: "Example",
    brand: "Example",
    model: "EX",
    category: "test",
    stores: { example: old.url, other: "https://store.test/other" },
  };
  const peer = { ...old, store: "other", url: product.stores.other };
  const unavailable = { ...newer, in_stock: false };
  const variant = {
    ...newer,
    url: old.url + "?variant=other",
    observed_at: "2026-11-13T02:00:00+02:00",
  };
  const input = [variant, peer, unavailable, old];
  const rows = latestReadings(input, [product]);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.find((o) => o.store === "example"),
    unavailable,
  );
  assert.deepEqual(
    rows.find((o) => o.store === "other"),
    peer,
  );
  assert.match(readingDates(rows), /11 Nov 2026.*12 Nov 2026/);
  assert.equal(input.length, 4);
});

test("crossed-out spread requires another store on the same reading date", () => {
  const peer = { ...newer, store: "other", was_price: 100 };
  assert.equal(wasSpread(old, [old, peer]), null);
  assert.equal(wasSpread(peer, [old, peer]), null);
  const sameDay = { ...peer, observed_at: old.observed_at };
  assert.equal(wasSpread(old, [old, sameDay]), 50);
});

test("latest board includes old offers during a partial collection and dates each sample", () => {
  const history = Array.from({ length: 5 }, (_, i) => ({
    ...old,
    product_id: `p${i}`,
    url: `https://store.test/p${i}`,
  }));
  const partial = { ...history[0], observed_at: newer.observed_at, price: 100 };
  const board = leaderboard(
    [exampleStore],
    [partial, ...history],
    [],
    "2026-11-12",
    "latest",
  )[0];
  assert.equal(board.count, 5);
  assert.equal(board.enough, true);
  assert.equal(board.from, "2026-11-11");
  assert.equal(board.through, "2026-11-12");
  assert.equal(board.gapCount, 0);
  const daily = leaderboard(
    [exampleStore],
    [partial, ...history],
    [],
    "2026-11-12",
  )[0];
  assert.equal(daily.count, 1, "daily collection semantics remain unchanged");
});

test("all first-night offers survive the two-readings partial day and match the corner verdict dates", async () => {
  const data = await readDataset();
  const rows = latestReadings(data.observations, data.products);
  assert.equal(rows.length, 159);
  assert.equal(
    rows.filter((o) => o.observed_at.startsWith("2026-11-11")).length,
    157,
  );
  assert.equal(
    rows.filter((o) => o.observed_at.startsWith("2026-11-12")).length,
    2,
  );
  for (const o of rows) {
    const product = data.products.find((p) => p.id === o.product_id)!;
    assert.deepEqual(
      verdict(
        o,
        data.observations,
        data.references,
        o.observed_at.slice(0, 10),
      ),
      listingCheck(data, product, o.store).verdict,
    );
  }
  const mixed = rows.filter((o) => o.product_id === "hisense-58a6n");
  assert.equal(mixed.length, 3);
  assert.equal(
    mixed.find((o) => o.store === "takealot")!.observed_at.slice(0, 10),
    "2026-11-11",
  );
});

test("home and product receipts retain first-night prices, dated rows, graphs and store tabs", async () => {
  const home = renderToStaticMarkup(
    await Home({ searchParams: Promise.resolve({}) }),
  );
  assert.match(home, /159 store readings/);
  assert.match(home, /11 Nov 2026/);
  const page = renderToStaticMarkup(
    await ProductPage({ params: Promise.resolve({ id: "hisense-hs5100" }) }),
  );
  assert.match(page, /4 store readings/);
  assert.doesNotMatch(page, /12 Nov 2026/);
  const { document } = parseHTML(page);
  assert.equal(
    document.querySelectorAll(".comparison-table tbody tr").length,
    4,
  );
  assert.equal(document.querySelectorAll(".store-tabs button").length, 4);
  assert.ok(
    document.querySelector("svg.price-chart") ||
      page.includes("Price over time"),
  );
  const mixed = renderToStaticMarkup(
    await ProductPage({ params: Promise.resolve({ id: "hisense-58a6n" }) }),
  );
  assert.match(mixed, /3 store readings/);
  assert.match(mixed, /11 Nov 2026/);
  assert.match(mixed, /12 Nov 2026/);
  assert.doesNotMatch(mixed, /Takealot: no reading/);
});
