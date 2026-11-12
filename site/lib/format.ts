export const money = (n: number) =>
  `R${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const percent = (n: number | null) =>
  n === null ? "—" : `${n.toFixed(1)}%`;
export const dateLabel = (day: string) =>
  new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(`${day}T12:00:00+02:00`));
export const comparisonLabel = (reading: { was_label: string | null }) =>
  reading.was_label || "Crossed-out price (label not recorded)";

export function readingDates(rows: { observed_at: string }[]): string {
  const days = rows.map((o) => o.observed_at.slice(0, 10)).sort();
  if (!days.length) return "No readings yet";
  return days[0] === days.at(-1)
    ? dateLabel(days[0])
    : `${dateLabel(days[0])}–${dateLabel(days.at(-1)!)}`;
}
