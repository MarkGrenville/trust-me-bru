export type Product = {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  gtin?: string;
  stores: Record<string, string>;
};
export type Store = {
  key: string;
  display_name: string;
  home_url: string;
  status: "tracked" | "human-check";
  human_check_date?: string;
};
export type Observation = {
  product_id: string;
  store: string;
  observed_at: string;
  price: number;
  was_price: number | null;
  was_label: string | null;
  was_label_note?: string | null;
  claimed_pct: number | null;
  promo_label: string | null;
  in_stock: boolean;
  url: string;
  source: "codex-browser" | "extension";
  seller?: string | null;
  is_marketplace?: boolean | null;
};
export type HistoryPoint = { date: string; price: number };
export type Reference = {
  product_id: string;
  store: string;
  store_name: string;
  retailer_url: string;
  source: string;
  source_url: string;
  looked_up_at: string;
  credit_line: string;
  tracking_since: string;
  earliest_chart_point_date: string;
  history: HistoryPoint[];
  context_point_before_window: HistoryPoint | null;
  lowest_price: number;
  highest_price: number;
  promo_label: string | null;
  historical_conditions_known: boolean;
  is_marketplace: boolean | null;
};
export type Dataset = {
  products: Product[];
  stores: Store[];
  observations: Observation[];
  references: Reference[];
  date: string;
};
