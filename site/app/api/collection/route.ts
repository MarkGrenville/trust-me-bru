import { readDataset } from "@/lib/data";
import { localDay } from "@/lib/math";
import { requireLoopback, RequestError } from "@/lib/observe";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    requireLoopback(request);
    const data = await readDataset();
    const day = localDay();
    return Response.json(
      {
        day,
        products: data.products,
        stores: data.stores,
        completed: data.observations
          .filter((o) => o.observed_at.slice(0, 10) === day)
          .map((o) => `${o.product_id}|${o.store}`),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof RequestError
            ? error.message
            : "Could not read the watchlist.",
      },
      { status: error instanceof RequestError ? error.status : 500 },
    );
  }
}
