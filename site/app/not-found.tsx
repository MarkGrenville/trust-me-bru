import Link from "next/link";
export default function NotFound() {
  return (
    <section className="empty-page">
      <p className="eyebrow">RECEIPT NOT FOUND / 404</p>
      <h1>Not on the watchlist.</h1>
      <p>We don’t have a price check for that product.</p>
      <Link className="button" href="/">
        Back to price checks →
      </Link>
    </section>
  );
}
