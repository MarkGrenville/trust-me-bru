import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { parseHTML } from "linkedom";
const require = createRequire(import.meta.url);
const { readTakealotSeller } = require("../../collector/takealot-seller.cjs");
const { captureTakealotPage } = require("../../collector/capture-takealot.cjs");

const read = (body: string) =>
  readTakealotSeller(parseHTML(`<html><body>${body}</body></html>`).document);
const seller = (name: string) =>
  `<div class="seller-information">Sold by <a href="/seller/test">${name}</a></div>`;
test("reads the visible desktop main seller outside the buybox", () => {
  const r = read(
    `<div data-ref="buybox"><span>R 18,999</span></div><div class="pdp-module_seller-detail_HASH">${seller("The Cool Shop")}</div>`,
  );
  assert.equal(r.seller, "The Cool Shop");
  assert.equal(r.is_marketplace, true);
});
test("reads the mobile stock/seller block and recognises a native Takealot offer", () => {
  const r = read(
    `<div data-ref="stock-info-container"><div class="pdp-core-module_main-seller_HASH">${seller("Takealot")}</div></div>`,
  );
  assert.equal(r.seller, "Takealot");
  assert.equal(r.is_marketplace, false);
});
test("ignores Other Offers, hidden responsive copies and fulfilment wording", () => {
  const r = read(
    `<div data-ref="stock-info-container" hidden><div class="main-seller">${seller("Wrong seller")}</div></div><div class="pdp-module_seller-detail_HASH">${seller("Takealot.com")}</div><div class="buying-choice-list-item"><div class="pdp-module_seller-detail_HASH">${seller("Other offer")}</div></div>`,
  );
  assert.equal(r.seller, "Takealot.com");
  assert.equal(r.is_marketplace, false);
  assert.equal(
    read(
      '<div class="pdp-module_seller-detail_HASH"><div class="seller-information">Fulfilled by Takealot</div></div>',
    ).seller,
    null,
  );
});
test("an absent or conflicting main seller remains unknown", () => {
  const missing = read(
    '<div data-ref="other-offers">' + seller("Takealot") + "</div>",
  );
  assert.equal(missing.seller, null);
  assert.equal(missing.is_marketplace, null);
  const conflicting = read(
    `<div class="pdp-module_seller-detail_A">${seller("A")}</div><div class="pdp-module_seller-detail_B">${seller("B")}</div>`,
  );
  assert.equal(conflicting.status, "ambiguous");
  assert.equal(conflicting.is_marketplace, null);
});

test("a native page flag is accepted only for the exact selected SKU and visible price", () => {
  const { document } = parseHTML(
    '<html><body><div data-ref="buybox"><div data-ref="buybox-offer"><div data-ref="price"><span class="currency">R 80</span></div></div></div></body></html>',
  );
  Object.defineProperty(document, "URL", {
    value: "https://www.takealot.com/item/PLID123",
  });
  const box = document.querySelector(
    '[data-ref="buybox"]',
  ) as unknown as Record<string, unknown>;
  const data = {
    apiEventTrackingData: {
      product_line_id: 123,
      market_place_listing: false,
      sku_id: 42,
      purchase_price: 80,
    },
    buybox: { plid: 123, offers: [{ isSelected: true, sku: 42, price: 80 }] },
    selectedItemIndex: 0,
  };
  box.__reactFiber$fixture = { memoizedProps: data, return: null };
  assert.equal(readTakealotSeller(document).seller, "Takealot");
  assert.equal(readTakealotSeller(document).is_marketplace, false);
  data.apiEventTrackingData.sku_id = 99;
  assert.equal(readTakealotSeller(document).seller, null);
  data.apiEventTrackingData.sku_id = 42;
  data.apiEventTrackingData.product_line_id = 999;
  assert.equal(readTakealotSeller(document).seller, null);
  data.apiEventTrackingData.product_line_id = 123;
  data.buybox.offers[0].price = 81;
  assert.equal(readTakealotSeller(document).seller, null);
});
test("the single-page collector stops on a human check before reading prices", async () => {
  const url = "https://www.takealot.com/item/PLID123";
  const result = await captureTakealotPage(
    { url: () => url, evaluate: async () => true },
    [{ id: "test", stores: { takealot: url } }],
    () => {
      throw new Error("Must not read a blocked page");
    },
  );
  assert.equal(result.stop_store, true);
  assert.equal(result.reading, null);
});
test("a challenge appearing after hydration stops the collector too", async () => {
  const url = "https://www.takealot.com/item/PLID123";
  let evaluations = 0;
  const page = {
    url: () => url,
    evaluate: async () => ++evaluations > 1,
    waitForFunction: async () => {},
  };
  const result = await captureTakealotPage(
    page,
    [{ id: "test", stores: { takealot: url } }],
    () => {
      throw new Error("Must not read through a challenge");
    },
  );
  assert.equal(result.stop_store, true);
  assert.equal(result.reading, null);
});
