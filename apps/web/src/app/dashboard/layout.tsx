"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Home, Layers, FileText, Calendar, BarChart2, CreditCard, Archive } from "lucide-react";
import { LanguageSwitcher } from "@/components/I18nProvider";
import { useState, useEffect } from "react";

const nav = [
  { href: "/dashboard",          icon: Home,      label: "Home"      },
  { href: "/dashboard/record",   icon: Layers,    label: "Workspace" },
  { href: "/dashboard/summaries",icon: FileText,  label: "Summaries" },
  { href: "/dashboard/calendar", icon: Calendar,  label: "Calendar"  },
  { href: "/dashboard/progress", icon: BarChart2, label: "Progress"  },
  { href: "/dashboard/archive",  icon: Archive,   label: "Archive"   },
  { href: "/dashboard/billing",  icon: CreditCard,label: "Billing"   },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden" style={{ background: "#111110" }}>

      {/* Sidebar — desktop only */}
      <aside
        className="hidden md:flex w-52 shrink-0 flex-col py-7"
        style={{ background: "rgba(255,255,255,0.04)", borderRight: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Logo */}
        <div className="px-6 pb-6 mb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "white" }}>
              <Layers size={15} style={{ color: "#111110" }} />
            </div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontSize: 20, fontWeight: 500, color: "white", letterSpacing: "-0.5px", lineHeight: 1.1 }}>
                Flux
              </div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
                Study Assistant
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-2 flex flex-col gap-0.5">
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", padding: "8px 10px 6px" }}>
            Menu
          </div>
          {nav.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all"
                style={{
                  background: active ? "rgba(255,255,255,0.12)" : "transparent",
                  color: active ? "white" : "rgba(255,255,255,0.45)",
                  fontWeight: active ? 500 : 400,
                }}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 pt-3 flex flex-col gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
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
              style={{ color: active ? "white" : "rgba(255,255,255,0.38)" }}
            >
              <Icon size={19} />
              <span className="text-[9px] font-medium">{label}</span>
            </Link>
          );
        })}
        <div className="flex flex-col items-center gap-0.5 px-2 py-1.5">
          {mounted && <UserButton appearance={{ elements: { avatarBox: "w-5 h-5" } }} />}
          <span className="text-[9px] font-medium" style={{ color: "rgba(255,255,255,0.38)" }}>Account</span>
        </div>
      </nav>
    </div>
  );
}

