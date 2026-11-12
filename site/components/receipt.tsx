import Link from "next/link";
import { dateLabel, money, readingDates } from "@/lib/format";
import type { Observation } from "@/lib/types";
import { membership } from "@/lib/math";

export function Barcode({ small = false }: { small?: boolean }) {
  const widths = [
    2, 1, 3, 1, 1, 2, 4, 1, 2, 2, 1, 3, 1, 2, 4, 1, 1, 3, 2, 1, 3, 1, 2, 1, 4,
    2, 1, 3, 1, 2, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3, 2, 1, 2, 3, 1, 1, 4, 2,
  ];
  let x = 0;
  return (
    <svg
      className={small ? "barcode small" : "barcode"}
      viewBox="0 0 205 42"
      aria-hidden="true"
    >
      {widths.map((w, i) => {
        const left = x;
        x += w + (i % 3 === 0 ? 3 : 2);
        return (
          <rect
            key={i}
            x={left}
            y="0"
            width={w}
            height={i < 3 || i > 44 ? 42 : 36}
          />
        );
      })}
    </svg>
  );
}
export function Price({
  reading,
  className = "",
}: {
  reading: Observation;
  className?: string;
}) {
  const condition = (reading.promo_label || "")
    .split(";")
    .filter((s) => !s.trim().startsWith("Sale ends "))
    .join("; ");
  return (
    <span className={`price ${className}`}>
      <span>{money(reading.price)}</span>
      {condition && (
        <span className="price-condition">
          {condition}
          {membership(reading) && !/more|member/i.test(condition)
            ? " · members"
            : ""}
        </span>
      )}
    </span>
  );
}
export function PageMeta({
  date,
  count,
  label = "LATEST COLLECTION",
}: {
  date: string;
  count?: string;
  label?: string;
}) {
  return (
    <div className="page-meta">
      <span>{label}</span>
      <span>
        {dateLabel(date)}
        {count ? ` · ${count}` : ""}
      </span>
    </div>
  );
}
export function ReceiptFooter() {
  return (
    <footer className="receipt-footer">
      <div>
        <strong>THANK YOU FOR CHECKING.</strong>
        <p>Prices change. The receipt keeps the dates.</p>
        <Link href="/how">How we measure →</Link>
      </div>
      <div className="footer-barcode">
        <Barcode />
        <span>TRUST / VERIFY / REPEAT</span>
      </div>
    </footer>
  );
}

export function ReadingsMeta({ rows }: { rows: Observation[] }) {
  return (
    <div className="page-meta">
      <span>LATEST SAVED READINGS</span>
      <span>
        {readingDates(rows)} · {rows.length} store readings
      </span>
    </div>
  );
}
