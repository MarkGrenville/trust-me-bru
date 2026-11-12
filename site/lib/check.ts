import { latestOnDay, localDay, verdict, wasSpread } from "./math";
import type { Dataset, Product } from "./types";

// A partial new collection must not hide the last recorded verdict for another
// listing. Keep its original date: this is a historical receipt, not today's quote.
export function listingCheck(
  data: Dataset,
  product: Product,
  store: string,
  today = localDay(),
) {
  const url = product.stores[store];
  const history = data.observations.filter(
    (o) => o.product_id === product.id && o.store === store && o.url === url,
  );
  const reading = history.reduce<(typeof history)[number] | null>(
    (latest, o) => (!latest || o.observed_at > latest.observed_at ? o : latest),
    null,
  );
  const asOf = reading?.observed_at.slice(0, 10) ?? null;
  const sameDay = asOf ? latestOnDay(data.observations, asOf) : [];
  return {
    watched: true,
    product,
    store,
    as_of: asOf,
    stale: asOf !== null && asOf !== today,
    reading,
    verdict:
      reading && asOf
        ? verdict(reading, data.observations, data.references, asOf)
        : null,
    stores: data.stores.map(({ key, display_name }) => ({ key, display_name })),
    history,
    reference_history: data.references.filter(
      (r) =>
        r.product_id === product.id &&
        r.store === store &&
        r.retailer_url === url,
    ),
    other_stores: sameDay
      .filter((o) => o.product_id === product.id && o.store !== store)
      .map((o) => ({ ...o, was_spread: wasSpread(o, sameDay) })),
  };
}
