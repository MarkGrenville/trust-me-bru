import Link from "next/link";
import { readDataset } from "@/lib/data";
import { latestReadings, wasSpread, verdict, membership } from "@/lib/math";
import {
  comparisonLabel,
  dateLabel,
  money,
  percent,
  readingDates,
} from "@/lib/format";
import { ReadingsMeta, Price } from "@/components/receipt";
import { Comparison } from "@/components/comparison";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const data = await readDataset();
  const today = latestReadings(data.observations, data.products);
  const featured = data.products.find((p) => p.id === "hisense-hs5100")!;
  const featureRows = today.filter((o) => o.product_id === featured.id);
  const comparisons = featureRows
    .filter((o) => o.was_price !== null)
    .sort((a, b) => a.was_price! - b.was_price!);
  const low = comparisons[0],
    high = comparisons.at(-1);
  const matched = data.products.filter((p) =>
    `${p.name} ${p.brand} ${p.model} ${p.category}`
      .toLowerCase()
      .includes(q.trim().toLowerCase()),
  );
  const maxSpread = (id: string) =>
    Math.max(
      0,
      ...today
        .filter((o) => o.product_id === id)
        .map((o) => wasSpread(o, today) || 0),
    );
  const ranked = [...matched].sort((a, b) => maxSpread(b.id) - maxSpread(a.id));
  const visible = q ? ranked : ranked.slice(0, 12);
  const rest = q ? [] : ranked.slice(12);
  const allVerdicts = today.map((o) => ({
    o,
    v: verdict(
      o,
      data.observations,
      data.references,
      o.observed_at.slice(0, 10),
    ),
  }));
  const lookedUp = data.products.filter((p) =>
    data.references.some((r) => r.product_id === p.id),
  );
  const ownVerdicts = allVerdicts.filter(
    ({ v }) => v.stamp && v.basis === "own",
  );
  const card = (p: typeof featured) => {
    const rows = today
      .filter((o) => o.product_id === p.id)
      .sort((a, b) => a.price - b.price);
    const lowest = rows[0];
    const spread = maxSpread(p.id);
    return (
      <Link className="product-card" href={`/p/${p.id}`} key={p.id}>
        <div className="card-top">
          <span>{p.brand.toUpperCase()}</span>
          <span>
            {rows.length} {rows.length === 1 ? "store" : "stores"} ↗
          </span>
        </div>
        <h3>{p.name}</h3>
        <div className="card-bottom">
          <div>
            <span className="eyebrow">LOWEST RECORDED</span>
            {lowest ? (
              <>
                <Price reading={lowest} />
                <small>Latest offers span {readingDates(rows)}.</small>
                <small>
                  {
                    data.stores.find((s) => s.key === lowest.store)
                      ?.display_name
                  }{" "}
                  · {dateLabel(lowest.observed_at.slice(0, 10))}
                  {!lowest.in_stock ? " · out of stock" : ""}
                </small>
              </>
            ) : (
              <span>No reading</span>
            )}
          </div>
          <div className="card-spread">
            <span className="eyebrow">SPREAD</span>
            <strong>{spread > 0 ? `+${percent(spread)}` : "—"}</strong>
          </div>
        </div>
      </Link>
    );
  };
  return (
    <>
      <ReadingsMeta rows={today} />
      <section className="home-intro">
        <div>
          <p className="eyebrow">BLACK FRIDAY. CHECK THE RECEIPT.</p>
          <h1>
            Trust the price.
            <br />
            <span>Check the claim.</span>
          </h1>
          <p className="intro-copy">
            The store says you’re saving.
            <br />
            We write down the prices. Then we check.
          </p>
        </div>
        <div className="receipt-count">
          <strong>{data.products.length}</strong>
          <span>
            PRODUCTS
            <br />
            ON THE SLIP
          </span>
        </div>
      </section>
      <form className="search" role="search" action="/">
        <label htmlFor="search-products" className="sr-only">
          Find a product, brand or model
        </label>
        <span aria-hidden="true">⌕</span>
        <input
          id="search-products"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Find a product, brand or model…"
        />
        <button type="submit">
          CHECK <span aria-hidden="true">→</span>
        </button>
      </form>
      {!q && (
        <>
          {comparisons.length >= 2 && (
            <section className="featured">
              <div className="section-heading">
                <h2>Same price, different crossed-out price</h2>
                <span>EXHIBIT 001</span>
              </div>
              <div className="feature-intro">
                <div>
                  <p className="eyebrow">
                    {featured.model} / {featureRows.length} STORES /{" "}
                    {readingDates(featureRows)}
                  </p>
                  <h3>
                    One soundbar.
                    <br />
                    {new Set(comparisons.map((o) => o.was_price)).size}{" "}
                    crossed-out prices.
                  </h3>
                  {low && high && (
                    <p>
                      {comparisonLabel(high)}: {money(high.was_price!)} here.
                      <br />
                      {comparisonLabel(low)} {money(low.was_price!)} down the
                      road.
                    </p>
                  )}
                </div>
                <div className="spread-ticket">
                  <span>WIDEST SPREAD IN THIS COMPARISON</span>
                  <strong>+{percent(maxSpread(featured.id))}</strong>
                  <small>
                    Same product. Different comparisons.
                    <br />
                    {featureRows.length} stores · {readingDates(featureRows)}
                  </small>
                </div>
              </div>
              <Comparison
                product={featured}
                rows={featureRows}
                stores={data.stores}
                compact
              />
            </section>
          )}
          {lookedUp.length > 0 ? (
            <section className="looked-up">
              <div className="section-heading">
                <h2>A “before” on the receipt</h2>
                <span>{lookedUp.length} LOOKED-UP PRODUCTS</span>
              </div>
              <p className="fine-print">
                These verdicts use dated Buck Cheap reference points. Monthly
                points are not a daily pre-reduction low. The tracker does not
                record conditions or sellers; member prices are labelled below.
              </p>
              <div className="reference-grid">
                {lookedUp.map((product) => {
                  const candidates = allVerdicts.filter(
                    ({ o, v }) =>
                      o.product_id === product.id && v.stamp && v.reference,
                  );
                  const selected =
                    candidates.find(({ o }) => o.store === "hificorp") ||
                    candidates[0];
                  return (
                    <Link
                      href={`/p/${product.id}`}
                      className="reference-card"
                      key={product.id}
                    >
                      <div className="card-top">
                        <span>{product.brand.toUpperCase()}</span>
                        <span>OPEN SLIP ↗</span>
                      </div>
                      <h3>{product.name}</h3>
                      {selected ? (
                        <>
                          <div className="reference-card-price">
                            <span>
                              {
                                data.stores.find(
                                  (s) => s.key === selected.o.store,
                                )?.display_name
                              }
                            </span>
                            <Price reading={selected.o} />
                          </div>
                          <div className="reference-stamp">
                            {selected.v.stamp}
                          </div>
                          <p className="reference-card-maths">
                            Claimed: {percent(selected.v.claimed)}
                            {membership(selected.o) ? " members" : ""}. Real:{" "}
                            {percent(selected.v.real)}.<br />
                            Gap: {selected.v.gap!.toFixed(1)} pp ·{" "}
                            {dateLabel(selected.o.observed_at.slice(0, 10))}.
                          </p>
                          {selected.v.increase && (
                            <p className="price-increase">
                              Price up {money(selected.v.increase.amount)} (
                              {percent(selected.v.increase.percent)}) against
                              this dated reference.
                            </p>
                          )}
                          <p className="reference-card-basis">
                            Against {money(selected.v.reference!.price)} on{" "}
                            {dateLabel(selected.v.reference!.date)} ·{" "}
                            {selected.v.reference!.source}, monthly points.
                            <br />
                            {selected.v.reference!.next
                              ? `Next: ${dateLabel(selected.v.reference!.next!.date)}, ${money(selected.v.reference!.next!.price)}.`
                              : "No later point supplied."}
                          </p>
                          <small>
                            Tracker conditions and seller not recorded. Price
                            history: Buck Cheap.
                          </small>
                        </>
                      ) : (
                        <p className="fine-print">
                          No qualifying claim or reference for a verdict on this
                          collection date. Open the slip for the recorded prices
                          and sources.
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className="history-note">
              <h2>Too early to say</h2>
              <p>
                Our own history is still short. The public copy includes no
                third-party reference histories. Claims need enough earlier
                readings before they get a stamp.
              </p>
            </section>
          )}
        </>
      )}
      <section className="catalog" id="products">
        <div className="section-heading">
          <h2>{q ? `Results for “${q}”` : "The rest of the slip"}</h2>
          <span>
            {q ? `${matched.length} MATCHES` : "WIDEST SPREADS FIRST"}
          </span>
        </div>
        {q && (
          <Link href="/" className="back-link">
            Clear search ×
          </Link>
        )}
        {!matched.length ? (
          <div className="empty-state">
            <h3>No match on the watchlist.</h3>
            <p>
              Try a brand or model number. We track {data.products.length} exact
              products.
            </p>
          </div>
        ) : (
          <div className="product-grid">{visible.map(card)}</div>
        )}
        {rest.length > 0 && (
          <details className="more-products">
            <summary>
              Show all {data.products.length} products{" "}
              <span>+ {rest.length} more</span>
            </summary>
            <div className="product-grid">{rest.map(card)}</div>
          </details>
        )}
      </section>
      {ownVerdicts.length > 0 && (
        <section className="verdict-preview">
          <div>
            <p className="eyebrow">OUR DAILY READINGS / BIGGEST GAPS</p>
            {ownVerdicts
              .sort((a, b) => b.v.gap! - a.v.gap!)
              .slice(0, 3)
              .map(({ o, v }) => (
                <p key={`${o.product_id}-${o.store}`}>
                  <Link href={`/p/${o.product_id}`}>
                    {data.products.find((p) => p.id === o.product_id)?.name}
                  </Link>{" "}
                  · {v.stamp} · {v.gap!.toFixed(1)} pp ·{" "}
                  {dateLabel(o.observed_at.slice(0, 10))} · {v.priorDays}{" "}
                  pre-reduction days
                </p>
              ))}
          </div>
          <div>
            <p className="eyebrow">OUR DAILY READINGS / HONEST DEALS</p>
            {ownVerdicts
              .filter(({ v }) => v.stamp === "LEGIT")
              .sort((a, b) => b.v.real! - a.v.real!)
              .slice(0, 3)
              .map(({ o, v }) => (
                <p key={`${o.product_id}-${o.store}`}>
                  <Link href={`/p/${o.product_id}`}>
                    {data.products.find((p) => p.id === o.product_id)?.name}
                  </Link>{" "}
                  · {percent(v.real)} real saving ·{" "}
                  {dateLabel(o.observed_at.slice(0, 10))} · {v.priorDays}{" "}
                  pre-reduction days
                </p>
              ))}
          </div>
        </section>
      )}
      <section className="blocked-stores">
        <span className="eyebrow">TWO MISSING RECEIPTS</span>
        <p>
          {data.stores
            .filter((s) => s.status === "human-check")
            .map((s) => s.display_name)
            .join(" and ")}
          : asks if you’re human, so not tracked. Checked 11 November 2026.
        </p>
        <Link href="/how">What we can and can’t tell you →</Link>
      </section>
    </>
  );
}
