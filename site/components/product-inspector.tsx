"use client";
import { useState } from "react";
import { verdict, membership } from "@/lib/math";
import { comparisonLabel, dateLabel, percent, money } from "@/lib/format";
import type { Observation, Reference, Store } from "@/lib/types";
import { PriceHistory } from "./price-history";
import { Price } from "./receipt";
import { rules } from "@/lib/config";

export function ProductInspector({
  rows,
  observations,
  references,
  stores,
}: {
  rows: Observation[];
  observations: Observation[];
  references: Reference[];
  stores: Store[];
}) {
  const preferred =
    rows.find(
      (o) => o.store === "hificorp" && o.was_price && o.was_price > o.price,
    ) ||
    rows.find(
      (o) =>
        verdict(o, observations, references, o.observed_at.slice(0, 10)).stamp,
    ) ||
    rows[0];
  const [selected, setSelected] = useState(preferred?.store);
  const reading = rows.find((o) => o.store === selected);
  if (!reading) return <p>No prices recorded for this product yet.</p>;
  const readingDate = reading.observed_at.slice(0, 10);
  const result = verdict(reading, observations, references, readingDate);
  const store = stores.find((s) => s.key === reading.store);
  const chartReadings = observations.filter(
    (o) => o.store === selected && o.url === reading.url,
  );
  const matching = references.filter(
    (r) => r.store === selected && r.retailer_url === reading.url,
  );
  const reference = result.reference;
  const basisLine = reference
    ? `Against ${money(reference.price)} on ${dateLabel(reference.date)} · ${reference.source}, monthly points`
    : `Against our own readings since ${dateLabel(result.firstSeen)}`;
  return (
    <section className="inspector">
      <div className="section-heading">
        <span className="section-number">02 / THE CLAIM</span>
        <span>{dateLabel(readingDate)}</span>
      </div>
      <div
        className="store-tabs"
        role="group"
        aria-label="Choose a store’s price history"
      >
        {rows.map((o) => (
          <button
            key={o.store}
            aria-pressed={selected === o.store}
            onClick={() => setSelected(o.store)}
          >
            {stores.find((s) => s.key === o.store)?.display_name || o.store}
          </button>
        ))}
      </div>
      <div className="verdict-area">
        <div>
          <span className="eyebrow">
            {store?.display_name} / PRICE RECORDED {dateLabel(readingDate)}
          </span>
          <Price reading={reading} className="selected-price" />
          <p className="fine-print">
            {reading.promo_label || "No condition recorded."}
            {!reading.in_stock && " Out of stock."}
            {reading.is_marketplace !== false &&
              " Seller unconfirmed or marketplace offer; excluded from the board."}
          </p>
        </div>
        <div className="verdict-mark">
          <div className={result.stamp ? "stamp" : "early-stamp"}>
            {result.stamp ||
              (result.claimed === null ? (
                <>
                  NO SAVING
                  <br />
                  CLAIMED
                </>
              ) : !reading.in_stock ? (
                <>
                  OUT OF
                  <br />
                  STOCK
                </>
              ) : (
                <>
                  TOO EARLY
                  <br />
                  TO SAY
                </>
              ))}
          </div>
          <small className="stamp-basis">
            {result.stamp
              ? basisLine
              : `tracked since ${dateLabel(result.firstSeen)}`}
          </small>
        </div>
      </div>
      <div className="saving-metrics">
        <div>
          <span>STORE CLAIMS{membership(reading) ? " · MEMBERS" : ""}</span>
          <strong>{percent(result.claimed)}</strong>
          <small>
            {result.claimed === null
              ? "No saving claimed"
              : `${comparisonLabel(reading)}: ${money(reading.was_price!)}`}
          </small>
        </div>
        <div>
          <span>REAL SAVING{reference ? " · REFERENCE" : ""}</span>
          <strong>{percent(result.real)}</strong>
          <small>
            {result.real === null
              ? "No “before” yet"
              : `Against ${money(result.baseline!)}`}
          </small>
        </div>
        <div>
          <span>THE GAP</span>
          <strong>
            {result.gap === null ? "—" : `${result.gap.toFixed(1)} pp`}
          </strong>
          <small>
            {result.gap === null
              ? "No verdict yet"
              : "Claimed minus real saving"}
          </small>
        </div>
      </div>
      {result.increase && (
        <p className="price-increase">
          <strong>
            Price up {money(result.increase.amount)} (
            {percent(result.increase.percent)}).
          </strong>{" "}
          {reference ? (
            <>
              Compared with {money(reference.price)} on{" "}
              {dateLabel(reference.date)} · {reference.source}.
            </>
          ) : (
            <>
              Compared with the {money(result.baseline!)} reference from our
              pre-reduction readings.
            </>
          )}
        </p>
      )}
      {reference ? (
        <div className="reference-basis">
          <p>
            On {dateLabel(reference.date)} it was{" "}
            <strong>{money(reference.price)}</strong> ·{" "}
            <a href={reference.source_url} target="_blank" rel="noreferrer">
              {reference.source} ↗
            </a>
            .
          </p>
          <p>
            {reference.next ? (
              <>
                Next point: {dateLabel(reference.next.date)},{" "}
                {money(reference.next.price)}.
              </>
            ) : (
              "No later point supplied by the tracker."
            )}{" "}
            Monthly points do not establish the exact reduction date.
          </p>
          <p className="condition-warning">
            The tracker does not record conditions or sellers
            {membership(reading)
              ? "; the recorded price is a member price"
              : ""}
            . This is a reference comparison, not proof that both offers had the
            same conditions.
          </p>
        </div>
      ) : (
        <p className="history-note">
          {result.basis === "own"
            ? result.heldDays >= rules.lookbackDays
              ? `This price has held for at least ${rules.lookbackDays} days. The reference is this recorded price; real saving is 0%. ${basisLine}.`
              : `This price began ${dateLabel(result.began)}. The reference is the lowest comparable price in the ${rules.lookbackDays} days before that day, using ${result.priorDays} distinct reading days. ${basisLine}.`
            : `A verdict needs ${rules.minimumHistoryDays} days of our readings before the reduction, or a tracker point at least ${rules.lookbackDays} days old. We have no qualifying “before” for this offer yet.`}
        </p>
      )}
      {result.trackerHighest &&
        reading.was_price !== null &&
        reading.was_price > result.trackerHighest.price && (
          <p className="highest-note">
            {comparisonLabel(reading)}: {money(reading.was_price)}. Highest{" "}
            <a
              href={result.trackerHighest.source_url}
              target="_blank"
              rel="noreferrer"
            >
              {result.trackerHighest.source}
            </a>{" "}
            shows: {money(result.trackerHighest.price)}.
            <small>
              The tracker’s summary date range is unspecified; it does not
              record conditions.
            </small>
          </p>
        )}
      <div className="section-heading chart-heading">
        <h2>Price over time</h2>
        <span>{chartReadings.length} of our readings</span>
      </div>
      <PriceHistory readings={chartReadings} references={matching} />
    </section>
  );
}
