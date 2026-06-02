"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Home, Layers, HelpCircle, Calendar, CreditCard, Archive } from "lucide-react";
import { LanguageSwitcher } from "@/components/I18nProvider";
import { useState, useEffect } from "react";
import { useT } from "@/lib/useT";

// nav labels are translated inside the component via useT()

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const t = useT();
  const nav = [
    { href: "/dashboard",          icon: Home,        label: t.nav.home      },
    { href: "/dashboard/record",   icon: Layers,      label: t.nav.workspace },
    { href: "/dashboard/calendar", icon: Calendar,    label: t.nav.calendar  },
    { href: "/dashboard/archive",  icon: Archive,     label: t.nav.archive   },
    { href: "/dashboard/billing",  icon: CreditCard,  label: t.nav.billing   },
    { href: "/dashboard/help",     icon: HelpCircle,  label: t.nav.help      },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden" style={{ background: "#111110" }}>

      {/* Sidebar — desktop only */}
      <aside
        className="hidden md:flex w-52 shrink-0 flex-col py-7"
        style={{ background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Logo */}
        <div className="px-6 pb-6 mb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#2563eb" }}>
              <Layers size={15} style={{ color: "white" }} />
            </div>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 20, color: "white", letterSpacing: "-0.5px", lineHeight: 1.1 }}>
                Flux
              </div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
                Study Assistant
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-2 flex flex-col gap-1">
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", padding: "8px 10px 6px" }}>
            {t.nav.menu}
          </div>
          {nav.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all"
                style={{
                  fontSize: 15,
                  background: active ? "rgba(37,99,235,0.18)" : "transparent",
                  color: active ? "#60a5fa" : "rgba(255,255,255,0.45)",
                  fontWeight: active ? 600 : 500,
                }}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 pt-3 flex flex-col gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <LanguageSwitcher />
          <div className="px-2">
            {mounted && <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-4 py-5 md:px-10 md:py-9 pb-24 md:pb-9">
        {children}
      </main>

      {/* Bottom tab bar — mobile only */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around px-1 py-2 z-50"
        style={{ background: "#111110", borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all"
              style={{ color: active ? "#3b82f6" : "rgba(255,255,255,0.38)" }}
            >
              <Icon size={19} />
              <span className="text-[9px] font-medium">{label}</span>
            </Link>
          );
        })}
        <div className="flex flex-col items-center gap-0.5 px-2 py-1.5">
          {mounted && <UserButton appearance={{ elements: { avatarBox: "w-5 h-5" } }} />}
          <span className="text-[9px] font-medium" style={{ color: "rgba(255,255,255,0.38)" }}>{t.nav.account}</span>
        </div>
      </nav>
    </div>
  );
}
