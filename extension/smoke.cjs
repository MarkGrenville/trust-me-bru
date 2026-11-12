// Optional native-Chrome integration check. All writes go to a disposable
// loopback fixture server. No live retailer is contacted and the real log is read-only.
const { chromium } = require("../site/node_modules/playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const { listingCheck } = require("../site/lib/check.ts");
const { money, percent } = require("../site/lib/format.ts");

(async () => {
  const root = path.resolve(__dirname, ".."),
    scratch = path.join(root, ".playwright-mcp/extension-test");
  await fs.mkdir(scratch, { recursive: true });
  const watchlist = JSON.parse(
    await fs.readFile(path.join(root, "data/watchlist.json"), "utf8"),
  );
  const stores = JSON.parse(
    await fs.readFile(path.join(root, "data/stores.json"), "utf8"),
  );
  const log = await fs.readFile(
    path.join(root, "data/observations.jsonl"),
    "utf8",
  );
  const observations = log.trim().split("\n").map(JSON.parse);
  const references = JSON.parse(
    await fs
      .readFile(path.join(root, "data/reference-history.json"), "utf8")
      .catch((error) => {
        if (error.code === "ENOENT") return '{"entries":[]}';
        throw error;
      }),
  ).entries;
  const selected = ["xbox-series-x", "tcl-65c6k", "hisense-58a6n"].map((id) =>
    watchlist.find((p) => p.id === id),
  );
  const reading = observations.find(
    (o) =>
      o.product_id === "xbox-series-x" &&
      o.store === "takealot" &&
      o.observed_at.startsWith("2026-11-11"),
  );
  const day = new Date(Date.now() + 7200000).toISOString().slice(0, 10),
    posts = [],
    visits = [];
  const dataset = {
    products: watchlist,
    stores,
    observations,
    references,
    date: day,
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/collection")
      res.end(
        JSON.stringify({
          day,
          products: selected.map((p) => ({
            ...p,
            stores: { takealot: p.stores.takealot },
          })),
          stores: [{ key: "takealot", status: "tracked" }],
          completed: [],
        }),
      );
    else if (req.url.startsWith("/api/check?")) {
      const url = new URL(req.url, "http://localhost").searchParams.get("url");
      const product = watchlist.find((p) =>
        Object.values(p.stores).includes(url),
      );
      const store =
        product &&
        Object.keys(product.stores).find((s) => product.stores[s] === url);
      res.end(
        JSON.stringify(
          product
            ? listingCheck(dataset, product, store, day)
            : { watched: false },
        ),
      );
    } else if (req.url === "/api/observe" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      posts.push(JSON.parse(body));
      res.writeHead(201);
      res.end('{"ok":true}');
    } else {
      res.writeHead(404);
      res.end("{}");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port,
    extension = path.join(scratch, "unpacked");
  await fs.mkdir(extension, { recursive: true });
  for (const file of [
    "manifest.json",
    "background.mjs",
    "core.mjs",
    "reader.mjs",
    "content.js",
    "popup.html",
    "popup.css",
    "popup.mjs",
  ])
    await fs.copyFile(path.join(__dirname, file), path.join(extension, file));
  await fs.cp(path.join(__dirname, "assets"), path.join(extension, "assets"), {
    recursive: true,
  });
  const core = await fs.readFile(path.join(extension, "core.mjs"), "utf8");
  await fs.writeFile(
    path.join(extension, "core.mjs"),
    core.replace("http://127.0.0.1:3210", `http://127.0.0.1:${port}`),
  );
  const manifest = JSON.parse(
    await fs.readFile(path.join(extension, "manifest.json"), "utf8"),
  );
  manifest.host_permissions.push(`http://127.0.0.1:${port}/*`);
  await fs.writeFile(
    path.join(extension, "manifest.json"),
    JSON.stringify(manifest),
  );
  let context;
  try {
    const profile = await fs.mkdtemp(path.join(scratch, "profile-"));
    context = await chromium.launchPersistentContext(profile, {
      channel: "chromium",
      headless: true,
      viewport: { width: 1280, height: 1000 },
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    });
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker"));
    const id = worker.url().split("/")[2];
    // Explicitly abort every external request except our local fixture document.
    await context.route("**/*", (route) => {
      const url = route.request().url();
      if (
        url.startsWith(`http://127.0.0.1:${port}/`) ||
        url.startsWith("chrome-extension://")
      )
        return route.continue();
      if (
        !url.startsWith("https://www.takealot.com/") &&
        !url.startsWith("https://www.hificorp.co.za/")
      )
        return route.abort();
      if (url.startsWith("https://www.hificorp.co.za/")) {
        const product = watchlist.find((p) => p.id === "hisense-hs5100");
        return route.fulfill({
          contentType: "text/html",
          body: `<style>.price-label{display:none}.regular::after{content:"Normal Price"}</style><h1>Test fixture</h1><script type="application/ld+json">${JSON.stringify({ "@type": "Product", gtin: product.gtin, offers: { price: 5999, priceCurrency: "ZAR", availability: "https://schema.org/InStock", seller: { name: "HiFi Corp" } } })}</script><div class="product-info-price"><span class="price-container regular"><span class="price-label">Regular Price</span><span data-price-type="oldPrice"><span class="price">R8,999</span></span></span><span data-price-type="finalPrice"><span class="price">R5,999</span></span><span>with +more</span></div>`,
        });
      }
      visits.push({ url, at: Date.now() });
      const blocked = url === selected[1].stores.takealot;
      return route.fulfill({
        contentType: "text/html",
        body: blocked
          ? "<h1>Are you a human?</h1><p>Press and hold to confirm.</p>"
          : `<html><body style="background:#eee;font-family:monospace;padding:70px"><h1>Xbox Series X</h1><p>TEST FIXTURE / NO PRICES SAVED</p><div data-ref="buybox-offer"><div data-ref="price"><span class="currency">R 18,999</span><span class="list-price"><span class="currency">R 21,999</span></span></div></div><div data-ref="stock-info-container"><div data-ref="stock-availability-status">In stock</div></div><div class="pdp-module_seller-detail"><div class="seller-information">Sold by The Cool Shop</div></div></body></html>`,
      });
    });
    const page = await context.newPage();
    for (const [productId, store] of [
      ["hisense-hs5100", "hificorp"],
      ["sony-wh-1000xm5-silver", "takealot"],
    ]) {
      const product = watchlist.find((p) => p.id === productId);
      const expected = listingCheck(dataset, product, store, day);
      await page.goto(product.stores[store]);
      if (store === "hificorp") {
        const { readProduct } = await import("./reader.mjs");
        const capture = await page.evaluate(readProduct, {
          product,
          store,
          url: product.stores[store],
        });
        assert.equal(capture.reading.was_label, "Normal Price");
        assert.equal(
          capture.reading.was_label_note,
          "Page code: Regular Price. Shopper-visible label: Normal Price.",
        );
      }
      const panel = page.locator("#trust-me-bru-slip");
      await panel
        .getByText(expected.verdict.stamp || "TOO EARLY TO SAY", {
          exact: true,
        })
        .waitFor();
      await panel.getByText(/recorded 11 Nov 2026/).waitFor();
      await panel
        .getByText(
          "Older collection. This is a recorded price, not a live quote.",
        )
        .waitFor();
      assert.equal(await panel.getByText(/No reading/).count(), 0);
      await page.screenshot({ path: path.join(scratch, `${productId}.png`) });
    }
    await page.goto(selected[0].stores.takealot);
    const xboxVerdict = listingCheck(
      dataset,
      selected[0],
      "takealot",
      day,
    ).verdict;
    const xboxPanel = page.locator("#trust-me-bru-slip");
    if (xboxVerdict.increase) {
      await xboxPanel
        .getByText(
          `Price up ${money(xboxVerdict.increase.amount)} (${percent(xboxVerdict.increase.percent)}).`,
          { exact: true },
        )
        .waitFor();
    } else {
      await xboxPanel
        .getByText(xboxVerdict.stamp || "TOO EARLY TO SAY", { exact: true })
        .waitFor();
    }
    await page.screenshot({ path: path.join(scratch, "panel.png") });
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup
      .getByRole("button", { name: "Collect today's prices" })
      .waitFor();
    await popup.screenshot({ path: path.join(scratch, "popup.png") });
    const beforeCollection = visits.length;
    await popup.getByRole("button", { name: "Collect today's prices" }).click();
    await popup
      .getByRole("button", { name: "Stop collection", exact: true })
      .waitFor();
    await popup.close();
    let state;
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
      state = await worker.evaluate(
        async () => (await chrome.storage.local.get("collection")).collection,
      );
      if (state && !state.running) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.ok(
      state && !state.running,
      "Collection completes with popup closed",
    );
    assert.deepEqual(
      state.queue.map((t) => t.status),
      ["saved", "failed", "stopped"],
    );
    assert.equal(posts.length, 1);
    assert.equal(posts[0].seller, "The Cool Shop");
    const runVisits = visits.slice(beforeCollection);
    assert.equal(runVisits.length, 2);
    assert.ok(runVisits[1].at - runVisits[0].at >= 20000);
    assert.equal(
      await fs.readFile(path.join(root, "data/observations.jsonl"), "utf8"),
      log,
      "Real price log unchanged",
    );
    const result = {
      checked_at: new Date().toISOString(),
      browser: "Chrome for Testing, Manifest V3 loaded unpacked",
      fixture_only: true,
      production_log_changed: false,
      same_store_delay_ms: runVisits[1].at - runVisits[0].at,
      checks: [
        "Panel uses website verdict and dated basis; price increase when a reference is available",
        "HiFi CSS-visible Normal Price is used; hidden Regular Price is preserved as a note",
        "HS5100 HiFi and silver XM5 Takealot retain their dated verdict during a newer partial collection",
        "Collection continues after popup closes",
        "One owned background tab at a time",
        "Same-store pacing at least 20 seconds",
        "Main offer seller captured",
        "Human check stops store; third offer not visited",
        "All POSTs go to disposable fixture server",
      ],
      queue: state.queue.map((t) => ({
        key: t.key,
        status: t.status,
        reason: t.reason,
      })),
    };
    await fs.writeFile(
      path.join(scratch, "result.json"),
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (context) await context.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
