import type { Metadata } from "next";
import { rules } from "@/lib/config";
export const metadata: Metadata = { title: "The small print" };
export default function How() {
  return (
    <article className="how-page">
      <div className="page-meta">
        <span>THE SMALL PRINT</span>
        <span>METHOD / 002 · 12 NOV 2026</span>
      </div>
      <header className="page-intro">
        <p className="eyebrow">HOW TO READ THIS RECEIPT</p>
        <h1>
          The claim.
          <br />
          The “before”.
          <br />
          <span>The gap.</span>
        </h1>
        <p className="intro-copy">
          We record prices on a small South African watchlist.
          <br />A price is a reading, not a promise.
        </p>
      </header>
      <section>
        <h2>01 / The store’s word for it</h2>
        <p>
          Hirsch’s says “was”. Incredible Connection and HiFi Corp say “Normal
          Price”, beside a lower member price. Takealot’s crossed-out price may
          be a supplier’s recommended or list price, rather than a price
          Takealot charged. The HS5100 info tip checked on 12 November 2026 says
          “This is our List Price”. That store wording was backfilled into the
          35 Takealot comparison readings from this representative-page check;
          those earlier pages were not all revisited. Checkers’ uncaptured label
          remains “label not recorded”. We do not rename every comparison price
          “was”.
        </p>
        <dl className="method-list">
          <div>
            <dt>Claimed saving</dt>
            <dd>
              (Crossed-out price − price now) ÷ crossed-out price. A store’s
              printed percentage, if captured, is shown separately.
            </dd>
          </div>
          <div>
            <dt>Real saving</dt>
            <dd>
              (Reference price − price now) ÷ reference price, never below zero.
              When the price is higher, we also state the rand and percentage
              increase. The reference means “before”, as described below.
            </dd>
          </div>
          <div>
            <dt>The gap</dt>
            <dd>Claimed saving minus real saving, in percentage points.</dd>
          </div>
          <div>
            <dt>Spread</dt>
            <dd>
              A store’s crossed-out price ÷ the lowest crossed-out price quoted
              by any tracked store for that same product on that collection
              date, minus one. This compares quoted figures; it is not a verdict
              about what each store charged.
            </dd>
          </div>
        </dl>
      </section>
      <section>
        <h2>02 / What it cost before</h2>
        <p>
          <strong>Our own daily readings:</strong> find when the current price
          began. The reference is the lowest comparable price in the{" "}
          {rules.lookbackDays} days before that reduction. At least{" "}
          {rules.minimumHistoryDays} distinct daily readings are required before
          it. Missing days are never filled in; a gap at the price change means
          we cannot establish the reduction day. If the same price has held
          continuously for at least {rules.lookbackDays} days, the reference is
          today’s price and real saving is 0%.
        </p>
        <p>
          <strong>Monthly tracker points:</strong> use the latest supplied point
          at least {rules.lookbackDays} days before the collection date. Say
          exactly what it rests on: “on 1 Oct it was R…, Buck Cheap”, and show
          the next supplied point too. This is a dated reference comparison, not
          a reconstructed daily history or the lowest price in a full 30-day
          window.
        </p>
        <p>
          We prefer a qualifying daily baseline. Otherwise we use the dated
          reference for that exact retailer listing. Different listings are
          never spliced together. Without either baseline:{" "}
          <strong>TOO EARLY TO SAY · tracked since the first reading.</strong>{" "}
          Our first day stamps nothing from our own history; looked-up products
          can have reference-based stamps.
        </p>
      </section>
      <section>
        <h2>03 / What the stamp means</h2>
        <div className="stamp-rules">
          <div>
            <strong>LEGIT</strong>
            <span>Gap ≤ {rules.legitMaximumGap} pp</span>
          </div>
          <div>
            <strong>MEH</strong>
            <span>
              Gap &gt; {rules.legitMaximumGap}, ≤ {rules.mehMaximumGap} pp
            </span>
          </div>
          <div>
            <strong>TRUST ME BRU</strong>
            <span>Gap &gt; {rules.mehMaximumGap} pp</span>
          </div>
        </div>
        <p>
          No claimed saving means no stamp. Every stamp names its baseline and
          source. If a crossed-out price exceeds the tracker’s stated
          highest-price card, the slip shows both amounts plainly. The tracker’s
          summary date range is unspecified; that comparison does not establish
          a lifetime high.
        </p>
      </section>
      <section>
        <h2>04 / Conditions are part of the price</h2>
        <p>
          Incredible Connection and HiFi Corp offer lower prices with +more
          membership. We show the condition beside the price and label the
          claimed saving “members”. Other recorded conditions stay with their
          prices too.
        </p>
        <p>
          Our daily comparisons use matching recorded conditions.{" "}
          <strong>The tracker does not record conditions or sellers.</strong>{" "}
          Reference-based comparisons to a member price say so; they do not
          prove that the earlier price was available on the same terms. Product
          stamps can show this qualified reference comparison even when today’s
          seller is unconfirmed; those offers stay out of the leaderboard.
        </p>
        <p>
          Out-of-stock and marketplace offers are flagged and excluded from
          verdicts and board averages. Offers with unconfirmed sellers also stay
          out of board averages.
        </p>
      </section>
      <section>
        <h2>05 / What belongs to whom</h2>
        <p>
          Our browser and extension readings live in the local price log, at
          most once per product, store and South African calendar day. We never
          invent, estimate or carry forward a missing price. Each offer keeps
          its original reading date, even when shown beside a newer reading. An
          older saved price is never relabelled as today’s price.
        </p>
        <p>
          <a href="https://buck.cheap" target="_blank" rel="noreferrer">
            Buck Cheap
          </a>{" "}
          and{" "}
          <a href="https://servaltracker.com" target="_blank" rel="noreferrer">
            Serval
          </a>{" "}
          have been watching for longer. If you want price history today, use
          Buck Cheap. The public copy does not include their histories. Optional
          reference data stays separate from our own readings and is credited
          wherever used. Sparse tracker points are plotted separately, without a
          connecting line: we do not know when a change happened between them.
        </p>
        <p>
          <a
            href="https://www.pricecheck.co.za"
            target="_blank"
            rel="noreferrer"
          >
            PriceCheck
          </a>{" "}
          is another South African comparison service worth knowing. These are
          not affiliate links.
        </p>
      </section>
      <section>
        <h2>06 / The rule, and where we fall short</h2>
        <p>
          The EU’s price-reduction rule uses the lowest price in at least the 30
          days before a reduction, subject to its scope and exceptions. South
          Africa has no equivalent 30-day rule that we could find. Our stamps
          are measurements against stated baselines, not legal findings.
        </p>
        <p>
          This project falls short of a complete application of that rule:
          monthly reference points cannot establish the daily 30-day low, and
          our own minimum of two weeks is less than a complete 30-day record.
          The slip states which method and dates support each result.
        </p>
        <p className="fine-print">
          Sources:{" "}
          <a
            href="https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A52021XC1229%2806%29"
            target="_blank"
            rel="noreferrer"
          >
            European Commission guidance on Article 6a
          </a>{" "}
          ·{" "}
          <a
            href="https://www.gov.za/documents/consumer-protection-act"
            target="_blank"
            rel="noreferrer"
          >
            South African Consumer Protection Act
          </a>
          .
        </p>
      </section>
      <section>
        <h2>07 / A sample, not a store audit</h2>
        <p>
          The board covers sixty watched products. It averages eligible claims
          using each product and store’s latest saved reading, counting member
          claims. Each price retains its reading date; a partial day does not
          hide older offers or turn them into live quotes. The board shows the
          date range of each store’s sample. Spread needs another store’s
          reading for the same product on the same date; verdict and gap columns
          use only products with a “before”. Each column has its own sample
          size. Fewer than {rules.minimumStoreProducts} qualifying products in a
          column means “not enough data”.
        </p>
        <p>
          Delivery, location, availability, sellers and exact variants matter.
          Grocery prices may depend on an address we did not select. Each store
          may be telling the truth about its own earlier price; that is why the
          history sits beside its comparison.
        </p>
        <p>
          Makro and Game showed human checks on 11 November 2026. We stopped:
          “asks if you’re human, so not tracked”. Reference data from a tracker
          does not mean we collected those stores ourselves.
        </p>
      </section>
    </article>
  );
}
