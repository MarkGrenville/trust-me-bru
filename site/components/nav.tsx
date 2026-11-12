"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="masthead">
      <Link href="/" className="brand" aria-label="Trust Me Bru home">
        TRUST ME
        <br />
        <span>BRU.</span>
        <span className="brand-dot" aria-hidden="true" />
      </Link>
      <nav aria-label="Main navigation">
        {[
          ["/", "Price checks"],
          ["/board", "Store board"],
          ["/how", "The small print"],
        ].map(([href, label]) => (
          <Link
            href={href}
            key={href}
            aria-current={
              (
                href === "/"
                  ? pathname === "/" || pathname.startsWith("/p/")
                  : pathname === href
              )
                ? "page"
                : undefined
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      <span className="local-label">
        INDEPENDENT PRICE CHECKS
        <br />
        SOUTH AFRICA / ZAR
      </span>
    </header>
  );
}
