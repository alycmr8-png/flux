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
    <div
      className="flex flex-col md:flex-row h-screen overflow-hidden"
      style={{
        background:
          "radial-gradient(90% 60% at 70% -10%, rgba(75,95,232,0.05) 0%, rgba(75,95,232,0) 55%), #FBFBFA",
      }}
    >

      {/* Sidebar — desktop only */}
      <aside
        className="hidden md:flex w-52 shrink-0 flex-col py-7"
        style={{ background: "#F7F6F4", borderRight: "1px solid rgba(0,0,0,0.07)" }}
      >
        {/* Logo */}
        <div className="px-6 pb-6 mb-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#4B5FE8,#6E7FF3)", boxShadow: "0 4px 14px rgba(75,95,232,0.35)" }}>
              <Layers size={17} style={{ color: "white" }} />
            </div>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 20, color: "#1F2328", letterSpacing: "-0.5px", lineHeight: 1.1 }}>
                Flux
              </div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(31,35,40,0.5)" }}>
                Study Assistant
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-2 flex flex-col gap-1">
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(31,35,40,0.45)", padding: "8px 10px 6px" }}>
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
                  background: active
                    ? "linear-gradient(135deg, rgba(75,95,232,0.26) 0%, rgba(110,127,243,0.12) 100%)"
                    : "transparent",
                  border: active ? "1px solid rgba(110,127,243,0.28)" : "1px solid transparent",
                  boxShadow: active ? "0 4px 18px rgba(75,95,232,0.18)" : "none",
                  color: active ? "#3D4ED0" : "rgba(31,35,40,0.6)",
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
        <div className="px-3 pt-3 flex flex-col gap-3" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
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
        style={{ background: "rgba(251,251,250,0.94)", backdropFilter: "blur(14px)", borderTop: "1px solid rgba(0,0,0,0.07)", paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
      >
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all"
              style={{ color: active ? "#4B5FE8" : "rgba(31,35,40,0.5)" }}
            >
              <Icon size={19} />
              <span className="text-[9px] font-medium">{label}</span>
            </Link>
          );
        })}
        <div className="flex flex-col items-center gap-0.5 px-2 py-1.5">
          {mounted && <UserButton appearance={{ elements: { avatarBox: "w-5 h-5" } }} />}
          <span className="text-[9px] font-medium" style={{ color: "rgba(31,35,40,0.58)" }}>{t.nav.account}</span>
        </div>
      </nav>
    </div>
  );
}
