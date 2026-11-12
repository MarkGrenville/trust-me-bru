// Read a single already-open watched page. No navigation or writes.
async function captureTakealotPage(page, watchlist, readTakealotSeller) {
  const product = watchlist.find((p) => p.stores.takealot === page.url());
  if (!product) throw new Error("Not an exact watched Takealot URL/variant.");
  const blocked = await page.evaluate(() =>
    /are you a human|press and hold|captcha|access denied/i.test(
      document.body.innerText.slice(0, 3000),
    ),
  );
  if (blocked)
    return {
      reading: null,
      stop_store: true,
      reason: "Human check or block. Stop Takealot; do not retry.",
    };
  try {
    await page.waitForFunction(
      () =>
        [
          ...document.querySelectorAll(
            '[data-ref="buybox-offer"] [data-ref="price"]',
          ),
        ].some((e) => e.checkVisibility()),
      null,
      { timeout: 15000 },
    );
  } catch {
    const blocked = await page.evaluate(() =>
      /are you a human|press and hold|captcha|access denied/i.test(
        document.body.innerText.slice(0, 3000),
      ),
    );
    return {
      reading: null,
      stop_store: blocked,
      reason: blocked
        ? "Human check or block. Stop Takealot; do not retry."
        : "Main offer did not load. No reading saved.",
    };
  }
  // Seller details can hydrate after the price; wait once, without reloading.
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll(".seller-information")].some(
          (e) => e.checkVisibility() && /^Sold\s+by/i.test(e.textContent || ""),
        ),
      null,
      { timeout: 8000 },
    )
    .catch(() => {});
  const blockedAfterLoad = await page.evaluate(() =>
    /are you a human|press and hold|captcha|access denied/i.test(
      document.body.innerText.slice(0, 3000),
    ),
  );
  if (blockedAfterLoad)
    return {
      reading: null,
      stop_store: true,
      reason: "Human check or block. Stop Takealot; do not retry.",
    };
  const identity = await page.evaluate(readTakealotSeller);
  const offer = await page.evaluate(() => {
    const offers = [
      ...document.querySelectorAll('[data-ref="buybox-offer"]'),
    ].filter((e) => e.checkVisibility());
    const active = offers.filter(
      (e) => e.className.includes("_active_") || e.classList.contains("active"),
    );
    const mainOffer =
      active.length === 1 ? active[0] : offers.length === 1 ? offers[0] : null;
    const main = mainOffer?.querySelector('[data-ref="price"]');
    const amount = (text) => {
      const clean = (text || "").replace(/[R,\s]/g, "");
      return /^\d+(?:\.\d{1,2})?$/.test(clean) ? Number(clean) : null;
    };
    const current = main?.querySelector(":scope > .currency");
    const previous = main?.querySelector('[class*="list-price"] .currency');
    const status =
      document.querySelector(
        '[data-ref="stock-info-container"] [data-ref="stock-availability-status"]',
      )?.textContent || "";
    const prefix = document.body.innerText.split(
      /You Might Also Like|Frequently Bought Together/,
    )[0];
    const percent = /(\d+(?:\.\d+)?)\s*%\s*OFF/i.exec(prefix);
    return {
      heading: document.querySelector("h1")?.textContent?.trim(),
      price: amount(current?.textContent),
      was_price: previous ? amount(previous.textContent) : null,
      was_unreadable: !!previous && amount(previous.textContent) === null,
      was_label: previous ? "List Price" : null,
      claimed_pct: percent ? Number(percent[1]) : null,
      in_stock: /\bIn stock\b|Only \d+ left|Ships in/i.test(status)
        ? true
        : /out of stock|unavailable/i.test(status)
          ? false
          : null,
      price_text: main?.innerText,
      stock_text: status,
      variant_unselected: /Select an option|Select a colour/i.test(prefix),
    };
  });
  if (
    !offer.heading ||
    offer.price === null ||
    offer.was_unreadable ||
    offer.in_stock === null ||
    offer.variant_unselected
  )
    return {
      reading: null,
      stop_store: false,
      reason: "Price, stock, or selected variant not established.",
      offer,
      seller_capture: identity,
    };
  const observed_at = new Date(Date.now() + 2 * 60 * 60 * 1000)
    .toISOString()
    .replace("Z", "+02:00");
  return {
    reading: {
      product_id: product.id,
      store: "takealot",
      observed_at,
      price: offer.price,
      was_price: offer.was_price,
      was_label: offer.was_label,
      claimed_pct: offer.claimed_pct,
      promo_label: null,
      in_stock: offer.in_stock,
      url: page.url(),
      source: "codex-browser",
      seller: identity.seller,
      is_marketplace: identity.is_marketplace,
    },
    seller_capture: identity,
    evidence: {
      url: page.url(),
      heading: offer.heading,
      price_text: offer.price_text,
      stock_text: offer.stock_text,
      was_label_basis:
        "List Price: current list-price element; wording verified on a representative main-offer info tip.",
    },
    stop_store: false,
  };
}

module.exports = { captureTakealotPage };
