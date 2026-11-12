# Trust Me Bru: product brief

Read this before anything else. It is the whole specification. Build only the stage you were asked for.

## What it is

**Trust Me Bru** is a Black Friday price checker for South Africa. A store says "Was R12,999, now R8,999, save 31%". Trust Me Bru has been writing down the real price every day, so it can say what the saving really is. "Trust me bru" is what the store is saying; the product is dry about it and never shouts.

It is a side project by Mark Grenville. It runs on one computer. It is not deployed and has no accounts. It should be real and honest, small, and good-looking. It does not have to be complete.

Three parts:
1. **A watchlist and a price log** kept as plain files in this repo.
2. **A small website** that shows each product's price over time, the claimed saving against the real one, a stamp, and a leaderboard of stores.
3. **A Chrome extension** that shows the same verdict on the store's own product page, and can collect the day's prices itself.

## The numbers

**Corrected 12 Nov 2026 after the Buck Cheap look-up. The earlier wording ("the 30 days before today") was wrong: once a sale has started, the sale price is itself the 30-day low and every saving reads 0%. The comparison is with the price *before the reduction*.**

- **The crossed-out price is the store's word, so use the store's word.** Hirsch's calls it "was". Incredible Connection and HiFi Corp call it "Normal Price" (next to a lower member price). Takealot strikes a price through; record what its info tip calls it (it has been described as a list price, the supplier's recommended price, not a price Takealot necessarily charged). Store it per reading as `was_label`, and show that label, never a blanket "was".
- **Claimed saving** = (crossed-out price − price now) ÷ crossed-out price.
- **Reference price: what it cost before.**
  - From our own daily readings: find the day today's price began (the reduction). The reference is the lowest price in the 30 days before that day. If today's price has already held for 30 days or more, the reference is today's price.
  - From `data/reference-history.json` (Buck Cheap's points are monthly, on the 1st): the reference is the latest point at least 30 days before today, e.g. "1 Oct". Always shown as "on 1 Oct it was R…, Buck Cheap", with the next point too.
- **Real saving** = (reference − price now) ÷ reference, never below zero. **Gap** = claimed − real, in points.
- **Stamp:** `LEGIT` (gap of 5 points or less), `MEH` (over 5, up to 15), `TRUST ME BRU` (over 15). No claimed saving: no stamp. Thresholds in one config file.
- **No stamp without a "before".** A stamp needs either 14 days of our own readings before the reduction, or a reference point at least 30 days old. Every stamp says what it rests on in one line under it: "against R… on <date> · <tracker>, monthly points" or "against our own readings since 11 Nov". With neither: **"TOO EARLY TO SAY · tracked since <date>"**. On day one our own data stamps nothing. The public copy includes no third-party reference histories; without enough own history, claims say too early to say.
- **One more fact when the tracker has it:** its highest price card. If the store's crossed-out price is above the highest price the tracker shows, say so plainly: "Crossed out: R…. Highest <tracker> shows: R…." No adjective.
- **What can be said on day one for everything: the stores don't agree on the crossed-out price.** For a product at two or more stores, show each store's price and crossed-out price side by side. The **spread** of a store's reading = its crossed-out price ÷ the lowest crossed-out price any store shows for that product today − 1. Our first readings (11 Nov 2026): the Hisense HS5100 soundbar is R2,499 at four stores (R2,499.99 at Hirsch's); crossed out R3,999 at two, R3,499 at one, R2,699.99 at another. Each store may be telling the truth about its own earlier price, which is why the page shows the history next to it.
- **Conditions are part of the price.** A reading with a condition is always shown with it ("R5,999 with +more") and its claimed saving is labelled "members". The tracker does not record conditions; say that wherever its numbers sit next to member prices.
- **Leaderboard:** per store, over its tracked products that claim a saving today: how many, the average claimed saving, the average spread (only products another store also sells), how many claims need a membership, and, for the products that have a "before", how many came out LEGIT, MEH and TRUST ME BRU with the average gap. Always with the sample size and dates. Fewer than 5 products in a column: "not enough data". It is a sample of sixty products, and the page says so at the top.

The 30-days-before-the-reduction rule is the one the EU uses for "was" prices. South Africa has no such rule that we could find. The `/how` page says both things plainly, and says where this site falls short of it (monthly reference points, two weeks of our own data).

## Data (plain files, committed)

- `data/watchlist.json`: about 60 products. Each: `id`, `name`, `brand`, `model`, `category`, optional `gtin`, and `stores`: a map of store key to that product's page URL. Only list a store when it is the same model, confirmed on the page.
- `data/observations.jsonl`: append-only, one line per reading: `product_id`, `store`, `observed_at` (ISO, +02:00), `price`, `was_price` or null, `was_label` (the shopper-visible word for it) or null, optional `was_label_note` for a different label in page code, `claimed_pct` or null, `promo_label` or null, `in_stock`, `url`, `source` (`codex-browser` or `extension`).
- `data/reference-history.json` (optional, omitted from the public copy): older prices looked up by hand on other trackers (Buck Cheap, Serval). Each entry carries `source`, `source_url`, `looked_up_at` and a credit line. Never merged into our own observations. Wherever it is drawn or used, it is labelled with its source.
- `data/stores.json`: every store: key, display name, home URL, status (`tracked` or `human-check`), how its price is read.

Stores: Takealot, Makro, Game, Incredible Connection, HiFi Corp, Checkers, plus two alternates, Hirsch's (hirschs.co.za) and Pick n Pay (pnp.co.za).

What the first check found (11 Nov 2026, a fresh automated Chrome): Takealot, Incredible Connection, HiFi Corp and Checkers load and show prices. **Makro and Game both answer with "Are you a human? Press and hold".** So: try Makro and Game once more at the start of the watchlist, one page each. If the check appears again, they stay in `data/stores.json` with `"status": "human-check"` and the date, they get no products and no readings, and the site lists them as "asks if you're human, so not tracked". The two alternates take their place if they load. Takealot has no JSON-LD: read its visible price and struck-through price, and keep marketplace sellers apart from Takealot's own offer. Incredible Connection and HiFi Corp show the claim as "Normal Price" text, not a struck-through number; HiFi Corp's "with +more" is a condition on the price and is recorded in `promo_label`.

Categories: TVs, soundbars and speakers, headphones, consoles, phones, air fryers and small appliances, and about ten grocery staples (Checkers only is fine).

## Reading prices: the rules

- Public product pages only. No login, no cart, no account, no search-result scraping at volume.
- **Slow and polite:** at most one page per store every 20–30 seconds (random within that), one reading per product per store per day. Different stores may be interleaved.
- Read the price the way a person would see it: structured data on the page first (JSON-LD `Product`/`Offer`), then the visible price and struck-through "was" price.
- **If a store shows a bot check, a block page or a captcha: stop for that store, write it down, move on.** Never solve a captcha, never use proxies, never fake headers or fingerprints, never hammer a retry. A blocked store is recorded, not worked around.
- **Never invent, estimate or carry forward a price.** If a page can't be read, record nothing for it and log why.
- Out-of-stock and marketplace (third-party seller) prices are recorded as such and left out of the leaderboard.

## The website (`site/`)

- Next.js (App Router, TypeScript), Tailwind. Reads the files in `data/`. No database, no accounts, no analytics, no outside services. Turn off the Next.js dev badge (`devIndicators: false`).
- `/`: a search box, then "Same price, different crossed-out price" (the widest spreads today), then the looked-up products with their stamps, then, once there is history, today's biggest gaps and today's honest deals.
- `/p/[id]`: the product, every store's price, "was" and condition side by side, a price graph per store (the "was" price drawn as a dashed line, reference history drawn in a different style and labelled), claimed against real, the stamp, a per-store table, "tracked since".
- `/board`: the leaderboard.
- `/how`: how it is measured, where the data comes from, what it can't tell you, and the other South African trackers worth knowing (Buck Cheap, Serval, PriceCheck).
- `POST /api/observe`: accepts readings from the extension and appends them to `data/observations.jsonl`. Loopback only, validates every field, refuses a second reading for the same product, store and day.
- `GET /api/check?url=`: the verdict for one product page, for the extension.
- Port 3210, bound to loopback on this computer.

## The extension (`extension/`, Manifest V3)

- On a watched product page at one of the tracked stores: a small till-slip panel in the corner with the claimed saving, what the other stores quote as the "was" for the same product, the real saving and stamp once there is history (otherwise "too early to say"), a tiny graph and "tracked since". On an unwatched product: one quiet line, "Not on the watchlist".
- Popup: **Collect today's prices**. Opens each watchlist page in one background tab at a time, obeys the pace rule, reads the price, posts it to `http://localhost:3210/api/observe`, shows progress, skips what is already done today, and stops a store after three failures in a row. A switch for "collect once a day while Chrome is open".
- Permissions: the tracked stores and localhost, nothing else. No remote code. No data leaves the computer.
- Loaded unpacked (chrome://extensions → Developer mode → Load unpacked). Not published.

## Look

A till slip. Off-white receipt paper on a dark counter, near-black ink, one monospaced typeface (self-hosted, e.g. IBM Plex Mono or Space Mono), dashed tear lines, a barcode strip, and one red rubber stamp for the verdict, slightly rotated. Numbers large and right-aligned like a receipt. No emoji, no gradients, no purple, no stock illustration. Copy is short and dry: "Claimed: 31% off. We saw: 4%." and "Was R3,999 here. Was R2,699.99 down the road."

## Wording about stores

Real store names, measured numbers only. Say "claimed" and "we saw". No adjectives, no "scam", "fraud", "lying" or "fake". Every figure sits next to its dates and sample size. The name of the product is the only joke.

## Code and git

- Small, readable files. A README that a curious non-developer can follow.
- No secrets exist in this project. Keep it that way: no keys, tokens or `.env` values.
- Commit locally at the end of each stage with a plain message. Do not push, create a remote or publish anything unless the stage says so.
- Unit-test the maths (`claimed`, `real`, `gap`, stamp thresholds, the 14-day rule, "was" spread, leaderboard) with a handful of cases, including one day of data (no stamp), a reduction that began inside the window, a price unchanged for over 30 days, a monthly reference point, and a member-only price.
