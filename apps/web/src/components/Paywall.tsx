"use client";
import { useState } from "react";
import { Check, X, Zap } from "lucide-react";
import { useApiFetch } from "@/lib/apiFetch";
import { PLANS, PLAN_FEATURES, type PaidPlanId } from "@/lib/plans";
import { useTr } from "@/lib/useTr";

/**
 * What a student sees when their free lectures are spent.
 *
 * This is the highest-intent moment in the product — they have just tried to record
 * a real class and want to — so it is deliberately not styled as an error. Upgrading
 * happens here, in one click, rather than sending them off to find the Billing page.
 */
export default function Paywall({
  reason,
  onClose,
}: {
  reason: "lecture" | "minutes";
  onClose: () => void;
}) {
  const tr = useTr();
  const apiFetch = useApiFetch();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paid = PLANS.filter((p) => p.id !== "free");

  async function upgrade(plan: PaidPlanId) {
    setLoading(plan);
    setError(null);
    try {
      const res = await apiFetch(`/api/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.data?.url) window.location.href = res.data.url;
      else setError(tr("Couldn't start checkout — try again in a moment."));
    } catch (e: any) {
      setError(
        /"error":"([^"]+)"/.exec(String(e?.message ?? ""))?.[1]
          ?? tr("Couldn't start checkout — try again in a moment."),
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(10,12,20,0.55)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: 24,
          width: "100%",
          maxWidth: 560,
          margin: "auto",
          boxShadow: "0 24px 70px rgba(15,17,21,0.28)",
          overflow: "hidden",
        }}
      >
        {/* Header — states the value, not the restriction. */}
        <div style={{ padding: "28px 28px 22px", background: "linear-gradient(160deg, #4B5FE8 0%, #3A49C4 100%)", color: "#FFFFFF", position: "relative" }}>
          <button
            onClick={onClose}
            aria-label={tr("Close")}
            style={{
              position: "absolute", top: 16, right: 16, width: 32, height: 32,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 999, border: "none", cursor: "pointer",
              background: "rgba(255,255,255,0.18)", color: "#FFFFFF",
            }}
          >
            <X size={16} />
          </button>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.85, marginBottom: 8 }}>
            {reason === "lecture" ? tr("Free lectures used") : tr("Recording time used")}
          </div>
          <h2
            id="paywall-title"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 26, lineHeight: 1.2, margin: 0, textWrap: "balance" }}
          >
            {tr("Keep every lecture this semester")}
          </h2>
          <p style={{ fontSize: 15.5, opacity: 0.92, margin: "10px 0 0", maxWidth: "46ch" }}>
            {reason === "lecture"
              ? tr("You've used your free lectures. Upgrade to record every class, with notes, flashcards and quizzes for each one.")
              : tr("You've used the free recording time. Upgrade to record every class, with notes, flashcards and quizzes for each one.")}
          </p>
        </div>

        <div style={{ padding: 22 }}>
          {error && (
            <div
              role="alert"
              style={{
                borderRadius: 14, padding: "12px 14px", marginBottom: 14,
                background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.28)",
                fontSize: 14.5, color: "#B91C1C",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {paid.map((plan) => {
              const featured = !!plan.recommended;
              return (
                <div
                  key={plan.id}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 14, flexWrap: "wrap",
                    borderRadius: 16, padding: "14px 16px",
                    border: featured ? "2px solid #4B5FE8" : "1px solid rgba(0,0,0,0.11)",
                    background: featured ? "rgba(75,95,232,0.04)" : "#FFFFFF",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 16.5, fontWeight: 700, color: "#0f1115" }}>{tr(plan.name)}</span>
                      {plan.badge && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                          borderRadius: 999, padding: "2px 8px", color: "#FFFFFF",
                          background: featured ? "#4B5FE8" : "#0f1115",
                        }}>
                          {tr(plan.badge)}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: "#0f1115", fontVariantNumeric: "tabular-nums" }}>{plan.price}</span>
                      <span style={{ fontSize: 14, color: "rgba(15,17,21,0.62)" }}>{plan.period}</span>
                      {plan.perMonth && (
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: "#4B5FE8" }}>{tr(plan.perMonth)}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => upgrade(plan.id as PaidPlanId)}
                    disabled={!!loading}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      fontSize: 14.5, fontWeight: 700, padding: "10px 18px",
                      borderRadius: 999, cursor: loading ? "default" : "pointer",
                      opacity: loading && loading !== plan.id ? 0.5 : 1,
                      border: featured ? "none" : "1px solid rgba(0,0,0,0.15)",
                      background: featured ? "#4B5FE8" : "#FFFFFF",
                      color: featured ? "#FFFFFF" : "#0f1115",
                      flexShrink: 0,
                    }}
                  >
                    <Zap size={13} />
                    {loading === plan.id ? tr("Loading…") : tr("Upgrade")}
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(15,17,21,0.5)", marginBottom: 10 }}>
              {tr("Every plan includes")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "6px 16px" }}>
              {PLAN_FEATURES.slice(0, 6).map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, color: "rgba(15,17,21,0.78)" }}>
                  <Check size={13} style={{ color: "#4B5FE8", flexShrink: 0 }} />
                  {tr(f)}
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontSize: 13, color: "rgba(15,17,21,0.55)", textAlign: "center", margin: "16px 0 0" }}>
            {tr("Billed today. Cancel anytime.")}
          </p>
        </div>
      </div>
    </div>
  );
}
