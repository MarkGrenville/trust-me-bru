import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Dataset, Observation } from "./types";
import { localDay } from "./math";

export const dataDirectory = path.resolve(process.cwd(), "../data");
export async function readDataset(): Promise<Dataset> {
  const [products, stores, log, reference] = await Promise.all([
    readFile(path.join(dataDirectory, "watchlist.json"), "utf8"),
    readFile(path.join(dataDirectory, "stores.json"), "utf8"),
    readFile(path.join(dataDirectory, "observations.jsonl"), "utf8").catch(
      (error) => {
        if (error.code === "ENOENT") return "";
        throw error;
      },
    ),
    readFile(path.join(dataDirectory, "reference-history.json"), "utf8").catch(
      (error) => {
        if (error.code === "ENOENT") return '{"entries":[]}';
        throw error;
      },
    ),
  ]);
  const observations: Observation[] = log
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return {
    products: JSON.parse(products),
    stores: JSON.parse(stores),
    observations,
    references: JSON.parse(reference).entries || [],
    date:
      observations
        .map((o) => o.observed_at.slice(0, 10))
        .sort()
        .at(-1) || localDay(),
  };
}
