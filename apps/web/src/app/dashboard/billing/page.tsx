"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Check, Zap, ArrowRight } from "lucide-react";
import { useApiFetch, useApiSWRFetcher } from "@/lib/apiFetch";
import { PLANS, PLAN_FEATURES, PLAN_LABEL, type PaidPlanId } from "@/lib/plans";
import { apiBase } from "@/lib/apiBase";
import { useTr } from "@/lib/useTr";

const BASE = apiBase();

// Plans live in one shared file so this page can't drift from the landing page.
const PAID_PLANS = PLANS.filter((p) => p.id !== "free");

export default function BillingPage() {
  const tr = useTr();
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "1";
  const fetcher = useApiSWRFetcher();
  const apiFetch = useApiFetch();
  const { data, isLoading } = useSWR(`${BASE}/api/billing/status`, fetcher);
  const currentPlan: string = data?.data?.plan ?? "free";
  const [loading, setLoading] = useState<string | null>(null);

  const isNew = currentPlan === "free" && !success;

  async function upgrade(plan: PaidPlanId) {
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

  const planLabel = PLAN_LABEL;

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      {isNew ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(0,0,0, 0.64)", marginBottom: 6 }}>{tr("Billing")}</div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 30, color: "#1F2328", marginBottom: 28 }}>{tr("Choose your plan")}</h1>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(0,0,0, 0.64)", marginBottom: 6 }}>{tr("Account")}</div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 30, color: "#1F2328", marginBottom: 28 }}>{tr("Billing")}</h1>
        </>
      )}

      {/* Success banner */}
      {success && (
        <div className="bg-[rgba(16,185,129,0.10)] border border-[rgba(16,185,129,0.3)] rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 text-[#4caf50] mb-3">
            <Check size={16} />
            <span className="text-[15.5px] font-medium">
              You&apos;re on {planLabel[currentPlan]} — welcome to Ucorns!
            </span>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 bg-indigo-600 text-white text-[15.5px] font-medium px-5 py-2.5 rounded-full hover:bg-indigo-500 transition-colors"
          >{tr("Start using Ucorns")}<ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Current plan — only shown to paying users */}
      {!isLoading && currentPlan !== "free" && !success && (
        <div className="bg-[#FFFFFF] border border-[rgba(0,0,0,0.09)] rounded-2xl p-5 mb-6">
          <div className="text-[10px] text-gray-800 uppercase tracking-widest mb-3">{tr("Current plan")}</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-900 font-medium text-lg">{planLabel[currentPlan]}</div>
              <div className="text-[13.5px] text-gray-800 mt-0.5">{tr("20 hours of recording a month · recordings up to 3 hours")}</div>
            </div>
            <button
              onClick={openPortal}
              disabled={loading === "portal"}
              className="text-[13.5px] border border-[rgba(0,0,0,0.08)] text-gray-800 hover:text-gray-900 hover:border-[rgba(148,163,184,0.4)] rounded-full px-4 py-2 transition-colors disabled:opacity-50"
            >
              {loading === "portal" ? tr("Loading…") : "Manage subscription"}
            </button>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="space-y-3">
        {PAID_PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const canUpgrade = currentPlan === "free";
          const featured = plan.recommended && !isCurrent;

          return (
            <div
              key={plan.id}
              className="rounded-2xl p-5 flex items-start justify-between gap-4"
              style={{
                background: "#FFFFFF",
                border: featured ? "2px solid #4B5FE8" : "1px solid rgba(0,0,0,0.1)",
                boxShadow: featured ? "0 10px 30px rgba(75,95,232,0.14)" : "none",
              }}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[17px] font-bold text-gray-900">{plan.name}</span>
                  {plan.badge && !isCurrent && (
                    <span className="text-[12px] font-bold uppercase tracking-wider rounded-full px-2.5 py-0.5 text-white"
                      style={{ background: featured ? "#4B5FE8" : "#0f1115" }}>
                      {featured ? `Best value · ${plan.badge}` : plan.badge}
                    </span>
                  )}
                  {isCurrent && (
                    <span className="text-[12px] font-bold uppercase tracking-wider border border-[rgba(0,0,0,0.12)] text-gray-800 rounded-full px-2.5 py-0.5">{tr("Current")}</span>
                  )}
                </div>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[28px] text-gray-900 font-bold">{plan.price}</span>
                  <span className="text-gray-700 text-[15px]">{plan.period}</span>
                  {plan.perMonth && <span className="text-[15px] font-semibold ml-1" style={{ color: "#4B5FE8" }}>{plan.perMonth}</span>}
                </div>
                <div className="text-[15px] text-gray-800 mt-1">{plan.tagline}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                  {plan.limits.map((l) => (
                    <div key={l} className="flex items-center gap-1.5 text-[14.5px] text-gray-800">
                      <Check size={13} className="shrink-0" style={{ color: "#4B5FE8" }} />
                      {l}
                    </div>
                  ))}
                </div>
              </div>

              {!isCurrent && canUpgrade && (
                <button
                  onClick={() => upgrade(plan.id as PaidPlanId)}
                  disabled={!!loading}
                  className="flex items-center gap-1.5 text-[15px] font-semibold px-5 py-2.5 rounded-full transition-opacity disabled:opacity-50 shrink-0 mt-1 hover:opacity-90"
                  style={featured ? { background: "#4B5FE8", color: "#FFFFFF" } : { border: "1px solid rgba(0,0,0,0.15)", color: "#0f1115" }}
                >
                  <Zap size={13} />
                  {loading === plan.id ? tr("Loading…") : "Start free trial"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl p-6" style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)" }}>
        <div className="text-[16px] font-bold text-gray-900 mb-4">{tr("Every plan includes")}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
          {PLAN_FEATURES.map((f) => (
            <div key={f} className="flex items-center gap-2 text-[15px] text-gray-800">
              <Check size={14} className="shrink-0" style={{ color: "#4B5FE8" }} />
              {f}
            </div>
          ))}
        </div>
      </div>

      <p className="text-[13.5px] text-gray-700 mt-6 text-center">{tr("Paid plans start with a 7-day free trial. Cancel anytime.")}</p>
    </div>
  );
}

