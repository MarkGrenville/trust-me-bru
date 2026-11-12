import { appendFile, mkdir, readFile, rmdir } from "node:fs/promises";
import path from "node:path";
import { localDay } from "./math";
import type { Observation, Product } from "./types";

export class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function requireLoopback(request: Request) {
  const allowed = new Set(["localhost:3210", "127.0.0.1:3210", "[::1]:3210"]);
  if (!allowed.has(request.headers.get("host") || ""))
    throw new RequestError("Loopback requests only.", 403);
  const origin = request.headers.get("origin");
  if (
    origin &&
    ![
      "http://localhost:3210",
      "http://127.0.0.1:3210",
      "http://[::1]:3210",
    ].includes(origin) &&
    !/^chrome-extension:\/\/[a-p]{32}$/.test(origin)
  )
    throw new RequestError("Origin not allowed.", 403);
  const forwarded = request.headers.get("x-forwarded-host");
  if (forwarded && !allowed.has(forwarded))
    throw new RequestError("Forwarded host not allowed.", 403);
}
const amount = (n: unknown): n is number =>
  typeof n === "number" &&
  Number.isFinite(n) &&
  n > 0 &&
  n <= 100_000_000 &&
  Math.abs(n * 100 - Math.round(n * 100)) < 0.000001;
export function validateObservation(
  value: unknown,
  products: Product[],
  now = new Date(),
): Observation {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new RequestError("A reading must be an object.");
  const o = value as Record<string, unknown>;
  const required = [
    "product_id",
    "store",
    "observed_at",
    "price",
    "was_price",
    "was_label",
    "claimed_pct",
    "promo_label",
    "in_stock",
    "url",
    "source",
  ];
  const optional = ["seller", "is_marketplace", "was_label_note"];
  if (
    required.some((key) => !(key in o)) ||
    Object.keys(o).some((key) => ![...required, ...optional].includes(key))
  )
    throw new RequestError("Missing or unknown reading fields.");
  if (typeof o.product_id !== "string" || typeof o.store !== "string")
    throw new RequestError("Invalid product or store.");
  const product = products.find((p) => p.id === o.product_id);
  if (
    !product ||
    typeof o.url !== "string" ||
    !product.stores[o.store] ||
    product.stores[o.store] !== o.url
  )
    throw new RequestError(
      "URL must match the exact watched product, store and variant.",
    );
  if (!amount(o.price) || (o.was_price !== null && !amount(o.was_price)))
    throw new RequestError(
      "Prices must be positive rand amounts with at most two decimal places.",
    );
  if (
    o.was_label !== null &&
    (typeof o.was_label !== "string" ||
      !o.was_label.trim() ||
      o.was_label.length > 150)
  )
    throw new RequestError("Invalid comparison-price label.");
  if (o.was_price === null && o.was_label !== null)
    throw new RequestError("A comparison label needs a comparison price.");
  if (
    o.was_label_note !== undefined &&
    o.was_label_note !== null &&
    (typeof o.was_label_note !== "string" ||
      !o.was_label_note.trim() ||
      o.was_label_note.length > 500 ||
      o.was_price === null)
  )
    throw new RequestError("Invalid comparison-label note.");
  if (
    o.claimed_pct !== null &&
    (typeof o.claimed_pct !== "number" ||
      !Number.isFinite(o.claimed_pct) ||
      o.claimed_pct < 0 ||
      o.claimed_pct > 100)
  )
    throw new RequestError("Invalid printed percentage.");
  if (typeof o.in_stock !== "boolean")
    throw new RequestError("in_stock must be boolean.");
  if (
    o.promo_label !== null &&
    (typeof o.promo_label !== "string" ||
      !o.promo_label.trim() ||
      o.promo_label.length > 500)
  )
    throw new RequestError("Invalid promotion label.");
  if (o.source !== "extension" && o.source !== "codex-browser")
    throw new RequestError("Invalid reading source.");
  if (
    typeof o.observed_at !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?\+02:00$/.test(
      o.observed_at,
    )
  )
    throw new RequestError("observed_at must be an ISO timestamp with +02:00.");
  const observed = new Date(o.observed_at);
  if (
    !Number.isFinite(observed.getTime()) ||
    localDay(observed) !== o.observed_at.slice(0, 10) ||
    observed.getTime() > now.getTime() + 120_000
  )
    throw new RequestError("Invalid or future observation date.");
  if (
    o.seller !== undefined &&
    o.seller !== null &&
    (typeof o.seller !== "string" || !o.seller.trim() || o.seller.length > 200)
  )
    throw new RequestError("Invalid seller.");
  if (
    o.is_marketplace !== undefined &&
    o.is_marketplace !== null &&
    typeof o.is_marketplace !== "boolean"
  )
    throw new RequestError("Invalid marketplace flag.");
  if (typeof o.is_marketplace === "boolean" && !o.seller)
    throw new RequestError(
      "A confirmed seller is required for marketplace status.",
    );
  if (o.store === "takealot") {
    if (!("seller" in o) || !("is_marketplace" in o))
      throw new RequestError(
        "Takealot readings must explicitly record seller and is_marketplace, even when unknown.",
      );
    if (
      o.seller &&
      o.is_marketplace !== !/^takealot(?:\.com)?$/i.test(String(o.seller))
    )
      throw new RequestError(
        "Takealot marketplace status must match the recorded seller.",
      );
  }
  return {
    ...(o as Observation),
    seller: (o.seller as string | null | undefined) ?? null,
    is_marketplace: (o.is_marketplace as boolean | null | undefined) ?? null,
  };
}
export async function appendObservation(
  directory: string,
  reading: Observation,
): Promise<void> {
  const lock = path.join(directory, ".observe-lock");
  let acquired = false;
  for (let i = 0; i < 30; i++) {
    try {
      await mkdir(lock);
      acquired = true;
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  if (!acquired)
    throw new RequestError("Price log is busy. Try again shortly.", 503);
  try {
    const file = path.join(directory, "observations.jsonl");
    const text = await readFile(file, "utf8").catch((error) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    const existing: Observation[] = text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    if (
      existing.some(
        (o) =>
          o.product_id === reading.product_id &&
          o.store === reading.store &&
          o.observed_at.slice(0, 10) === reading.observed_at.slice(0, 10),
      )
    )
      throw new RequestError(
        "A reading already exists for this product, store and day.",
        409,
      );
    await appendFile(
      file,
      `${text && !text.endsWith("\n") ? "\n" : ""}${JSON.stringify(reading)}\n`,
      "utf8",
    );
  } finally {
    await rmdir(lock);
  }
}
