import Link from "next/link";
import { Layers } from "lucide-react";

/**
 * Shared shell for the Privacy Policy and Terms. Plain, readable, and
 * deliberately unbranded-looking: these pages are read by app stores, payment
 * providers and the occasional worried parent, not scrolled past.
 */
export function LegalPage({
  title, updated, children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main style={{ background: "#FFFFFF", minHeight: "100vh" }}>
      <div className="mx-auto px-6 md:px-8" style={{ maxWidth: 760, paddingBlock: "48px 96px" }}>
        <Link href="/" className="inline-flex items-center gap-2.5 mb-10" style={{ textDecoration: "none" }}>
          <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#4B5FE8" }}>
            <Layers size={15} style={{ color: "#fff" }} />
          </span>
          <span style={{ fontSize: 19, fontWeight: 800, color: "#111110", letterSpacing: "-0.4px" }}>
            Fl<span style={{ color: "#4B5FE8" }}>u</span>x
          </span>
        </Link>

        <h1 style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800,
          fontSize: "clamp(30px, 5vw, 40px)", letterSpacing: "-0.03em", color: "#0f1115", margin: 0,
        }}>{title}</h1>
        <p style={{ fontSize: 15, color: "rgba(15,17,21,0.55)", marginTop: 10 }}>Last updated {updated}</p>

        <div className="legal-body">{children}</div>

        <div style={{ marginTop: 56, paddingTop: 22, borderTop: "1px solid rgba(0,0,0,0.1)", display: "flex", gap: 22, flexWrap: "wrap" }}>
          <Link href="/privacy" style={{ fontSize: 15, color: "#4B5FE8" }}>Privacy Policy</Link>
          <Link href="/terms" style={{ fontSize: 15, color: "#4B5FE8" }}>Terms of Service</Link>
          <Link href="/" style={{ fontSize: 15, color: "rgba(15,17,21,0.6)" }}>Back to Flux</Link>
        </div>
      </div>

      <style>{`
        .legal-body { margin-top: 34px; color: rgba(15,17,21,0.82); font-size: 16.5px; line-height: 1.72; }
        .legal-body h2 {
          font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 21px;
          letter-spacing: -0.015em; color: #0f1115; margin: 40px 0 12px;
        }
        .legal-body h3 { font-weight: 700; font-size: 17px; color: #0f1115; margin: 24px 0 8px; }
        .legal-body p { margin: 0 0 14px; }
        .legal-body ul { margin: 0 0 16px; padding-left: 22px; }
        .legal-body li { margin-bottom: 8px; }
        .legal-body strong { color: #0f1115; font-weight: 650; }
        .legal-body a { color: #4B5FE8; }
        .legal-body table { width: 100%; border-collapse: collapse; margin: 6px 0 20px; font-size: 15.5px; }
        .legal-body th, .legal-body td { text-align: left; padding: 9px 12px 9px 0; border-bottom: 1px solid rgba(0,0,0,0.08); vertical-align: top; }
        .legal-body th { font-weight: 700; color: #0f1115; }
        .legal-body .fill { background: #FFF4D6; padding: 1px 6px; border-radius: 4px; font-weight: 600; color: #7A5B00; }
        .legal-body .callout {
          background: rgba(75,95,232,0.06); border: 1px solid rgba(75,95,232,0.22);
          border-radius: 14px; padding: 16px 18px; margin: 18px 0;
        }
        .legal-body .callout p:last-child { margin-bottom: 0; }
      `}</style>
    </main>
  );
}

/** Marks a detail only the company can supply, so it is obvious before publishing. */
export function Fill({ children }: { children: React.ReactNode }) {
  return <span className="fill">{children}</span>;
}
