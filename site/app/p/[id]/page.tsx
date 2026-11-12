import Link from "next/link";
import { notFound } from "next/navigation";
import { readDataset } from "@/lib/data";
import { latestReadings } from "@/lib/math";
import { dateLabel, money, readingDates } from "@/lib/format";
import { Barcode, ReadingsMeta } from "@/components/receipt";
import { Comparison } from "@/components/comparison";
import { ProductInspector } from "@/components/product-inspector";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await readDataset();
  return {
    title: data.products.find((p) => p.id === id)?.name || "Product not found",
  };
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await readDataset();
  const product = data.products.find((p) => p.id === id);
  if (!product) notFound();
  const observations = data.observations.filter((o) => o.product_id === id);
  const rows = latestReadings(observations, [product]);
  const references = data.references.filter((r) => r.product_id === id);
  const firstSeen = observations
    .map((o) => o.observed_at.slice(0, 10))
    .sort()[0];
  return (
    <>
      <ReadingsMeta rows={rows} />
      <Link className="back-link" href="/">
        ← All price checks
      </Link>
      <div className="product-title">
        <div>
          <p className="eyebrow">
            {product.category.replaceAll("-", " ")} / {product.model}
          </p>
          <h1>{product.name}</h1>
          <p className="subtitle">
            One product. Every store’s version of the saving.
          </p>
        </div>
        <Barcode small />
      </div>
      <div className="product-facts">
        <span>
          TRACKED SINCE {firstSeen ? dateLabel(firstSeen) : "NO READINGS YET"}
        </span>
        <span>
          {product.gtin ? `BARCODE ${product.gtin}` : `MODEL ${product.model}`}
        </span>
      </div>
      <section id="compare">
        <div className="section-heading">
          <h2>
            <span className="section-number">01 / </span>Same product, different
            crossed-out price
          </h2>
          <span>RECORDED {readingDates(rows)}</span>
        </div>
        <Comparison product={product} rows={rows} stores={data.stores} />
      </section>
      <ProductInspector
        rows={rows}
        observations={observations}
        references={references}
        stores={data.stores}
      />
      {references.length > 0 && (
        <section className="reference-list">
          <div className="section-heading">
            <h2>Before our first receipt</h2>
            <span>THIRD-PARTY REFERENCE</span>
          </div>
          <p>
            These are Buck Cheap’s figures, kept separate from ours. The
            supplied points are monthly; they do not establish daily coverage,
            historical membership conditions or the seller. Summary low/high
            ranges are not explicitly dated by the tracker.
          </p>
          <details className="conditions">
            <summary>
              {references.length} separate tracker listings and source credits
            </summary>
            <ul>
              {references.map((r) => (
                <li key={r.source_url}>
                  <a href={r.source_url} target="_blank" rel="noreferrer">
                    {r.store_name} · {r.credit_line} ↗
                  </a>
                  <small>
                    Tracking since {dateLabel(r.tracking_since)} · looked up{" "}
                    {dateLabel(r.looked_up_at.slice(0, 10))}. Stated low{" "}
                    {money(r.lowest_price)}, high {money(r.highest_price)}; date
                    range unspecified. {r.history.length} supplied points in the
                    requested window.
                  </small>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </>
  );
}
