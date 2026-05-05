export const dynamic = "force-dynamic";

import Link from "next/link";
import { Check } from "lucide-react";
import { auth } from "@clerk/nextjs/server";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Try it out, no card needed.",
    highlight: false,
    features: [
      "3 recordings per month",
      "AI cheat sheets",
      "AI quizzes",
      "1 course",
      "Mobile & web access",
    ],
    cta: "Get started free",
    ctaHref: "/sign-up",
  },
  {
    id: "student",
    name: "Student",
    price: "$8",
    period: "per month",
    annual: "$60/yr",
    description: "Everything you need to ace the semester.",
    highlight: true,
    features: [
      "Unlimited recordings",
      "AI cheat sheets & quizzes",
      "Google Drive sync",
      "Unlimited courses",
      "Action items extraction",
      "5 languages supported",
    ],
    cta: "Upgrade to Student",
    plan: "student",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$15",
    period: "per month",
    description: "For serious students who want every edge.",
    highlight: false,
    features: [
      "Everything in Student",
      "Priority AI processing",
      "Study calendar & scheduling",
      "Retention analytics",
      "Document & slide uploads",
      "Early access to new features",
    ],
    cta: "Upgrade to Pro",
    plan: "pro",
  },
];

export default async function PricingPage() {
  const { userId } = await auth();
  const dashboardHref = userId ? "/dashboard/billing" : "/sign-up";

  return (
    <main className="min-h-screen bg-black flex flex-col">
      {/* Nav */}
      <div className="flex items-center justify-between px-8 py-6">
        <Link href="/" className="font-serif italic text-xl text-white">Flux</Link>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-sm text-[#555] hover:text-white transition-colors">Sign in</Link>
          <Link href="/sign-up" className="text-sm bg-white text-black font-medium px-5 py-2 rounded-full hover:bg-[#e0e0e0] transition-colors">Get started</Link>
        </div>
      </div>

      {/* Header */}
      <div className="text-center pt-16 pb-12 px-8">
        <div className="text-[10px] text-[#444] uppercase tracking-[0.2em] mb-4 font-medium">Pricing</div>
        <h1 className="font-serif italic text-5xl text-white mb-4">Simple pricing.</h1>
        <p className="text-[#555] text-base">Start free. Upgrade when you need more.</p>
      </div>

      {/* Cards */}
      <div className="flex items-start justify-center gap-4 px-8 pb-24 flex-wrap">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`w-72 rounded-2xl p-6 flex flex-col border ${
              plan.highlight
                ? "border-white bg-[#111]"
                : "border-[#1e1e1e] bg-[#0a0a0a]"
            }`}
          >
            {plan.highlight && (
              <div className="text-[9px] font-bold uppercase tracking-widest text-black bg-white rounded-full px-2.5 py-1 self-start mb-4">
                Most popular
              </div>
            )}

            <div className="mb-5">
              <div className="text-[11px] text-[#555] uppercase tracking-widest mb-2">{plan.name}</div>
              <div className="flex items-end gap-1.5">
                <span className="text-4xl font-light text-white">{plan.price}</span>
                <span className="text-[#444] text-sm mb-1">{plan.period}</span>
              </div>
              {"annual" in plan && (
                <div className="text-[11px] text-[#444] mt-1">{plan.annual} billed annually</div>
              )}
              <div className="text-xs text-[#444] mt-3 leading-relaxed">{plan.description}</div>
            </div>

            <div className="space-y-2.5 flex-1 mb-6">
              {plan.features.map((f) => (
                <div key={f} className="flex items-start gap-2.5">
                  <Check size={12} className="text-white shrink-0 mt-0.5" />
                  <span className="text-xs text-[#888]">{f}</span>
                </div>
              ))}
            </div>

            {"plan" in plan ? (
              <Link
                href={dashboardHref}
                className={`text-center text-sm font-medium py-2.5 rounded-full transition-colors ${
                  plan.highlight
                    ? "bg-white text-black hover:bg-[#e0e0e0]"
                    : "border border-[#333] text-white hover:border-[#555]"
                }`}
              >
                {plan.cta}
              </Link>
            ) : (
              <Link
                href={plan.ctaHref!}
                className="text-center text-sm font-medium py-2.5 rounded-full border border-[#222] text-[#555] hover:text-white hover:border-[#444] transition-colors"
              >
                {plan.cta}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="text-center pb-16 text-xs text-[#333]">
        All plans include a 7-day free trial. No hidden fees. Cancel anytime.
      </div>
    </main>
  );
}

