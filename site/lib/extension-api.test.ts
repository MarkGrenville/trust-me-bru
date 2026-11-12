import test from "node:test";
import assert from "node:assert/strict";
import { GET as collection } from "../app/api/collection/route";
import { GET as check } from "../app/api/check/route";
import { readDataset } from "./data";
import { localDay, verdict, latestOnDay } from "./math";
const request = (url: string, host = "127.0.0.1:3210") =>
  new Request(url, { headers: { host } });
test("extension queue supplies exact watchlist and only today's completed keys", async () => {
  const data = await readDataset();
  const response = await collection(
    request("http://127.0.0.1:3210/api/collection"),
  );
  const result = await response.json();
  assert.equal(result.day, localDay());
  assert.deepEqual(result.products, data.products);
  assert.deepEqual(
    result.completed,
    data.observations
      .filter((o) => o.observed_at.slice(0, 10) === localDay())
      .map((o) => `${o.product_id}|${o.store}`),
  );
  assert.equal(
    (await collection(request("http://outside/api/collection", "outside")))
      .status,
    403,
  );
});
test("product panel receives the site's exact verdict and separate attributed histories", async () => {
  const data = await readDataset();
  const reading = latestOnDay(data.observations, data.date)[0];
  const response = await check(
    request(
      "http://127.0.0.1:3210/api/check?url=" + encodeURIComponent(reading.url),
    ),
  );
  const result = await response.json();
  assert.deepEqual(
    result.verdict,
    verdict(reading, data.observations, data.references, data.date),
  );
  assert.ok(
    result.history.every((o: { url: string }) => o.url === reading.url),
  );
  assert.ok(
    result.reference_history.every(
      (r: { retailer_url: string; credit_line: string }) =>
        r.retailer_url === reading.url && r.credit_line,
    ),
  );
  assert.equal(result.stale, data.date !== localDay());
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("HS5100 at HiFi and silver XM5 at Takealot retain their latest dated verdict during a newer partial collection", async () => {
  const data = await readDataset();
  for (const [model, store] of [
    ["hisense-hs5100", "hificorp"],
    ["sony-wh-1000xm5-silver", "takealot"],
  ]) {
    const product = data.products.find(
      (p) => p.id === model && p.stores[store],
    );
    assert.ok(product, model);
    const history = data.observations.filter(
      (o) =>
        o.product_id === product.id &&
        o.store === store &&
        o.url === product.stores[store],
    );
    const reading = history.sort((a, b) =>
      b.observed_at.localeCompare(a.observed_at),
    )[0];
    assert.ok(reading);
    const response = await check(
      request(
        "http://127.0.0.1:3210/api/check?url=" +
          encodeURIComponent(reading.url),
      ),
    );
    const result = await response.json();
    const date = reading.observed_at.slice(0, 10);
    assert.deepEqual(result.reading, reading);
    assert.equal(result.as_of, date);
    assert.equal(result.stale, date !== localDay());
    assert.deepEqual(
      result.verdict,
      verdict(reading, data.observations, data.references, date),
    );
    assert.ok(result.verdict, model);
    assert.equal(
      result.verdict.claimed,
      verdict(reading, data.observations, data.references, date).claimed,
    );
    assert.ok(
      result.other_stores.every((o: { observed_at: string }) =>
        o.observed_at.startsWith(date),
      ),
    );
  }
});
