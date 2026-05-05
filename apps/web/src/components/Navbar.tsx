"use client";
import Link from "next/link";
import { Layers } from "lucide-react";

export function Navbar() {
  return (
    <header className="fixed left-0 right-0 z-50 flex justify-center px-4" style={{ top: 20, pointerEvents: "none" }}>
      <div
        className="flex items-center justify-between px-8 w-full"
        style={{
          maxWidth: 780,
          height: 60,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 999,
          pointerEvents: "all",
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" style={{ textDecoration: "none" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#111110" }}>
            <Layers size={13} style={{ color: "white" }} />
          </div>
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontSize: 20, fontWeight: 500, color: "#111110", letterSpacing: "-0.3px" }}>
            Flux
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-8">
          {[
            { label: "Features", href: "#features" },
            { label: "Pricing",  href: "#pricing"  },
            { label: "FAQ",      href: "#faq"      },
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              style={{ fontSize: 14, color: "rgba(0,0,0,0.45)", textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#111110")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(0,0,0,0.45)")}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Auth buttons */}
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            style={{ fontSize: 14, color: "rgba(0,0,0,0.45)", textDecoration: "none", padding: "7px 14px", borderRadius: 999, transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#111110")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(0,0,0,0.45)")}
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="font-medium"
            style={{ fontSize: 13, background: "#111110", color: "white", textDecoration: "none", padding: "8px 20px", borderRadius: 999 }}
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

