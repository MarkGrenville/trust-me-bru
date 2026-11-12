"use client";
import { useEffect, useRef, useState } from "react";
import { money, dateLabel } from "@/lib/format";
import type { Observation, Reference } from "@/lib/types";

type Point = {
  date: string;
  price: number;
  kind: "We saw" | "Store comparison" | "Reference";
  condition: string;
  source?: string;
};
export function PriceHistory({
  readings,
  references,
}: {
  readings: Observation[];
  references: Reference[];
}) {
  const [hover, setHover] = useState<Point | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(840);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setChartWidth(Math.min(840, Math.max(280, entry.contentRect.width))),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const right = chartWidth - 24;
  const own: Point[] = readings.map((o) => ({
    date: o.observed_at.slice(0, 10),
    price: o.price,
    kind: "We saw",
    condition: o.promo_label || "No condition recorded",
  }));
  const was: Point[] = readings
    .filter((o) => o.was_price !== null)
    .map((o) => ({
      date: o.observed_at.slice(0, 10),
      price: o.was_price!,
      kind: "Store comparison",
      condition: o.was_label || "Comparison label not recorded",
    }));
  const external: Point[][] = references.map((r) =>
    [
      ...(r.context_point_before_window ? [r.context_point_before_window] : []),
      ...r.history,
    ].map((p) => ({
      ...p,
      kind: "Reference",
      condition: "Historical conditions not stated",
      source: r.source,
    })),
  );
  const points = [...own, ...was, ...external.flat()];
  if (!points.length) return <p>No dated prices to plot.</p>;
  const dates = points.map((p) => new Date(`${p.date}T12:00:00Z`).getTime());
  const minDate = Math.min(...dates),
    maxDate = Math.max(...dates);
  const low = Math.min(...points.map((p) => p.price)) * 0.88,
    high = Math.max(...points.map((p) => p.price)) * 1.1;
  const x = (p: Point) =>
    minDate === maxDate
      ? (92 + right) / 2
      : 92 +
        ((new Date(`${p.date}T12:00:00Z`).getTime() - minDate) /
          (maxDate - minDate)) *
          (right - 92);
  const y = (p: { price: number }) =>
    228 - ((p.price - low) / (high - low)) * 192;
  const label = (p: Point) =>
    `${dateLabel(p.date)} · ${p.source || p.kind} · ${money(p.price)} · ${p.condition}`;
  const tickUnit = 10 ** Math.floor(Math.log10((high - low) / 3));
  const series = (values: Point[], key: string, className: string) => (
    <g key={key} className={className}>
      {values.length > 1 && className !== "series-reference" && (
        <polyline
          points={values.map((p) => `${x(p)},${y(p)}`).join(" ")}
          fill="none"
        />
      )}
      {values.length === 1 && className === "series-was" && (
        <line
          x1={Math.max(92, x(values[0]) - 20)}
          x2={Math.min(right, x(values[0]) + 20)}
          y1={y(values[0])}
          y2={y(values[0])}
        />
      )}
      {values.map((p, i) => (
        <circle
          key={`${key}-${i}`}
          cx={x(p)}
          cy={y(p)}
          r="5"
          tabIndex={0}
          aria-label={label(p)}
          onFocus={() => setHover(p)}
          onMouseEnter={() => setHover(p)}
          onBlur={() => setHover(null)}
          onMouseLeave={() => setHover(null)}
        >
          <title>{label(p)}</title>
        </circle>
      ))}
    </g>
  );
  return (
    <div className="price-history" ref={container}>
      <div className="chart-key">
        <span className="key-own">We saw</span>
        <span className="key-was">Store comparison</span>
        {references.length > 0 && (
          <span className="key-reference">
            {[...new Set(references.map((r) => r.source))].join(" / ")}{" "}
            reference
          </span>
        )}
      </div>
      <svg
        className="history-svg"
        viewBox={`0 0 ${chartWidth} 278`}
        role="img"
        aria-label="Dated price readings. Store comparison prices use dashed lines. Third-party reference prices are isolated points: the change date between them is unknown. Exact values are in the table below."
      >
        {[0, 1, 2, 3].map((i) => {
          const n =
            Math.round((low + ((high - low) * i) / 3) / tickUnit) * tickUnit;
          return (
            <g key={i} className="chart-grid">
              <line
                x1="92"
                x2={right}
                y1={y({ price: n })}
                y2={y({ price: n })}
              />
              <text x="76" y={y({ price: n }) + 4} textAnchor="end">
                {money(n).replace(".00", "")}
              </text>
            </g>
          );
        })}
        {external.map((p, i) =>
          series(p, `reference-${i}`, "series-reference"),
        )}
        {series(was, "was", "series-was")}
        {series(own, "own", "series-own")}
        <text className="chart-date" x="92" y="264">
          {dateLabel(new Date(minDate).toISOString().slice(0, 10))}
        </text>
        <text className="chart-date" x={right} y="264" textAnchor="end">
          {minDate === maxDate
            ? "1 day"
            : dateLabel(new Date(maxDate).toISOString().slice(0, 10))}
        </text>
      </svg>
      <p className="chart-readout" aria-live="polite">
        {hover
          ? label(hover)
          : "Each dot is a stated price. Select a dot to read the receipt."}
      </p>
      {references.map((r) => (
        <p className="fine-print" key={r.source_url}>
          <a href={r.source_url} target="_blank" rel="noreferrer">
            {r.credit_line} ↗
          </a>{" "}
          · sparse monthly points · historical conditions and seller not stated.
          Only dated points are shown; when the price changed between them is
          unknown.
        </p>
      ))}
      {!references.length && (
        <p className="fine-print">
          Our readings only. A single collection day cannot show a trend.
        </p>
      )}
      <details className="conditions">
        <summary>View exact plotted values</summary>
        <div className="table-scroll">
          <table className="values-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Source</th>
                <th>Price</th>
                <th>Condition</th>
              </tr>
            </thead>
            <tbody>
              {points
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((p, i) => (
                  <tr key={i}>
                    <td>{dateLabel(p.date)}</td>
                    <td>{p.source || p.kind}</td>
                    <td>{money(p.price)}</td>
                    <td>{p.condition}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
