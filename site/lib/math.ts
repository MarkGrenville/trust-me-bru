import { rules } from "./config";
import type {
  HistoryPoint,
  Observation,
  Reference,
  Store,
  Product,
} from "./types";

export function localDay(value = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
export function shiftDay(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function claimed(price: number, was: number | null): number | null {
  return was !== null && was > price && price > 0
    ? ((was - price) / was) * 100
    : null;
}
export function realSaving(price: number, baseline: number): number {
  return baseline > 0 ? Math.max(0, ((baseline - price) / baseline) * 100) : 0;
}
export function priceIncrease(price: number, baseline: number | null) {
  if (baseline === null || baseline <= 0 || price <= baseline) return null;
  return {
    amount: Math.round((price - baseline) * 100) / 100,
    percent: ((price - baseline) / baseline) * 100,
  };
}
export function stampFor(gap: number): "LEGIT" | "MEH" | "TRUST ME BRU" {
  return gap <= rules.legitMaximumGap
    ? "LEGIT"
    : gap <= rules.mehMaximumGap
      ? "MEH"
      : "TRUST ME BRU";
}
export function membership(reading: Pick<Observation, "promo_label">): boolean {
  return /\+more|member|xtra savings|smart shopper/i.test(
    reading.promo_label || "",
  );
}
// Sale expiry is not a condition. Preserve all other labels for comparability.
export function conditionKey(label: string | null): string {
  return (label || "")
    .split(";")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => !s.startsWith("sale ends "))
    .sort()
    .join(";");
}
export function eligible(reading: Observation): boolean {
  return reading.in_stock && reading.is_marketplace === false;
}
export function latestOnDay(
  observations: Observation[],
  day: string,
): Observation[] {
  const latest = new Map<string, Observation>();
  for (const reading of observations) {
    if (reading.observed_at.slice(0, 10) !== day) continue;
    const key = `${reading.product_id}/${reading.store}`;
    if (!latest.has(key) || latest.get(key)!.observed_at < reading.observed_at)
      latest.set(key, reading);
  }
  return [...latest.values()];
}

// Historical display only: dates remain attached to each offer. Collection
// scheduling still uses latestOnDay and never treats these as today's readings.
export function latestReadings(
  observations: Observation[],
  products?: Product[],
): Observation[] {
  const watched = products && new Map(products.map((p) => [p.id, p]));
  const latest = new Map<string, Observation>();
  for (const reading of observations) {
    if (
      watched &&
      watched.get(reading.product_id)?.stores[reading.store] !== reading.url
    )
      continue;
    const key = `${reading.product_id}/${reading.store}`;
    if (!latest.has(key) || latest.get(key)!.observed_at < reading.observed_at)
      latest.set(key, reading);
  }
  return [...latest.values()];
}

export function verdict(
  reading: Observation,
  observations: Observation[],
  references: Reference[],
  asOf: string,
) {
  const sameListing = (o: Observation) =>
    o.product_id === reading.product_id &&
    o.store === reading.store &&
    o.url === reading.url;
  const own = observations.filter(
    (o) =>
      sameListing(o) &&
      o.in_stock &&
      o.is_marketplace !== true &&
      conditionKey(o.promo_label) === conditionKey(reading.promo_label) &&
      o.observed_at.slice(0, 10) <= asOf,
  );
  const daily = new Map(
    latestDays([...own, reading]).map((o) => [o.observed_at.slice(0, 10), o]),
  );
  let began = reading.observed_at.slice(0, 10);
  while (daily.get(shiftDay(began, -1))?.price === reading.price)
    began = shiftDay(began, -1);
  const heldDays = Math.round(
    (new Date(`${reading.observed_at.slice(0, 10)}T12:00:00Z`).getTime() -
      new Date(`${began}T12:00:00Z`).getTime()) /
      86_400_000,
  );
  const from = shiftDay(began, -rules.lookbackDays);
  const before = [...daily.values()].filter(
    (o) =>
      o.observed_at.slice(0, 10) >= from && o.observed_at.slice(0, 10) < began,
  );
  const days = before.length;
  const previous = daily.get(shiftDay(began, -1));
  const ownReady =
    heldDays >= rules.lookbackDays ||
    (previous !== undefined && days >= rules.minimumHistoryDays);
  const matching = references.filter(
    (r) =>
      r.product_id === reading.product_id &&
      r.store === reading.store &&
      r.retailer_url === reading.url,
  );
  // A monthly reference is a stated point, never a fabricated daily history.
  const candidates = matching
    .map((reference) => {
      const points = [
        ...(reference.context_point_before_window
          ? [reference.context_point_before_window]
          : []),
        ...reference.history,
      ].sort((a, b) => a.date.localeCompare(b.date));
      const point = points
        .filter((p) => p.date <= shiftDay(asOf, -rules.lookbackDays))
        .at(-1);
      return point
        ? {
            reference,
            point,
            next: points.find((p) => p.date > point.date) || null,
          }
        : null;
    })
    .filter(
      (
        r,
      ): r is {
        reference: Reference;
        point: HistoryPoint;
        next: HistoryPoint | null;
      } => r !== null,
    )
    .sort(
      (a, b) =>
        b.point.date.localeCompare(a.point.date) ||
        a.reference.source_url.localeCompare(b.reference.source_url),
    );
  const external = candidates[0] || null;
  const claim = claimed(reading.price, reading.was_price);
  const usable =
    reading.observed_at.slice(0, 10) === asOf &&
    reading.in_stock &&
    reading.is_marketplace !== true;
  const basis =
    usable && ownReady ? "own" : usable && external ? "reference" : null;
  const baseline =
    basis === "own"
      ? heldDays >= rules.lookbackDays
        ? reading.price
        : Math.min(...before.map((o) => o.price))
      : basis === "reference"
        ? external!.point.price
        : null;
  const real = baseline === null ? null : realSaving(reading.price, baseline);
  const gap = claim === null || real === null ? null : claim - real;
  const firstSeen =
    observations
      .filter(sameListing)
      .map((o) => o.observed_at.slice(0, 10))
      .sort()[0] || asOf;
  return {
    claimed: claim,
    real,
    gap,
    stamp: gap === null ? null : stampFor(gap),
    priorDays: days,
    baseline,
    increase: priceIncrease(reading.price, baseline),
    firstSeen,
    basis,
    began,
    heldDays,
    from,
    through: shiftDay(began, -1),
    sources:
      basis === "own"
        ? ["Our readings"]
        : basis === "reference"
          ? [external!.reference.source]
          : [],
    reference:
      basis === "reference"
        ? {
            date: external!.point.date,
            price: external!.point.price,
            next: external!.next,
            source: external!.reference.source,
            source_url: external!.reference.source_url,
            credit_line: external!.reference.credit_line,
          }
        : null,
    trackerHighest:
      external?.reference || matching[0]
        ? {
            price: (external?.reference || matching[0]).highest_price,
            source: (external?.reference || matching[0]).source,
            source_url: (external?.reference || matching[0]).source_url,
          }
        : null,
  };
}

function latestDays(observations: Observation[]): Observation[] {
  const days = new Map<string, Observation>();
  for (const o of [...observations].sort((a, b) =>
    a.observed_at.localeCompare(b.observed_at),
  ))
    days.set(o.observed_at.slice(0, 10), o);
  return [...days.values()];
}

export function wasSpread(
  reading: Observation,
  today: Observation[],
): number | null {
  if (reading.was_price === null || reading.was_price <= 0) return null;
  const peers = today.filter(
    (o) =>
      o.product_id === reading.product_id &&
      o.observed_at.slice(0, 10) === reading.observed_at.slice(0, 10) &&
      o.was_price !== null &&
      o.was_price > 0,
  );
  if (new Set(peers.map((o) => o.store)).size < 2) return null;
  return (
    (reading.was_price / Math.min(...peers.map((o) => o.was_price!)) - 1) * 100
  );
}
const average = (values: number[]) =>
  values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null;
export function leaderboard(
  stores: Store[],
  observations: Observation[],
  references: Reference[],
  day: string,
  mode: "day" | "latest" = "day",
) {
  const today =
    mode === "latest"
      ? latestReadings(
          observations.filter((o) => o.observed_at.slice(0, 10) <= day),
        )
      : latestOnDay(observations, day);
  const comparable = today.filter(eligible);
  return stores
    .map((store) => {
      const rows = comparable.filter(
        (o) => o.store === store.key && claimed(o.price, o.was_price) !== null,
      );
      const spreads = rows
        .map((o) => wasSpread(o, comparable))
        .filter((n): n is number => n !== null);
      const verdicts = rows.map((o) =>
        verdict(
          o,
          observations,
          references,
          mode === "latest" ? o.observed_at.slice(0, 10) : day,
        ),
      );
      const stamped = verdicts.filter((v) => v.stamp !== null);
      const gaps = stamped.map((v) => v.gap!);
      const baselineDates = stamped
        .flatMap((v) =>
          v.reference ? [v.reference.date] : [v.from, v.through],
        )
        .sort();
      const firstSeen = observations
        .filter((o) => o.store === store.key)
        .map((o) => o.observed_at.slice(0, 10))
        .sort()[0];
      return {
        store,
        count: rows.length,
        enough: rows.length >= rules.minimumStoreProducts,
        claimed: average(rows.map((o) => claimed(o.price, o.was_price)!)),
        spread:
          spreads.length >= rules.minimumStoreProducts
            ? average(spreads)
            : null,
        spreadCount: spreads.length,
        members: rows.filter(membership).length,
        gap: gaps.length >= rules.minimumStoreProducts ? average(gaps) : null,
        gapCount: gaps.length,
        baselineFrom: baselineDates[0] || null,
        baselineThrough: baselineDates.at(-1) || null,
        sources: [...new Set(stamped.flatMap((v) => v.sources))],
        stamps: {
          LEGIT: stamped.filter((v) => v.stamp === "LEGIT").length,
          MEH: stamped.filter((v) => v.stamp === "MEH").length,
          "TRUST ME BRU": stamped.filter((v) => v.stamp === "TRUST ME BRU")
            .length,
        },
        from:
          mode === "latest"
            ? rows.map((o) => o.observed_at.slice(0, 10)).sort()[0] || null
            : firstSeen || null,
        through:
          mode === "latest"
            ? rows
                .map((o) => o.observed_at.slice(0, 10))
                .sort()
                .at(-1) || day
            : day,
      };
    })
    .sort(
      (a, b) =>
        Number(b.enough) - Number(a.enough) ||
        (b.spread ?? -1) - (a.spread ?? -1),
    );
}
