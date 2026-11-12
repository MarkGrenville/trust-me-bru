import Link from "next/link";
import { claimed, membership, wasSpread } from "@/lib/math";
import {
  comparisonLabel,
  dateLabel,
  money,
  percent,
  readingDates,
} from "@/lib/format";
import type { Observation, Product, Store } from "@/lib/types";
import { Price } from "./receipt";

export function Comparison({
  product,
  rows,
  stores,
  compact = false,
}: {
  product: Product;
  rows: Observation[];
  stores: Store[];
  compact?: boolean;
}) {
  const sorted = [...rows].sort(
    (a, b) => a.price - b.price || a.store.localeCompare(b.store),
  );
  return (
    <>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label={`${product.name} store comparison`}
      >
        <table className={`comparison-table ${compact ? "compact" : ""}`}>
          <caption className="sr-only">
            {product.name}, latest readings {readingDates(rows)}. Membership
            conditions are part of each price.
          </caption>
          <thead>
            <tr>
              <th>Store</th>
              <th>Recorded price</th>
              <th>Crossed-out price</th>
              {!compact && (
                <>
                  <th>Claimed saving</th>
                  <th>Spread</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((o) => (
              <tr key={o.store}>
                <td>
                  <a
                    href={o.url}
                    target="_blank"
                    rel="noreferrer"
                    className="store-link"
                  >
                    {stores.find((s) => s.key === o.store)?.display_name ||
                      o.store}
                    <span aria-hidden="true"> ↗</span>
                  </a>
                  <small>{dateLabel(o.observed_at.slice(0, 10))}</small>
                  {!compact && (
                    <small>
                      {o.observed_at.slice(11, 19)} SAST
                      {o.in_stock ? "" : " · out of stock"}
                      {o.is_marketplace === null ||
                      o.is_marketplace === undefined
                        ? " · seller unconfirmed"
                        : o.is_marketplace
                          ? ` · marketplace: ${o.seller || "unknown seller"}`
                          : ""}
                    </small>
                  )}
                </td>
                <td>
                  <Price reading={o} />
                  {compact && !o.in_stock && <small>Out of stock</small>}
                </td>
                <td className="was-price">
                  {o.was_price === null ? (
                    "—"
                  ) : (
                    <>
                      {money(o.was_price)}
                      <small>{comparisonLabel(o)}</small>
                    </>
                  )}
                </td>
                {!compact && (
                  <>
                    <td>
                      {percent(claimed(o.price, o.was_price))}
                      {claimed(o.price, o.was_price) !== null &&
                        membership(o) && <small>members</small>}
                      {o.claimed_pct !== null && (
                        <small>Store printed {o.claimed_pct}%</small>
                      )}
                    </td>
                    <td>
                      {wasSpread(o, rows) === null
                        ? "—"
                        : `+${percent(wasSpread(o, rows))}`}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!compact && (
        <>
          <p className="fine-print">
            {rows.length} latest store readings · {readingDates(rows)}. Spread
            compares each crossed-out price with the lowest crossed-out price
            for this same product on the same date. Dates can differ between
            stores; older prices are not live quotes. Conditions can differ. It
            is not a verdict.
          </p>
          {rows.some((o) => o.promo_label) && (
            <details className="conditions">
              <summary>Offer conditions, as recorded</summary>
              <ul>
                {rows
                  .filter((o) => o.promo_label)
                  .map((o) => (
                    <li key={o.store}>
                      <strong>
                        {stores.find((s) => s.key === o.store)?.display_name}:
                      </strong>{" "}
                      {o.promo_label}
                    </li>
                  ))}
              </ul>
            </details>
          )}
          {Object.keys(product.stores)
            .filter((key) => !rows.some((o) => o.store === key))
            .map((key) => (
              <p className="fine-print" key={key}>
                {stores.find((s) => s.key === key)?.display_name}: no reading
                recorded yet.{" "}
                <a href={product.stores[key]} target="_blank" rel="noreferrer">
                  View watched page ↗
                </a>
              </p>
            ))}
        </>
      )}
      {compact && (
        <Link className="text-link" href={`/p/${product.id}`}>
          Open the full slip <span>→</span>
        </Link>
      )}
    </>
  );
}
