"use client";
import Link from "next/link";
import { Layers } from "lucide-react";

export function Navbar() {
  return (
    <header className="fixed left-0 right-0 z-50 flex justify-center px-4" style={{ top: 20, pointerEvents: "none" }}>
      <div
        className="flex items-center justify-between px-4 md:px-8 w-full"
        style={{
          maxWidth: 820,
          height: 64,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 999,
          pointerEvents: "all",
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" style={{ textDecoration: "none" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#2563eb" }}>
            <Layers size={13} style={{ color: "white" }} />
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#111110", letterSpacing: "-0.4px" }}>
            Fl<span style={{ color: "#2563eb" }}>u</span>x
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
              className="navbar-link"
              style={{ fontSize: 16, fontWeight: 500, textDecoration: "none" }}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Auth buttons */}
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="navbar-link hidden md:block"
            style={{ fontSize: 16, fontWeight: 500, textDecoration: "none", padding: "8px 16px", borderRadius: 999 }}
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="font-semibold"
            style={{ fontSize: 15, background: "#2563eb", color: "white", textDecoration: "none", padding: "9px 22px", borderRadius: 999 }}
          >
            Get started
          </Link>
        </div>
      </div>

      <style>{`
        .navbar-link { color: rgba(0,0,0,0.5); transition: color 0.15s; }
        .navbar-link:hover { color: #2563eb; }
      `}</style>
    </header>
  );
}
