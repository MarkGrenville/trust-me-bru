import type { Metadata } from "next";
import { readDataset } from "@/lib/data";
import { leaderboard, latestReadings, eligible } from "@/lib/math";
import { dateLabel, percent, readingDates } from "@/lib/format";
import { ReadingsMeta } from "@/components/receipt";
import { rules } from "@/lib/config";

export const metadata: Metadata = { title: "The store board" };
export default async function Board() {
  const data = await readDataset();
  const today = latestReadings(data.observations, data.products);
  const board = leaderboard(
    data.stores,
    data.observations.filter((o) =>
      data.products.some(
        (p) => p.id === o.product_id && p.stores[o.store] === o.url,
      ),
    ),
    data.references,
    data.date,
    "latest",
  );
  const excluded = today.filter((o) => !eligible(o));
  const minimum = rules.minimumStoreProducts;
  return (
    <>
      <ReadingsMeta rows={today} />
      <section className="page-intro">
        <p className="eyebrow">THE STORE BOARD / SAMPLE SIZES INCLUDED</p>
        <h1>
          Big claims.
          <br />
          <span>Small print.</span>
        </h1>
        <p className="intro-copy">
          A sample of {data.products.length} watched products, not every product
          a store sells.
          <br />
          Latest saved offer from each store, with its original date; these are
          not live quotes. Ordered by average crossed-out-price spread. Every
          column has its own sample.
        </p>
      </section>
      <div className="board-note">
        <strong>READ THIS BEFORE THE NUMBERS.</strong>
        <p>
          Member offers are counted and labelled. A spread compares quoted
          crossed-out prices. Verdicts use a “before”: our pre-reduction
          readings or a dated tracker reference. Buck Cheap’s monthly points do
          not record membership conditions or sellers.
        </p>
      </div>
      <p className="board-scroll-hint">
        Scroll across to compare all columns →
      </p>
      <div
        className="table-scroll board-scroll"
        tabIndex={0}
        role="region"
        aria-label="Store leaderboard"
      >
        <table className="board-table">
          <caption className="sr-only">
            Latest store claims recorded {readingDates(today)}. Each average
            requires five eligible products.
          </caption>
          <thead>
            <tr>
              <th>Store / dates covered</th>
              <th>
                Products
                <br />
                claiming a saving
              </th>
              <th>Avg. claimed</th>
              <th>Avg. spread</th>
              <th>
                Member
                <br />
                claims
              </th>
              <th>Verdicts with a “before”</th>
              <th>Avg. gap</th>
            </tr>
          </thead>
          <tbody>
            {board.map((row) => (
              <tr key={row.store.key}>
                <td>
                  <strong>{row.store.display_name}</strong>
                  <small>
                    {row.from
                      ? `${dateLabel(row.from)}–${dateLabel(row.through)}`
                      : "No readings"}
                  </small>
                  {row.store.status === "human-check" && (
                    <small>Asks if you’re human, so not tracked</small>
                  )}
                </td>
                <td>
                  {row.count}
                  <small>eligible claims</small>
                </td>
                <td>
                  {row.enough ? percent(row.claimed) : "Not enough data"}
                  <small>n = {row.count}</small>
                </td>
                <td className={row.spreadCount < minimum ? "insufficient" : ""}>
                  {row.spreadCount >= minimum
                    ? percent(row.spread)
                    : "Not enough data"}
                  <small>n = {row.spreadCount} comparable products</small>
                </td>
                <td>
                  {row.members}
                  <small>of {row.count} claims</small>
                </td>
                <td>
                  {row.gapCount >= minimum ? (
                    <div className="board-stamps">
                      <span>LEGIT {row.stamps.LEGIT}</span>
                      <span>MEH {row.stamps.MEH}</span>
                      <span>TRUST ME BRU {row.stamps["TRUST ME BRU"]}</span>
                    </div>
                  ) : (
                    "Not enough data"
                  )}
                  <small>n = {row.gapCount} with a “before”</small>
                </td>
                <td>
                  {row.gap !== null
                    ? `${row.gap.toFixed(1)} pp`
                    : "Not enough data"}
                  <small>n = {row.gapCount}</small>
                  {row.baselineFrom && row.baselineThrough && (
                    <small className="baseline-dates">
                      Before: {dateLabel(row.baselineFrom)}
                      {row.baselineFrom !== row.baselineThrough
                        ? `–${dateLabel(row.baselineThrough)}`
                        : ""}
                      <br />
                      {row.sources.join(" + ")}
                    </small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fine-print">
        Each average and verdict-count column needs at least {minimum} products.
        Counts of all eligible claims and member claims remain visible.
        Reference-based verdicts use the latest source point at least 30 days
        before the collection date; that is a different method from a daily
        30-day pre-reduction low. Product slips name the baseline and source.
      </p>
      <div className="board-exclusions">
        <h2>{excluded.length} readings left out of these averages.</h2>
        <p>
          {excluded.filter((o) => !o.in_stock).length} out of stock ·{" "}
          {excluded.filter((o) => o.is_marketplace === true).length} marketplace
          ·{" "}
          {
            excluded.filter(
              (o) => o.is_marketplace !== true && o.is_marketplace !== false,
            ).length
          }{" "}
          seller unconfirmed. Counts can overlap. They remain visible on product
          pages.
        </p>
      </div>
    </>
  );
}
