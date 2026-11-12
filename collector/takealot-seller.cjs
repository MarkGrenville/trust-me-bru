// Self-contained so the same reader can run in a browser page or an extension.
function readTakealotSeller(doc = document) {
  const selectors = [
    '[data-ref="stock-info-container"] [class*="main-seller"] .seller-information',
    '[class*="pdp-module_seller-detail"] > .seller-information',
    '[data-ref="buybox"] .seller-information',
  ];
  const candidates = [];
  for (const selector of selectors) {
    for (const block of doc.querySelectorAll(selector)) {
      // Never promote a seller from Other Offers to the selected main offer.
      if (
        block.closest(
          '[class*="buying-choice"], [class*="other-offer"], [data-ref="other-offers"]',
        )
      )
        continue;
      let visible = true;
      for (let e = block; e; e = e.parentElement) {
        if (
          e.hidden ||
          e.getAttribute("aria-hidden") === "true" ||
          e.style?.display === "none" ||
          e.style?.visibility === "hidden"
        )
          visible = false;
      }
      if (
        typeof block.checkVisibility === "function" &&
        !block.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })
      )
        visible = false;
      if (!visible) continue;
      const text = (block.textContent || "").replace(/\s+/g, " ").trim();
      const match = /^Sold\s+by\s*:?\s+(.+)$/i.exec(text);
      if (!match || !match[1].trim()) continue;
      candidates.push({ seller: match[1].trim(), text, selector });
    }
  }
  const names = [...new Set(candidates.map((c) => c.seller.toLowerCase()))];
  // Native offers can omit the visible seller. Use only the explicit public
  // page flag, tied to the selected offer and the visible price, never absence.
  if (!names.length) {
    const box = doc.querySelector('[data-ref="buybox"]');
    let fiber =
      box?.[Object.keys(box).find((k) => k.startsWith("__reactFiber"))];
    const plid = /\/PLID(\d+)(?:[?#]|$)/.exec(doc.URL || "")?.[1];
    const offers = [
      ...doc.querySelectorAll('[data-ref="buybox-offer"]'),
    ].filter(
      (e) => typeof e.checkVisibility !== "function" || e.checkVisibility(),
    );
    const active = offers.filter(
      (e) => e.className.includes("_active_") || e.classList.contains("active"),
    );
    const main =
      active.length === 1 ? active[0] : offers.length === 1 ? offers[0] : null;
    const shown = main
      ?.querySelector('[data-ref="price"] > .currency')
      ?.textContent?.replace(/[R,\s]/g, "");
    for (let i = 0; fiber && i < 45; i++, fiber = fiber.return) {
      const props = fiber.memoizedProps || {};
      const tracking = props.apiEventTrackingData;
      const offer = props.buybox?.offers?.[props.selectedItemIndex];
      if (
        !tracking ||
        !offer ||
        !plid ||
        !shown ||
        !/^\d+(?:\.\d{1,2})?$/.test(shown)
      )
        continue;
      if (
        String(tracking.product_line_id) === plid &&
        String(props.buybox.plid) === plid &&
        offer.isSelected === true &&
        tracking.sku_id === offer.sku &&
        tracking.purchase_price === offer.price &&
        offer.price === Number(shown) &&
        tracking.market_place_listing === false
      ) {
        return {
          seller: "Takealot",
          is_marketplace: false,
          status: "confirmed",
          seller_evidence: [
            {
              source: "Loaded public page main-offer data",
              market_place_listing: false,
              product_line_id: tracking.product_line_id,
              sku: offer.sku,
              price: offer.price,
              selected: true,
            },
          ],
        };
      }
    }
  }
  if (names.length !== 1)
    return {
      seller: null,
      is_marketplace: null,
      status: names.length ? "ambiguous" : "unconfirmed",
      seller_evidence: candidates,
    };
  const seller = candidates[0].seller;
  return {
    seller,
    is_marketplace: !/^takealot(?:\.com)?$/i.test(seller),
    status: "confirmed",
    seller_evidence: candidates,
  };
}

module.exports = { readTakealotSeller };
