(() => {
  let lastUrl = "",
    host,
    disposed = false;
  const face = new FontFace(
    "TrustMeBruReceipt",
    `url("${chrome.runtime.getURL("assets/mono.woff2")}")`,
  );
  face
    .load()
    .then((font) => document.fonts.add(font))
    .catch(() => {});
  const money = (n) =>
    n == null
      ? "—"
      : "R" +
        Number(n).toLocaleString("en-GB", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  const pct = (n) => (n == null ? "—" : Number(n).toFixed(1) + "%");
  const date = (d) =>
    d
      ? new Date(d.slice(0, 10) + "T12:00:00+02:00").toLocaleDateString(
          "en-ZA",
          { day: "numeric", month: "short", year: "numeric" },
        )
      : "—";
  const label = (o) => o.was_label || "Crossed-out price (label not recorded)";
  function panel() {
    host?.remove();
    host = document.createElement("div");
    host.id = "trust-me-bru-slip";
    // Reset the host too: shop styles must not move or hide the receipt.
    host.style.cssText =
      "all:initial!important;position:fixed!important;bottom:16px!important;right:16px!important;z-index:2147483647!important;display:block!important";
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `*{box-sizing:border-box}details{font:11px/1.5 TrustMeBruReceipt,monospace;color:#24251f;background:#f5f2e9;width:min(310px,calc(100vw - 32px));box-shadow:0 5px 28px #0005;padding:16px;border-bottom:3px dashed #24251f}summary{cursor:pointer;letter-spacing:1px;font-size:14px}article{max-height:65vh;overflow:auto;padding-top:10px}h2{font-size:13px;font-weight:400;margin:0 0 12px}p{margin:9px 0}strong{font-weight:600}.price{font-size:25px;text-align:right}.row{display:flex;justify-content:space-between;gap:12px}.stamp{color:#b93227;border:2px solid;padding:6px;transform:rotate(-3deg);font-size:18px;text-align:center;margin:16px 6px 12px}.basis{font-size:10px}section{border-top:1px dashed;margin-top:12px;padding-top:6px}a{color:inherit}svg{width:100%;height:75px}small{display:block;font-size:10px}summary:focus-visible,a:focus-visible{outline:2px solid #b93227;outline-offset:2px}ul{padding-left:15px}li{margin:7px 0}.quiet{font:11px TrustMeBruReceipt,monospace;background:#f5f2e9;color:#24251f;padding:10px}`;
    root.append(style);
    document.documentElement.append(host);
    return root;
  }
  const el = (tag, value, cls) => {
    const node = document.createElement(tag);
    if (value != null) node.textContent = value;
    if (cls) node.className = cls;
    return node;
  };
  function graph(parent, data) {
    const own = data.history || [];
    const refs = data.reference_history || [];
    const all = [
      ...own.map((o) => ({ date: o.observed_at.slice(0, 10), price: o.price })),
      ...refs.flatMap((r) => [
        ...(r.context_point_before_window
          ? [r.context_point_before_window]
          : []),
        ...r.history,
      ]),
    ];
    if (!all.length) return;
    const ns = "http://www.w3.org/2000/svg",
      svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 270 75");
    svg.setAttribute("role", "img");
    svg.setAttribute(
      "aria-label",
      "Dated price observations. Tracker points are isolated; no change date inferred.",
    );
    const times = all.map((p) => Date.parse(p.date)),
      prices = all
        .map((p) => p.price)
        .concat(own.map((o) => o.was_price).filter((n) => n != null));
    const lo = Math.min(...times),
      hi = Math.max(...times),
      min = Math.min(...prices),
      max = Math.max(...prices);
    const x = (d) =>
      10 + ((Date.parse(d.slice(0, 10)) - lo) / Math.max(hi - lo, 1)) * 250;
    const y = (p) => 65 - ((p - min) / Math.max(max - min, 1)) * 55;
    const shape = (tag, attrs) => {
      const n = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      svg.append(n);
      return n;
    };
    function series(rows, dashed = false) {
      const points = rows.slice().sort((a, b) => a.date.localeCompare(b.date));
      if (points.length > 1)
        shape("polyline", {
          points: points.map((p) => `${x(p.date)},${y(p.price)}`).join(" "),
          fill: "none",
          stroke: "#24251f",
          "stroke-width": 1.3,
          ...(dashed ? { "stroke-dasharray": "3 3" } : {}),
        });
      for (const p of points) {
        const dot = shape("circle", {
          cx: x(p.date),
          cy: y(p.price),
          r: 2,
          fill: "#24251f",
        });
        dot.append(
          el(
            "title",
            `${date(p.date)}: ${money(p.price)} · ${dashed ? "comparison" : "our reading"}`,
          ),
        );
      }
    }
    series(
      own.map((o) => ({ date: o.observed_at.slice(0, 10), price: o.price })),
    );
    series(
      own
        .filter((o) => o.was_price != null)
        .map((o) => ({ date: o.observed_at.slice(0, 10), price: o.was_price })),
      true,
    );
    // Monthly third-party observations must NEVER be joined by a line.
    for (const r of refs)
      for (const p of [
        ...(r.context_point_before_window
          ? [r.context_point_before_window]
          : []),
        ...r.history,
      ]) {
        const dot = shape("circle", {
          cx: x(p.date),
          cy: y(p.price),
          r: 3,
          fill: "#f5f2e9",
          stroke: "#b93227",
          "stroke-width": 1.5,
        });
        dot.append(
          el("title", `${date(p.date)}: ${money(p.price)} · ${r.source}`),
        );
      }
    parent.append(
      svg,
      el(
        "small",
        "Solid: our price · dashed: store comparison · red points: tracker.",
      ),
    );
    const details = el("details"),
      summary = el("summary", "Exact chart values");
    details.append(summary);
    const list = el("ul");
    for (const p of own)
      list.append(
        el(
          "li",
          `${date(p.observed_at)} · ${money(p.price)} ${p.promo_label || ""} · ${label(p)} ${money(p.was_price)} · our reading`,
        ),
      );
    for (const r of refs) {
      for (const p of [
        ...(r.context_point_before_window
          ? [r.context_point_before_window]
          : []),
        ...r.history,
      ])
        list.append(
          el("li", `${date(p.date)} · ${money(p.price)} · ${r.source}`),
        );
      parent.append(el("small", r.credit_line));
    }
    details.style.width = "auto";
    details.style.boxShadow = "none";
    details.style.padding = "4px 0";
    details.append(list);
    parent.append(details);
  }
  function render(data) {
    const root = panel();
    if (!data.watched) {
      root.append(el("div", "Not on the watchlist", "quiet"));
      return;
    }
    const box = el("details");
    box.open = true;
    box.append(el("summary", "TRUST ME BRU"));
    const body = el("article");
    box.append(body);
    root.append(box);
    body.append(
      el("h2", data.product.name),
      el(
        "small",
        `${data.stores?.find((s) => s.key === data.store)?.display_name || data.store}${data.as_of ? ` · recorded ${date(data.as_of)}` : " · no readings yet"}`,
      ),
    );
    if (data.stale)
      body.append(
        el(
          "p",
          "Older collection. This is a recorded price, not a live quote.",
        ),
      );
    const o = data.reading,
      v = data.verdict;
    if (o && v) {
      body.append(el("p", money(o.price), "price"));
      if (o.promo_label) body.append(el("p", o.promo_label));
      if (!o.in_stock) body.append(el("p", "Out of stock."));
      if (o.seller)
        body.append(
          el(
            "small",
            `Sold by ${o.seller}${o.is_marketplace ? " · marketplace offer" : ""}`,
          ),
        );
      else
        body.append(
          el("small", "Seller unconfirmed; excluded from the board."),
        );
      const members = /\+more|member|xtra savings|smart shopper/i.test(
        o.promo_label || "",
      );
      body.append(
        el(
          "p",
          `Claimed${members ? " · members" : ""}: ${pct(v.claimed)}. We saw: ${pct(v.real)}.`,
        ),
      );
      if (o.was_price != null)
        body.append(el("p", `${label(o)}: ${money(o.was_price)}.`));
      body.append(
        el(
          "div",
          v.stamp ||
            (v.claimed == null
              ? "NO SAVING CLAIMED"
              : !o.in_stock
                ? "OUT OF STOCK"
                : "TOO EARLY TO SAY"),
          "stamp",
        ),
      );
      const r = v.reference;
      body.append(
        el(
          "p",
          v.stamp
            ? r
              ? `Against ${money(r.price)} on ${date(r.date)} · ${r.source}, monthly points`
              : `Against our own readings since ${date(v.firstSeen)}`
            : `Tracked since ${date(v.firstSeen)}`,
          "basis",
        ),
      );
      if (v.increase)
        body.append(
          el(
            "p",
            `Price up ${money(v.increase.amount)} (${pct(v.increase.percent)}).`,
          ),
        );
      if (r) {
        body.append(
          el(
            "p",
            r.next
              ? `Next point: ${date(r.next.date)}, ${money(r.next.price)}.`
              : "No later point supplied by the tracker.",
          ),
        );
        body.append(
          el(
            "small",
            "Monthly points do not establish the exact reduction date. The tracker does not record conditions or sellers; comparison with member offers is qualified.",
          ),
        );
      }
      if (
        v.trackerHighest &&
        o.was_price != null &&
        o.was_price > v.trackerHighest.price
      ) {
        const h = v.trackerHighest;
        body.append(
          el(
            "p",
            `${label(o)}: ${money(o.was_price)}. Highest ${h.source} shows: ${money(h.price)}. Tracker summary date range unspecified.`,
          ),
        );
      }
      body.append(el("small", `Tracked since ${date(v.firstSeen)}.`));
    } else
      body.append(
        el(
          "p",
          "No reading recorded for this offer yet. Collect today’s prices from the extension button.",
        ),
      );
    graph(body, data);
    const others = el("section");
    others.append(el("small", `OTHER STORES · ${date(data.as_of)}`));
    for (const other of data.other_stores || []) {
      others.append(
        el(
          "p",
          `${data.stores?.find((s) => s.key === other.store)?.display_name || other.store}: ${money(other.price)} ${other.promo_label || ""}`,
        ),
        el(
          "small",
          `${label(other)}: ${money(other.was_price)}${other.in_stock ? "" : " · out of stock"}`,
        ),
      );
    }
    if (!data.other_stores?.length)
      others.append(el("p", "No other store reading on this date."));
    body.append(others);
    const link = el("a", "Full receipt");
    link.href = `http://127.0.0.1:3210/p/${encodeURIComponent(data.product.id)}`;
    link.target = "_blank";
    link.rel = "noreferrer";
    body.append(link);
  }
  async function update(force = false) {
    if (disposed || (!force && lastUrl === location.href)) return;
    lastUrl = location.href;
    host?.remove();
    try {
      const result = await chrome.runtime.sendMessage({ type: "check" });
      if (lastUrl !== location.href) return;
      if (!result.ok) throw Error(result.error);
      // Category/home pages stay quiet. Unwatched product pages get one line.
      if (
        result.data.watched ||
        (document.querySelector("h1") &&
          (/\/PLID|\/p\//.test(location.pathname) ||
            document.querySelector(
              '.product-info-price, [class*="pdp-main-price"], [class^="cms-price-display-container"]',
            )))
      )
        render(result.data);
    } catch {
      if (
        document.querySelector(
          '.product-info-price, [data-ref="buybox"], [class*="pdp-main-price"]',
        )
      )
        panel().append(
          el("div", "Trust Me Bru · local price checker offline", "quiet"),
        );
    }
  }
  update();
  // SPA navigation and newly saved readings. No page navigation or price writes.
  const timer = setInterval(() => update(), 1500);
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.collection) update(true);
  });
  addEventListener(
    "pagehide",
    () => {
      clearInterval(timer);
      disposed = true;
    },
    { once: true },
  );
})();
