"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Home, Layers, HelpCircle, Calendar, CreditCard, Archive, User } from "lucide-react";
import { LanguageSwitcher } from "@/components/I18nProvider";
import { useState, useEffect } from "react";
import { useT } from "@/lib/useT";
import { RecorderProvider, RecordingBar } from "@/lib/recorder";
import { useTr } from "@/lib/useTr";

// Design language is shared with the mobile app: white ground, #0f1115 text,
// #4B5FE8 brand blue, hairline rgba(0,0,0,0.08) borders.
const BRAND = "#4B5FE8";
const INK = "#0f1115";
const HAIRLINE = "rgba(0,0,0,0.08)";

// nav labels are translated inside the component via useT()

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const tr = useTr();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const t = useT();
  const nav = [
    { href: "/dashboard",          icon: Home,        label: t.nav.home      },
    { href: "/dashboard/record",   icon: Layers,      label: t.nav.workspace },
    { href: "/dashboard/calendar", icon: Calendar,    label: t.nav.calendar  },
    { href: "/dashboard/archive",  icon: Archive,     label: t.nav.archive   },
    { href: "/dashboard/account",  icon: User,        label: t.nav.account   },
    { href: "/dashboard/billing",  icon: CreditCard,  label: t.nav.billing   },
    { href: "/dashboard/help",     icon: HelpCircle,  label: t.nav.help      },
  ];
  // The phone-width tab bar mirrors the native app's five tabs; Billing and
  // Help stay reachable from the Account page rows.
  const tabs = nav.filter(n => n.href !== "/dashboard/billing" && n.href !== "/dashboard/help");

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    // The recorder lives here so a lecture keeps recording on every dashboard page.
    <RecorderProvider>
    <div className="flex flex-col md:flex-row h-screen overflow-hidden" style={{ background: "#FFFFFF" }}>

      {/* Sidebar — desktop only */}
      <aside
        className="hidden md:flex w-60 shrink-0 flex-col py-7"
        style={{ background: "#FFFFFF", borderRight: `1px solid ${HAIRLINE}` }}
      >
        {/* Logo */}
        <div className="px-6 pb-6 mb-3" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: BRAND }}
            >
              <Layers size={19} style={{ color: "white" }} />
            </div>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 22, color: INK, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
                Ucorns
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(15,17,21, 0.73)" }}>{tr("Study Assistant")}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-2 flex flex-col gap-1 overflow-y-auto">
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(15,17,21, 0.73)", padding: "8px 10px 8px" }}>
            {t.nav.menu}
          </div>
          {nav.map(({ href, icon: Icon, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-colors"
                style={{
                  fontSize: 16,
                  background: active ? "rgba(75,95,232,0.10)" : "transparent",
                  border: active ? "1px solid rgba(75,95,232,0.22)" : "1px solid transparent",
                  color: active ? BRAND : "rgba(15,17,21,0.68)",
                  fontWeight: active ? 700 : 500,
                }}
              >
                <Icon size={19} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 pt-4 mt-2 flex flex-col gap-3" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <LanguageSwitcher />
          <div className="px-2">
            {mounted && <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-4 py-5 md:px-10 md:py-9 pb-28 md:pb-9">
        {children}
      </main>

      {/* Bottom tab bar — mobile only */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around px-1 pt-2 z-50 safe-bottom"
        style={{ background: "rgba(255,255,255,0.96)", backdropFilter: "blur(14px)", borderTop: `1px solid ${HAIRLINE}`, paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
      >
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-colors"
              style={{ color: active ? BRAND : "rgba(15,17,21,0.55)" }}
            >
              <Icon size={21} />
              <span style={{ fontSize: 12.5, fontWeight: active ? 700 : 500 }}>{label}</span>
            </Link>
          );
        })}
      </nav>

      <RecordingBar />
    </div>
    </RecorderProvider>
  );
}
