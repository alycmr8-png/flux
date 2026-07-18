"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Check, Zap, ArrowRight } from "lucide-react";
import { useApiFetch, useApiSWRFetcher } from "@/lib/apiFetch";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const SHARED_FEATURES = [
  "Ask your course — answers with sources",
  "Unlimited recordings & uploads",
  "AI summaries, key points & flashcards",
  "Study books from your course memory",
  "Calendar, notes & YouTube import",
];

const PLANS = [
  {
    id: "monthly",
    name: "Monthly",
    price: "$9.99",
    period: "/mo",
    annual: "billed monthly",
    highlight: false,
    features: SHARED_FEATURES,
  },
  {
    id: "6month",
    name: "6-Month",
    price: "$6.99",
    period: "/mo",
    annual: "$41.94 every 6 months · Save 30%",
    highlight: true,
    features: SHARED_FEATURES,
  },
  {
    id: "yearly",
    name: "Yearly",
    price: "$5.99",
    period: "/mo",
    annual: "$71.88 per year · Save 40%",
    highlight: false,
    features: SHARED_FEATURES,
  },
];

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "1";
  const fetcher = useApiSWRFetcher();
  const apiFetch = useApiFetch();
  const { data, isLoading } = useSWR(`${BASE}/api/billing/status`, fetcher);
  const currentPlan: string = data?.data?.plan ?? "free";
  const [loading, setLoading] = useState<string | null>(null);

  const isNew = currentPlan === "free" && !success;

  async function upgrade(plan: "monthly" | "6month" | "yearly") {
    setLoading(plan);
    try {
      const res = await apiFetch(`/api/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.data?.url) window.location.href = res.data.url;
    } finally {
      setLoading(null);
    }
  }

  async function openPortal() {
    setLoading("portal");
    try {
      const res = await apiFetch(`/api/billing/portal`, { method: "POST" });
      if (res.data?.url) window.location.href = res.data.url;
    } finally {
      setLoading(null);
    }
  }

  const planLabel: Record<string, string> = { free: "Free", monthly: "Monthly", "6month": "6-Month", yearly: "Yearly", student: "Student", pro: "Pro" };

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      {isNew ? (
        <>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", marginBottom: 6 }}>Billing</div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 30, color: "#1F2328", marginBottom: 28 }}>Choose your plan</h1>
        </>
      ) : (
        <>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", marginBottom: 6 }}>Account</div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 30, color: "#1F2328", marginBottom: 28 }}>Billing</h1>
        </>
      )}

      {/* Success banner */}
      {success && (
        <div className="bg-[rgba(16,185,129,0.10)] border border-[rgba(16,185,129,0.3)] rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 text-[#4caf50] mb-3">
            <Check size={16} />
            <span className="text-sm font-medium">
              You&apos;re on {planLabel[currentPlan]} — welcome to Flux!
            </span>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-indigo-500 transition-colors"
          >
            Start using Flux <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Current plan — only shown to paying users */}
      {!isLoading && currentPlan !== "free" && !success && (
        <div className="bg-[#FFFFFF] border border-[rgba(0,0,0,0.09)] rounded-2xl p-5 mb-6">
          <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">Current plan</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-900 font-medium text-lg">{planLabel[currentPlan]}</div>
              <div className="text-xs text-gray-600 mt-0.5">Unlimited recordings</div>
            </div>
            <button
              onClick={openPortal}
              disabled={loading === "portal"}
              className="text-xs border border-[rgba(0,0,0,0.08)] text-gray-600 hover:text-gray-900 hover:border-[rgba(148,163,184,0.4)] rounded-full px-4 py-2 transition-colors disabled:opacity-50"
            >
              {loading === "portal" ? "Loading…" : "Manage subscription"}
            </button>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="space-y-3">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const canUpgrade = currentPlan === "free";

          return (
            <div
              key={plan.id}
              className={`border rounded-2xl p-5 flex items-start justify-between gap-4 ${
                plan.highlight && !isCurrent
                  ? "border-black bg-[#FFFFFF]"
                  : isCurrent
                  ? "border-[rgba(0,0,0,0.10)] bg-[#FFFFFF]"
                  : "border-[rgba(0,0,0,0.09)] bg-[#F7F6F4]"
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">{plan.name}</span>
                  {plan.highlight && !isCurrent && (
                    <span className="text-[9px] font-bold uppercase tracking-widest bg-indigo-600 text-white rounded-full px-2 py-0.5">
                      Popular
                    </span>
                  )}
                  {isCurrent && (
                    <span className="text-[9px] font-bold uppercase tracking-widest border border-[rgba(0,0,0,0.08)] text-gray-600 rounded-full px-2 py-0.5">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-2xl text-gray-900 font-light">{plan.price}</span>
                  <span className="text-gray-600 text-xs">{plan.period}</span>
                  {plan.annual && (
                    <span className="text-gray-500 text-xs ml-1">{plan.annual}</span>
                  )}
                </div>
                <div className="space-y-1.5 mt-3">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs text-gray-600">
                      <Check size={10} className="text-gray-600 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>

              {!isCurrent && canUpgrade && (
                <button
                  onClick={() => upgrade(plan.id as "monthly" | "6month" | "yearly")}
                  disabled={!!loading}
                  className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 rounded-full transition-colors disabled:opacity-50 shrink-0 mt-1 ${
                    plan.highlight
                      ? "bg-indigo-600 text-white hover:bg-indigo-500"
                      : "border border-[rgba(0,0,0,0.08)] text-gray-900 hover:border-[rgba(148,163,184,0.4)]"
                  }`}
                >
                  <Zap size={11} />
                  {loading === plan.id ? "Loading…" : "Upgrade"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mt-6 text-center">
        7-day free trial on all plans. Cancel anytime.
      </p>
    </div>
  );
}

