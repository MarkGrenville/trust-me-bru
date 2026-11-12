import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readProduct } from "./reader.mjs";
const require = createRequire(new URL("../site/package.json", import.meta.url));
const { parseHTML } = require("linkedom");
const task = {
  product: { id: "tv", gtin: "1234567890123" },
  store: "incredible",
  url: "https://www.incredible.co.za/tv",
};
function read(html, t = task, computedStyle) {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  globalThis.getComputedStyle = computedStyle;
  globalThis.document = document;
  globalThis.location = { href: t.url };
  return readProduct(t);
}
const ld = (price = 5999, gtin = task.product.gtin) =>
  `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", gtin, offers: { price, priceCurrency: "ZAR", availability: "https://schema.org/InStock", seller: { name: "Incredible Connection" } } })}</script>`;
const price = `<h1>TV</h1><div class="product-info-price"><span data-price-type="finalPrice"><span class="price">R 5,999</span></span><span data-price-type="oldPrice"><span class="price">R 8,999</span></span>Normal Price OR <img alt="+more" src="/more.png"></div>`;
test("Incredible and HiFi lower Normal Price offer is always marked with +more", () => {
  for (const store of ["incredible", "hificorp"]) {
    const result = read(ld() + price, { ...task, store });
    assert.equal(result.reading.price, 5999);
    assert.equal(result.reading.was_label, "Normal Price");
    assert.equal(result.reading.promo_label, "with +more");
    assert.equal(result.reading.source, "extension");
  }
});
test("GTIN mismatch, structured-visible mismatch, ambiguous offer, missing stock all save nothing", () => {
  for (const html of [
    ld(5999, "9999999999999") + price,
    ld(6000) + price,
    ld() + ld() + price,
    ld().replace("InStock", "Discontinued") + price,
  ])
    assert.equal(read(html).reading, undefined);
});
test("block has priority over apparent price data and no retry", () => {
  const result = read("<p>Are you a human? Press and hold</p>" + ld() + price);
  assert.equal(result.blocked, true);
  assert.equal(result.reading, undefined);
});
test("unreadable comparison and unknown member condition are refused", () => {
  assert.equal(
    read(ld() + price.replace("R 8,999", "Call for price")).reading,
    undefined,
  );
  assert.equal(
    read(ld() + price.replace('<img alt="+more" src="/more.png">', "")).reading,
    undefined,
  );
});
test("Takealot captures main seller, ignores Other Offers, and preserves unknowns", () => {
  const t = { ...task, store: "takealot" };
  const html = `<h1>TV</h1><div data-ref="buybox-offer"><div data-ref="price"><span class="currency">R 5,999</span><span class="list-price"><span class="currency">R 8,999</span></span></div></div><div data-ref="stock-info-container"><div data-ref="stock-availability-status">In stock</div></div><div class="pdp-module_seller-detail"><div class="seller-information">Sold by The Cool Shop</div></div><div data-ref="other-offers"><div class="seller-information">Sold by Takealot</div></div>`;
  const result = read(html, t);
  assert.equal(result.reading.seller, "The Cool Shop");
  assert.equal(result.reading.is_marketplace, true);
  const unknown = read(
    html.replace('class="pdp-module_seller-detail"', 'class="not-main"'),
    t,
  );
  assert.equal(unknown.reading.seller, null);
  assert.equal(unknown.reading.is_marketplace, null);
});
test("HiFi uses shopper-visible wording and preserves the hidden code label", () => {
  const rating =
    '<script type="application/ld+json">{"@type":"Product","aggregateRating":{"ratingValue":4}}</script>';
  const html =
    ld() +
    rating +
    price
      .replace(
        '<span data-price-type="oldPrice">',
        '<span class="price-container"><span class="price-label" hidden>Regular Price</span><span data-price-type="oldPrice">',
      )
      .replace("R 8,999</span></span>", "R 8,999</span></span></span>");
  const result = read(html, { ...task, store: "hificorp" });
  assert.equal(result.reading.was_label, "Normal Price");
  assert.equal(
    result.reading.was_label_note,
    "Page code: Regular Price. Shopper-visible label: Normal Price.",
  );
  assert.equal(result.reading.promo_label, "with +more");
});
test("Checkers main promotional price agrees with structured regular price and keeps member condition", () => {
  const html =
    ld(37.99) +
    `<h1>Milk 2L</h1><div class="product-content"><div><p class="pdp-main-price member-promo">R29<span>.99</span></p><p class="discounted-price">R37<span>.99</span></p></div><p>Deal expires 22 Nov 2026</p><h2>Related Products</h2><p class="discounted-price">R100</p></div>`;
  const result = read(html, { ...task, store: "checkers" });
  assert.equal(result.reading.price, 29.99);
  assert.equal(result.reading.was_price, 37.99);
  assert.equal(result.reading.was_label, null);
  assert.match(result.reading.promo_label, /member price/);
});
test("PnP ignores recommendation prices and uses the main product cart availability", () => {
  const html = `<h1>Bread 700g</h1><cx-page-slot class="BodyContentSlot-RightHandSide"><cms-product-summary><div class="cms-price-display-container">R17.99</div></cms-product-summary><button>Add to cart</button></cx-page-slot><div class="plp-price"><div class="cms-price-display-container">R50</div><button>Add to cart</button></div><div hidden>Barcode ${task.product.gtin}</div>`;
  const result = read(html, { ...task, store: "pnp" });
  assert.equal(result.reading.price, 17.99);
  assert.equal(result.reading.seller, "Pick n Pay");
  assert.equal(
    read(
      html.replace(
        "<button>Add to cart</button>",
        "<button disabled>Add to cart</button>",
      ),
      { ...task, store: "pnp" },
    ).reading,
    undefined,
  );
});

test("CSS-generated Normal Price beats a hidden Regular Price label", () => {
  const html =
    ld() +
    price
      .replace("Normal Price OR", "")
      .replace(
        '<span data-price-type="oldPrice">',
        '<span class="price-container"><span class="price-label" hidden>Regular Price</span><span data-price-type="oldPrice">',
      )
      .replace("R 8,999</span></span>", "R 8,999</span></span></span>");
  const result = read(html, { ...task, store: "hificorp" }, (e, pseudo) => ({
    display: "block",
    visibility: "visible",
    content:
      e.classList.contains("price-container") && pseudo === "::after"
        ? '"Normal Price"'
        : "none",
  }));
  assert.equal(result.reading.was_label, "Normal Price");
  assert.match(result.reading.was_label_note, /Page code: Regular Price/);
  const unknown = read(html, { ...task, store: "hificorp" });
  assert.equal(unknown.reading.was_label, null);
  assert.match(
    unknown.reading.was_label_note,
    /No shopper-visible label captured/,
  );
});
