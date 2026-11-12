import { readDataset } from "@/lib/data";
import { listingCheck } from "@/lib/check";
import { requireLoopback, RequestError } from "@/lib/observe";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    requireLoopback(request);
    const url = new URL(request.url).searchParams.get("url");
    if (!url || url.length > 2048)
      throw new RequestError("Supply a watched product URL.");
    const data = await readDataset();
    const product = data.products.find((p) =>
      Object.values(p.stores).includes(url),
    );
    if (!product)
      return Response.json({ watched: false, message: "Not on the watchlist" });
    const store = Object.entries(product.stores).find(
      ([, value]) => value === url,
    )![0];
    return Response.json(listingCheck(data, product, store), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof RequestError)
      return Response.json({ error: error.message }, { status: error.status });
    console.error("Price check failed:", error);
    return Response.json(
      { error: "Could not read the price log." },
      { status: 500 },
    );
  }
}
