"use client";
import { useState } from "react";
import { CheckCircle, Loader2, Mail } from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Email capture for people who watched the demos but aren't ready to sign up.
// One field, one promise, zero friction.

export function WaitlistForm({ source = "landing" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function join() {
    const v = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { setState("error"); return; }
    setState("sending");
    try {
      const r = await fetch(`${BASE}/public/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: v, source }),
      });
      if (!r.ok) throw new Error();
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-full px-6 py-3.5" style={{ background: "rgba(22,163,74,0.09)", border: "1px solid rgba(22,163,74,0.35)" }}>
        <CheckCircle size={16} style={{ color: "#16A34A" }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "#166534" }}>
          You're on the list — first invites go out soon.
        </span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center gap-2 rounded-full p-1.5 pl-4" style={{ background: "#FFFFFF", border: "1.5px solid rgba(0,0,0,0.12)", boxShadow: "0 6px 24px rgba(0,0,0,0.06)" }}>
        <Mail size={15} style={{ color: "rgba(31,35,40,0.4)", flexShrink: 0 }} />
        <input
          type="email"
          value={email}
          onChange={e => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
          onKeyDown={e => e.key === "Enter" && join()}
          placeholder="you@school.edu"
          className="flex-1 min-w-0 outline-none text-sm"
          style={{ color: "#191918", background: "transparent" }}
        />
        <button
          onClick={join}
          disabled={state === "sending"}
          className="shrink-0 flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #4B5FE8 0%, #6E7FF3 100%)" }}
        >
          {state === "sending" ? <Loader2 size={13} className="animate-spin" /> : null}
          Get early access
        </button>
      </div>
      <p className="text-center mt-2" style={{ fontSize: 11, color: state === "error" ? "#DC2626" : "rgba(31,35,40,0.45)" }}>
        {state === "error" ? "That email doesn't look right — try again." : "No spam. Just your invite when it's ready."}
      </p>
    </div>
  );
}
