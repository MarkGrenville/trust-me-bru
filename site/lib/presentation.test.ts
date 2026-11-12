import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { PriceHistory } from "../components/price-history";
import { ProductInspector } from "../components/product-inspector";
import {
  exampleReading,
  exampleReference,
  exampleStore,
} from "./test-fixtures";

test("monthly chart prices are isolated dated points, with no line between them", () => {
  const html = renderToStaticMarkup(
    createElement(PriceHistory, {
      readings: [],
      references: [exampleReference],
    }),
  );
  const { document } = parseHTML(html);
  assert.equal(document.querySelectorAll(".series-reference circle").length, 3);
  assert.equal(
    document.querySelectorAll(
      ".series-reference line,.series-reference polyline,.series-reference path",
    ).length,
    0,
  );
  assert.ok(html.includes("when the price changed between them is unknown"));
});
test("a price increase is stated in rand and percent alongside zero real saving", () => {
  const html = renderToStaticMarkup(
    createElement(ProductInspector, {
      rows: [exampleReading],
      observations: [exampleReading],
      references: [exampleReference],
      stores: [exampleStore],
    }),
  );
  const { document } = parseHTML(html);
  assert.ok(
    document
      .querySelector(".price-increase")
      ?.textContent?.includes("Price up R20.00 (20.0%)."),
  );
  assert.ok(
    document.querySelector(".price-increase")?.textContent?.includes("100.00"),
  );
  assert.ok(
    document
      .querySelector(".stamp-basis")
      ?.textContent?.includes("Oct 2026 · Example tracker"),
  );
});
test("a receipt without reference history shows too early to say", () => {
  const html = renderToStaticMarkup(
    createElement(ProductInspector, {
      rows: [exampleReading],
      observations: [exampleReading],
      references: [],
      stores: [exampleStore],
    }),
  );
  const { document } = parseHTML(html);
  assert.match(
    document.querySelector(".early-stamp")?.textContent || "",
    /TOO EARLY.*TO SAY/,
  );
  assert.equal(document.querySelector(".stamp"), null);
  assert.equal(document.querySelector(".reference-basis"), null);
});
