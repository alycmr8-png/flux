"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Home, Layers, HelpCircle, Calendar, BarChart2, CreditCard, Archive, Check, Zap } from "lucide-react";
import { LanguageSwitcher } from "@/components/I18nProvider";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { useApiSWRFetcher, useApiFetch } from "@/lib/apiFetch";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const PLANS = [
  {
    id: "student",
    name: "Student",
    price: "$8",
    period: "/mo",
    badge: "Most popular",
    features: ["Unlimited recordings", "AI summaries & quizzes", "Key points & flashcards", "YouTube video analysis", "Upload files (PDF, PPT, Word)"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$15",
    period: "/mo",
    badge: null,
    features: ["Everything in Student", "Priority AI processing", "Study calendar & planning", "Retention analytics", "Google Drive sync"],
  },
];

const nav = [
  { href: "/dashboard",          icon: Home,        label: "Home"      },
  { href: "/dashboard/record",   icon: Layers,      label: "Workspace" },
  { href: "/dashboard/calendar", icon: Calendar,    label: "Calendar"  },
  { href: "/dashboard/progress", icon: BarChart2,   label: "Progress"  },
  { href: "/dashboard/archive",  icon: Archive,     label: "Archive"   },
  { href: "/dashboard/billing",  icon: CreditCard,  label: "Billing"   },
  { href: "/dashboard/help",     icon: HelpCircle,  label: "Help"      },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const fetcher = useApiSWRFetcher();
  const { data: billingData, isLoading: billingLoading } = useSWR(
    mounted ? `${BASE}/api/billing/status` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const plan: string | null = billingData?.data?.plan ?? null;
  const isSubscribed = plan !== null && plan !== "free";
  const isBillingPage = pathname.startsWith("/dashboard/billing");

  // Show paywall if free plan and not on billing page
  const showPaywall = !billingLoading && plan === "free" && !isBillingPage;
  // While loading, show nothing in main (avoids flash of real content)
  const showContent = isBillingPage || isSubscribed;

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden" style={{ background: "#111110" }}>

      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-52 shrink-0 flex-col py-7" style={{ background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="px-6 pb-6 mb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#2563eb" }}>
              <Layers size={15} style={{ color: "white" }} />
            </div>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 20, color: "white", letterSpacing: "-0.5px", lineHeight: 1.1 }}>Flux</div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Study Assistant</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 pt-2 flex flex-col gap-1">
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", padding: "8px 10px 6px" }}>Menu</div>
          {nav.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link key={href} href={href} className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all"
                style={{ fontSize: 15, background: active ? "rgba(37,99,235,0.18)" : "transparent", color: active ? "#60a5fa" : "rgba(255,255,255,0.45)", fontWeight: active ? 600 : 500 }}>
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pt-3 flex flex-col gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <LanguageSwitcher />
          <div className="px-2">{mounted && <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />}</div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto px-4 py-5 md:px-10 md:py-9 pb-24 md:pb-9">
        {showContent ? (
          children
        ) : showPaywall ? (
          <PaywallScreen />
        ) : null /* loading — blank to avoid flash */}
      </main>

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around px-1 py-2 z-50"
        style={{ background: "#111110", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all"
              style={{ color: active ? "#3b82f6" : "rgba(255,255,255,0.38)" }}>
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

function PaywallScreen() {
  const apiFetch = useApiFetch();
  const [loading, setLoading] = useState<string | null>(null);

  async function upgrade(plan: "student" | "pro") {
    setLoading(plan);
    try {
      const res = await apiFetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.data?.url) window.location.href = res.data.url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-16 px-4">
      {/* Logo mark */}
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6" style={{ background: "#2563eb" }}>
        <Layers size={22} style={{ color: "white" }} />
      </div>

      <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 28, color: "white", letterSpacing: "-0.02em", textAlign: "center", marginBottom: 8 }}>
        Start your free trial
      </h1>
      <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, textAlign: "center", maxWidth: 360, lineHeight: 1.6, marginBottom: 32 }}>
        7 days free, then choose a plan. Cancel anytime. No credit card required to start.
      </p>

      {/* Plan cards */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xl mb-8">
        {PLANS.map(plan => (
          <div key={plan.id} className="flex-1 rounded-2xl p-5 flex flex-col"
            style={{
              background: plan.id === "student" ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.05)",
              border: plan.id === "student" ? "1px solid rgba(37,99,235,0.4)" : "1px solid rgba(255,255,255,0.1)",
            }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 15, fontWeight: 700, color: "white" }}>{plan.name}</span>
              {plan.badge && (
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", background: "#2563eb", color: "white", padding: "2px 8px", borderRadius: 999 }}>
                  {plan.badge}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1 mb-4">
              <span style={{ fontSize: 26, fontWeight: 300, color: "white" }}>{plan.price}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{plan.period}</span>
            </div>
            <ul className="space-y-2 flex-1 mb-5">
              {plan.features.map(f => (
                <li key={f} className="flex items-start gap-2" style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                  <Check size={11} style={{ color: plan.id === "student" ? "#60a5fa" : "rgba(255,255,255,0.4)", marginTop: 1, flexShrink: 0 }} />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => upgrade(plan.id as "student" | "pro")}
              disabled={!!loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              style={{
                background: plan.id === "student" ? "#2563eb" : "rgba(255,255,255,0.1)",
                color: "white",
              }}>
              <Zap size={13} />
              {loading === plan.id ? "Loading…" : "Start free trial"}
            </button>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
        Already subscribed?{" "}
        <Link href="/dashboard/billing" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "underline" }}>
          Manage billing
        </Link>
      </p>
    </div>
  );
}
