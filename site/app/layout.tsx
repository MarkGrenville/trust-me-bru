import type { Metadata } from "next";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";
import { Nav } from "@/components/nav";
import { ReceiptFooter } from "@/components/receipt";

export const metadata: Metadata = {
  title: {
    default: "Trust Me Bru — check the receipt",
    template: "%s · Trust Me Bru",
  },
  description:
    "South African Black Friday price checks. What the store claims. What we saw. Dates included.",
};
export const dynamic = "force-dynamic";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-ZA" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">
          Skip to the receipt
        </a>
        <div className="site-shell">
          <Nav />
          <main id="main" className="receipt">
            {children}
            <ReceiptFooter />
          </main>
          <p className="counter-footer">
            A SMALL INDEPENDENT PROJECT BY MARK GRENVILLE.
            <span>NO ACCOUNTS. NO AFFILIATE LINKS. JUST THE RECEIPTS.</span>
          </p>
        </div>
      </body>
    </html>
  );
}
