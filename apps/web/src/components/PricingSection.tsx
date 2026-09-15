"use client";
import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS, PLAN_FEATURES } from "@/lib/plans";

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 md:py-28 px-6" style={{ background: "#ffffff" }}>
      <div className="max-w-6xl mx-auto">

        <div className="text-center mb-14">
          <div className="uppercase mb-4 font-bold" style={{ fontSize: 13, letterSpacing: "0.2em", color: "#6E7FF3" }}>
            Pricing
          </div>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: "clamp(32px, 5vw, 50px)", color: "#0f1115", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Your entire semester, remembered.
          </h2>
          <p className="mt-4" style={{ color: "rgba(15,17,21,0.7)", fontSize: 18 }}>
            Start free. Every paid plan includes everything — they only differ on how you pay.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {PLANS.map((plan) => {
            const featured = plan.recommended;
            return (
              <div
                key={plan.id}
                className="relative flex flex-col rounded-2xl p-6 transition-transform duration-200 hover:-translate-y-1"
                style={{
                  background: featured ? "rgba(75,95,232,0.06)" : "#FFFFFF",
                  border: featured ? "2px solid #4B5FE8" : "1px solid rgba(0,0,0,0.1)",
                  boxShadow: featured ? "0 14px 40px rgba(75,95,232,0.18)" : "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                {(plan.badge || featured) && (
                  <div
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full font-bold whitespace-nowrap"
                    style={{
                      fontSize: 13,
                      background: featured ? "#4B5FE8" : "#0f1115",
                      color: "#FFFFFF",
                    }}
                  >
                    {featured ? `Best value · ${plan.badge}` : plan.badge}
                  </div>
                )}

                <div className="uppercase font-bold mb-3" style={{ fontSize: 14, letterSpacing: "0.08em", color: featured ? "#4B5FE8" : "rgba(15,17,21,0.65)" }}>
                  {plan.name}
                </div>

                <div className="flex items-end gap-1">
                  <span style={{ fontSize: 42, fontWeight: 800, color: "#0f1115", lineHeight: 1, letterSpacing: "-0.02em" }}>
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="mb-1.5" style={{ fontSize: 16, color: "rgba(15,17,21,0.6)" }}>{plan.period}</span>
                  )}
                </div>
                <div className="mt-1.5" style={{ fontSize: 15, minHeight: 22, fontWeight: plan.perMonth ? 600 : 400, color: plan.perMonth ? "#4B5FE8" : "rgba(15,17,21,0.6)" }}>
                  {plan.perMonth ?? plan.billing}
                </div>
                {plan.perMonth && (
                  <div style={{ fontSize: 14, color: "rgba(15,17,21,0.55)" }}>{plan.billing}</div>
                )}

                <p className="mt-4 mb-5" style={{ fontSize: 16, fontWeight: 600, color: "#0f1115", lineHeight: 1.4 }}>
                  {plan.tagline}
                </p>

                <div className="mb-6" style={{ height: 1, background: "rgba(0,0,0,0.08)" }} />

                <ul className="flex flex-col gap-3 flex-1 mb-7">
                  {plan.limits.map((l) => (
                    <li key={l} className="flex items-start gap-2.5">
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: featured ? "#4B5FE8" : "rgba(15,17,21,0.5)" }} />
                      <span style={{ fontSize: 15.5, color: "rgba(15,17,21,0.8)" }}>{l}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/sign-up"
                  className="w-full py-3.5 rounded-xl font-semibold text-center block transition-opacity hover:opacity-90"
                  style={{
                    fontSize: 16,
                    background: featured ? "#4B5FE8" : plan.id === "free" ? "#FFFFFF" : "#0f1115",
                    color: plan.id === "free" ? "#0f1115" : "#FFFFFF",
                    border: plan.id === "free" ? "1px solid rgba(0,0,0,0.15)" : "none",
                  }}
                >
                  {plan.id === "free" ? "Start free" : "Start 7-day free trial"}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-16 rounded-2xl p-8 md:p-10" style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)" }}>
          <div className="text-center mb-7" style={{ fontSize: 22, fontWeight: 800, color: "#0f1115", letterSpacing: "-0.01em" }}>
            Every plan includes
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 max-w-4xl mx-auto">
            {PLAN_FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(75,95,232,0.12)" }}>
                  <Check size={14} style={{ color: "#4B5FE8" }} />
                </span>
                <span style={{ fontSize: 16.5, color: "rgba(15,17,21,0.85)" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center mt-8" style={{ fontSize: 15, color: "rgba(15,17,21,0.6)" }}>
          Paid plans start with a 7-day free trial · Cancel anytime
        </p>
      </div>
    </section>
  );
}
