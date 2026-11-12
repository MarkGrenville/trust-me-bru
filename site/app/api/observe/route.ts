import { readDataset, dataDirectory } from "@/lib/data";
import {
  appendObservation,
  RequestError,
  requireLoopback,
  validateObservation,
} from "@/lib/observe";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireLoopback(request);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new RequestError("Use application/json.", 415);
    const reader = request.body?.getReader();
    if (!reader) throw new RequestError("Missing reading.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) {
        await reader.cancel();
        throw new RequestError("Reading too large.", 413);
      }
      chunks.push(value);
    }
    let value: unknown;
    try {
      value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new RequestError("Invalid JSON.");
    }
    const data = await readDataset();
    const reading = validateObservation(value, data.products);
    await appendObservation(dataDirectory, reading);
    return Response.json(
      {
        saved: true,
        product_id: reading.product_id,
        store: reading.store,
        observed_at: reading.observed_at,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof RequestError)
      return Response.json({ error: error.message }, { status: error.status });
    console.error("Price log write failed:", error);
    return Response.json(
      { error: "Could not save the reading." },
      { status: 500 },
    );
  }
}
