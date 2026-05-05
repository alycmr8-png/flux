"use client";
import Link from "next/link";
import { Check } from "lucide-react";
import { useState } from "react";

const FEATURES = [
  "Unlimited lecture recordings",
  "AI-generated cheat sheets",
  "Auto-generated quizzes & flashcards",
  "Full study books from lectures",
  "YouTube video to study material",
  "AI tutor chatbot",
  "Calendar & deadline tracking",
  "Upload documents & slides",
  "Multi-language support (5 languages)",
  "Notes per class",
];

const PLANS = [
  {
    key: "monthly",
    label: "Monthly",
    price: 9.99,
    billing: "Billed monthly",
    badge: null,
    priceId: "price_monthly", // replace with real Stripe price ID
  },
  {
    key: "6month",
    label: "6-Month",
    price: 6.99,
    billing: "$41.94 billed every 6 months",
    badge: "Save 30%",
    recommended: true,
    priceId: "price_6month",
  },
  {
    key: "yearly",
    label: "Yearly",
    price: 5.99,
    billing: "$71.88 billed yearly",
    badge: "Save 40%",
    priceId: "price_yearly",
  },
];

export function PricingSection() {
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  return (
    <section id="pricing" className="py-28 px-6" style={{ background: "#111110" }}>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-14">
          <div className="text-[10px] uppercase tracking-[0.2em] mb-4 font-semibold" style={{ color: "rgba(255,255,255,0.3)" }}>
            Pricing
          </div>
          <h2 className="text-4xl md:text-5xl mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontWeight: 400, color: "white", lineHeight: 1.15 }}>
            Choose your plan to Get started.
          </h2>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15 }}>
            Start free. Upgrade when you're ready.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(plan => {
            const isHovered = hoveredPlan === plan.key;
            const isRecommended = plan.recommended;

            return (
              <div
                key={plan.key}
                onMouseEnter={() => setHoveredPlan(plan.key)}
                onMouseLeave={() => setHoveredPlan(null)}
                className="relative flex flex-col rounded-2xl p-7 transition-all duration-200"
                style={{
                  background: isRecommended
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(255,255,255,0.04)",
                  border: isRecommended
                    ? "1px solid rgba(255,255,255,0.25)"
                    : "1px solid rgba(255,255,255,0.08)",
                  transform: isHovered ? "translateY(-4px)" : "translateY(0)",
                }}
              >
                {/* Badge */}
                {plan.badge && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold"
                    style={{ background: isRecommended ? "white" : "rgba(255,255,255,0.15)", color: isRecommended ? "#111110" : "white", whiteSpace: "nowrap" }}
                  >
                    {isRecommended && <span className="mr-1">Recommended · </span>}{plan.badge}
                  </div>
                )}

                {/* Plan name */}
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 16 }}>
                  {plan.label}
                </div>

                {/* Price */}
                <div className="flex items-end gap-1 mb-1">
                  <span style={{ fontSize: 42, fontWeight: 700, color: "white", lineHeight: 1 }}>
                    ${plan.price.toFixed(2)}
                  </span>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>/month</span>
                </div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 28 }}>
                  {plan.billing}
                </p>

                {/* Divider */}
                <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 24 }} />

                {/* Features */}
                <ul className="flex flex-col gap-3 flex-1 mb-8">
                  {FEATURES.map(f => (
                    <li key={f} className="flex items-center gap-3">
                      <Check size={13} style={{ color: isRecommended ? "white" : "rgba(255,255,255,0.5)", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href="/sign-up"
                  className="w-full py-3 rounded-xl font-medium text-sm transition-all text-center block"
                  style={{
                    background: isRecommended ? "white" : "rgba(255,255,255,0.1)",
                    color: isRecommended ? "#111110" : "white",
                    border: isRecommended ? "none" : "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  Get Started
                </Link>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="text-center mt-10" style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
          No credit card required to start · Cancel anytime
        </p>
      </div>
    </section>
  );
}
