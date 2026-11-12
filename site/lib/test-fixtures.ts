// Fictional prices for tests. These are not retailer observations or tracker data.
import type { Observation, Reference, Store } from "./types";
export const exampleStore: Store = {
  key: "example",
  display_name: "Example Store",
  home_url: "https://store.test",
  status: "tracked",
};
export const exampleReading: Observation = {
  product_id: "example-product",
  store: "example",
  observed_at: "2026-11-11T12:00:00+02:00",
  price: 120,
  was_price: 150,
  was_label: "was",
  claimed_pct: null,
  promo_label: null,
  in_stock: true,
  url: "https://store.test/example",
  source: "extension",
  seller: "Example Store",
  is_marketplace: false,
};
export const exampleReference: Reference = {
  product_id: "example-product",
  store: "example",
  store_name: "Example Store",
  retailer_url: exampleReading.url,
  source: "Example tracker",
  source_url: "https://tracker.test/example",
  looked_up_at: "2026-11-11T12:00:00+02:00",
  credit_line: "Fictional test history",
  tracking_since: "2026-09-01",
  earliest_chart_point_date: "2026-09-01",
  history: [
    { date: "2026-10-01", price: 100 },
    { date: "2026-11-01", price: 120 },
  ],
  context_point_before_window: { date: "2026-09-01", price: 105 },
  lowest_price: 100,
  highest_price: 120,
  promo_label: null,
  historical_conditions_known: false,
  is_marketplace: null,
};
