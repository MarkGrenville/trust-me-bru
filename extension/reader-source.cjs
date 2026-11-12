// This function is serialized with the shared seller reader into reader.mjs.
// It runs once in the public page's MAIN world. No requests, clicks or writes.
function readProduct(task) {
  /* SELLER_READER */
  const doc = document;
  const text = (e) =>
    (e?.innerText || e?.textContent || "").replace(/\u00a0/g, " ").trim();
  const visible = (e) =>
    e &&
    !e.closest('[hidden], [aria-hidden="true"]') &&
    (typeof e.checkVisibility !== "function" ||
      e.checkVisibility({ checkVisibilityCSS: true }));
  const all = (selector, parent = doc) =>
    [...parent.querySelectorAll(selector)].filter(visible);
  const unique = (selector, parent = doc) => {
    const nodes = all(selector, parent);
    const values = [...new Set(nodes.map(text))];
    if (values.length > 1) throw Error("Conflicting visible main prices.");
    return nodes[0] || null;
  };
  const amount = (value) => {
    const clean = String(value ?? "").replace(/[R,\s]/g, "");
    return /^\d+(?:\.\d{1,2})?$/.test(clean) && Number(clean) > 0
      ? Number(clean)
      : null;
  };
  const body = text(doc.body);
  const prefix = body.split(
    /You Might Also Like|Frequently Bought Together|Alternative Products|Related Products|Customers also bought/i,
  )[0];
  if (
    /are you a human|press (?:and|&) hold|access denied|request blocked|temporarily blocked|403 forbidden|verify (?:that )?you are human|unusual traffic|complete the captcha/i.test(
      body.slice(0, 6000),
    ) ||
    all('iframe[src*="captcha"], iframe[src*="challenge"], #challenge-running')
      .length
  )
    return {
      blocked: true,
      reason: "Human check or block. Store stopped; no retry.",
    };
  try {
    if (location.href !== task.url)
      throw Error("Page redirected or selected variant changed.");
    if (!text(doc.querySelector("h1")))
      throw Error("Product heading not loaded.");
    if (/Select an option|Select a colour/i.test(prefix))
      throw Error("Product variant not selected.");
    const products = [];
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(walk);
      if ([node["@type"]].flat().includes("Product")) products.push(node);
      if (node["@graph"]) walk(node["@graph"]);
    };
    for (const script of doc.querySelectorAll(
      'script[type="application/ld+json"]',
    )) {
      try {
        walk(JSON.parse(script.textContent));
      } catch {
        /* malformed unrelated metadata */
      }
    }
    let price,
      was = null,
      wasLabel = null,
      stock,
      seller = null,
      marketplace = null;
    let wasLabelNote = null;
    let condition = null,
      evidence = {},
      offer;
    if (task.store === "takealot") {
      const offers = all('[data-ref="buybox-offer"]');
      const active = offers.filter(
        (e) =>
          e.className.includes("_active_") || e.classList.contains("active"),
      );
      const main =
        active.length === 1
          ? active[0]
          : offers.length === 1
            ? offers[0]
            : null;
      if (!main) throw Error("Selected main offer is ambiguous.");
      const box = main.querySelector('[data-ref="price"]');
      price = amount(text(box?.querySelector(":scope > .currency")));
      const old = box?.querySelector('[class*="list-price"] .currency');
      if (old && !(was = amount(text(old))))
        throw Error("Unreadable List Price.");
      wasLabel = old ? "List Price" : null;
      const status = text(
        unique(
          '[data-ref="stock-info-container"] [data-ref="stock-availability-status"]',
        ),
      );
      stock = /out of stock|unavailable/i.test(status)
        ? false
        : /\bIn stock\b|Ships in|Only \d+ left/i.test(status)
          ? true
          : undefined;
      const identity = readTakealotSeller(doc);
      seller = identity.seller;
      marketplace = identity.is_marketplace;
      evidence = identity;
      if (/with\s*\+more|member price/i.test(text(main)))
        throw Error(
          "Unrecognised conditional Takealot offer; review manually.",
        );
    } else if (task.store === "pnp") {
      const node = unique(
        'cms-product-summary [class^="cms-price-display-container"]',
      );
      const values = text(node).match(/R\s*[\d,]+(?:\.\d{2})?/g) || [];
      if (values.length !== 1) throw Error("PnP main price ambiguous.");
      price = amount(values[0]);
      const cart = all(
        "cx-page-slot.BodyContentSlot-RightHandSide button",
      ).filter((e) => /^add to (?:cart|trolley)$/i.test(text(e)));
      if (
        !cart.length ||
        cart[0].disabled ||
        cart[0].getAttribute("aria-disabled") === "true"
      )
        throw Error("PnP stock not established.");
      if (
        /smart shopper|\b\d+ for R|buy \d+/i.test(
          text(node.closest("cx-page-slot")),
        )
      )
        throw Error("Conditional PnP offer needs manual review.");
      if (
        task.product.gtin &&
        !doc.body.textContent.includes(task.product.gtin)
      )
        throw Error("PnP barcode not visible; exact pack not confirmed.");
      stock = true;
      seller = "Pick n Pay";
      marketplace = false;
    } else {
      const candidates = products.filter((p) => p.offers);
      if (candidates.length !== 1)
        throw Error("Product offer structured data missing or ambiguous.");
      const product = candidates[0];
      const gtin =
        product.gtin ||
        product.gtin13 ||
        product.gtin14 ||
        product.gtin12 ||
        product.gtin8;
      if (
        task.product.gtin &&
        gtin &&
        String(gtin).padStart(14, "0") !==
          String(task.product.gtin).padStart(14, "0")
      )
        throw Error("GTIN differs from watched product.");
      const offers = [product.offers].flat().filter(Boolean);
      if (offers.length !== 1 || offers[0].priceCurrency !== "ZAR")
        throw Error("Offer missing, ambiguous or not ZAR.");
      offer = offers[0];
      price = amount(offer.price);
      const availability = String(offer.availability).split("/").at(-1);
      stock = ["InStock", "LimitedAvailability"].includes(availability)
        ? true
        : ["OutOfStock", "SoldOut", "PreOrder", "BackOrder"].includes(
              availability,
            )
          ? false
          : undefined;
      seller = offer.seller?.name || null;
      const expected = {
        incredible: /incredible/i,
        hificorp: /hifi/i,
        hirschs: /hirsch/i,
        checkers: /checkers/i,
      }[task.store];
      marketplace = seller && expected ? !expected.test(seller) : null;
      if (task.store === "checkers") {
        const node = unique('[class*="pdp-main-price"]');
        const shown = amount(text(node));
        if (!shown) throw Error("Visible grocery price missing.");
        const old = unique(
          '[class*="discounted-price"], [class*="old-price"], [class*="original-price"]',
          node.parentElement,
        );
        if (old && !(was = amount(text(old))))
          throw Error("Grocery comparison unreadable.");
        if (price !== shown && price !== was)
          throw Error("Structured and visible grocery prices disagree.");
        price = shown;
        const groceryMain = text(
          node.closest('[class*="product-content"]') || node.parentElement,
        ).split(/In case your|Related Products/)[0];
        const labels =
          groceryMain.match(
            /Xtra Savings[^\n]*|Buy \d+[^\n]+|\d+ for R[^\n]+|Deal expires[^\n]+/gi,
          ) || [];
        if (
          /member-promo/.test(node.className) &&
          !labels.some((l) => /Xtra Savings|member/i.test(l))
        )
          labels.unshift("member price");
        condition = labels.join("; ").slice(0, 500) || null;
      } else {
        const box = unique(".product-info-price");
        if (!box) throw Error("Main price block missing.");
        const current =
          unique('[data-price-type="finalPrice"] .price', box) ||
          unique('[data-price-type="basePrice"] .price', box);
        if (price !== amount(text(current)))
          throw Error("Structured and visible main prices disagree.");
        const old = unique('[data-price-type="oldPrice"] .price', box);
        if (old && !(was = amount(text(old))))
          throw Error("Comparison price unreadable.");
        const label = text(box);
        if (task.store === "incredible" || task.store === "hificorp") {
          const oldLabel = old
            ?.closest(".price-container")
            ?.querySelector(".price-label")
            ?.textContent?.trim();
          // innerText omits CSS-generated wording; read visible pseudo-elements
          // too. A hidden .price-label is evidence, never the displayed label.
          const elements = [box, ...all("*", box)];
          const visibleWords = elements
            .flatMap((e) =>
              [...e.childNodes]
                .filter((n) => n.nodeType === 3)
                .map((n) => n.textContent),
            )
            .join(" ");
          const generatedWords =
            typeof getComputedStyle === "function"
              ? elements.flatMap((e) =>
                  ["::before", "::after"].map((pseudo) => {
                    const style = getComputedStyle(e, pseudo);
                    return style.display !== "none" &&
                      style.visibility !== "hidden"
                      ? style.content
                      : "";
                  }),
                )
              : [];
          const shown = [visibleWords, ...generatedWords].join(" ");
          wasLabel = was
            ? /Normal Price/i.test(shown)
              ? "Normal Price"
              : /Regular Price/i.test(shown)
                ? "Regular Price"
                : null
            : null;
          if (was && oldLabel && oldLabel !== wasLabel)
            wasLabelNote = `Page code: ${oldLabel}. ${wasLabel ? `Shopper-visible label: ${wasLabel}.` : "No shopper-visible label captured."}`;
          const more =
            /\+more/i.test(label) ||
            all('.plusmore-text, img[alt*="more"], img[src*="more"]', box)
              .length > 0;
          if (
            was &&
            !more &&
            (/\bOR\b/.test(label) || all(".plusmore-price.special", box).length)
          )
            throw Error("Member offer condition not established.");
          condition = more ? "with +more" : null;
          const ends = /Sale ends[^\n]+/i.exec(label)?.[0];
          if (ends) condition = [condition, ends].filter(Boolean).join("; ");
        } else {
          if (was && !/\bwas\b/i.test(label))
            throw Error("Comparison label not established.");
          wasLabel = was ? "was" : null;
        }
      }
    }
    if (!price || typeof stock !== "boolean" || (was !== null && was < price))
      throw Error("Price, comparison or stock not established.");
    return {
      reading: {
        product_id: task.product.id,
        store: task.store,
        observed_at: new Date(Date.now() + 7200000)
          .toISOString()
          .replace("Z", "+02:00"),
        price,
        was_price: was,
        was_label: wasLabel,
        was_label_note: wasLabelNote,
        claimed_pct: null,
        promo_label: condition,
        in_stock: stock,
        url: task.url,
        source: "extension",
        seller,
        is_marketplace: marketplace,
      },
      evidence,
    };
  } catch (error) {
    return { reason: error.message };
  }
}
module.exports = { readProduct };
