"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useUser, useClerk, useAuth } from "@clerk/nextjs";
import { CreditCard, HelpCircle, LogOut, ChevronRight, ExternalLink, Pencil, Check, X } from "lucide-react";
import { useApiSWRFetcher, useApiFetch } from "@/lib/apiFetch";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const BRAND = "#4B5FE8";
const INK = "#0f1115";
const HAIRLINE = "rgba(0,0,0,0.08)";

// Illustrated people rather than emoji. Each seed deterministically produces the
// same character, so a stored seed always renders the avatar the student chose.
// Kept byte-identical to apps/mobile/app/(tabs)/account.tsx so a seed picked on
// one platform renders the same person on the other.
const AVATARS = [
  "Maya", "Kai", "Leo", "Zara", "Noah", "Amara", "Diego", "Yuki",
  "Omar", "Sofia", "Ines", "Malik", "Aria", "Ravi", "Nina", "Tariq",
  "Chloe", "Ade", "Hana", "Felix",
];
// Eyes/mouth are constrained so every seed reads as a friendly face — the
// unconstrained generator returns dizzy and x-eyed expressions at random.
const AVATAR_FEATURES = "eyes=default,happy,wink&mouth=smile,twinkle&eyebrows=default,defaultNatural,raisedExcitedNatural";
const avatarUrl = (seed: string, size = 160) =>
  `https://api.dicebear.com/9.x/avataaars/png?seed=${encodeURIComponent(seed)}&size=${size}&${AVATAR_FEATURES}`;
const AVATAR_COLORS = ["#4B5FE8", "#9333EA", "#DC2626", "#EA580C", "#16A34A", "#0891B2", "#D97706", "#DB2777"];

export default function AccountPage() {
  const { user } = useUser();
  const { userId, isLoaded } = useAuth();
  const { signOut } = useClerk();
  const fetcher = useApiSWRFetcher();
  const apiFetch = useApiFetch();
  const ready = isLoaded && !!userId;

  const { data: settings, mutate } = useSWR(ready ? `${BASE}/api/settings` : null, fetcher, {
    revalidateOnFocus: false,
  });

  const [picking, setPicking] = useState(false);
  // Optimistic overrides so the preview updates before the PATCH lands.
  const [seed, setSeed] = useState<string | null>(null);
  const [tint, setTint] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const avatar: string | null = seed ?? settings?.data?.avatar ?? null;
  const avatarColor: string = tint ?? settings?.data?.avatarColor ?? BRAND;
  const initial = (user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "?").toUpperCase();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";

  async function saveAvatar(nextSeed: string, nextColor: string) {
    setSeed(nextSeed);
    setTint(nextColor);
    setErr("");
    try {
      await apiFetch(`/api/settings/avatar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: nextSeed, avatarColor: nextColor }),
      });
      await mutate();
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't save — try again.");
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: BRAND, marginBottom: 8 }}>
        Account
      </div>
      <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: "-0.5px", color: INK, marginBottom: 26 }}>
        Settings
      </h1>

      {/* Profile */}
      <div
        className="flex items-center gap-4 rounded-[20px] p-5 mb-5"
        style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}` }}
      >
        <button
          onClick={() => setPicking(true)}
          className="relative shrink-0 rounded-full flex items-center justify-center transition-transform hover:scale-[1.04]"
          style={{ width: 64, height: 64, background: avatarColor }}
          title="Change avatar"
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl(avatar, 160)} alt="" width={64} height={64} style={{ width: 64, height: 64, borderRadius: "9999px" }} />
          ) : (
            <span style={{ color: "#fff", fontSize: 27, fontWeight: 800 }}>{initial}</span>
          )}
          <span
            className="absolute flex items-center justify-center rounded-full"
            style={{ bottom: -2, right: -2, width: 24, height: 24, background: "rgba(15,17,21,0.72)", border: "2px solid #fff" }}
          >
            <Pencil size={11} style={{ color: "#fff" }} />
          </span>
        </button>
        <div className="min-w-0">
          <div style={{ fontSize: 19, fontWeight: 700, color: INK }}>{user?.fullName ?? "Student"}</div>
          <div className="truncate" style={{ fontSize: 14.5, color: "rgba(15,17,21,0.65)", marginTop: 3 }}>{email}</div>
        </div>
      </div>

      {err && <p className="text-sm mb-3" style={{ color: "#DC2626" }}>{err}</p>}

      {/* Rows */}
      <Link
        href="/dashboard/billing"
        className="flex items-center gap-3 rounded-2xl px-5 py-4 mb-2.5 transition-colors hover:bg-[rgba(75,95,232,0.05)]"
        style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}` }}
      >
        <CreditCard size={20} style={{ color: "rgba(15,17,21,0.55)" }} />
        <span className="flex-1" style={{ fontSize: 15.5, fontWeight: 600, color: INK }}>Billing &amp; plan</span>
        <ExternalLink size={17} style={{ color: "rgba(15,17,21,0.55)" }} />
      </Link>

      <Link
        href="/dashboard/help"
        className="flex items-center gap-3 rounded-2xl px-5 py-4 mb-2.5 transition-colors hover:bg-[rgba(75,95,232,0.05)]"
        style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}` }}
      >
        <HelpCircle size={20} style={{ color: "rgba(15,17,21,0.55)" }} />
        <span className="flex-1" style={{ fontSize: 15.5, fontWeight: 600, color: INK }}>Help &amp; support</span>
        <ChevronRight size={17} style={{ color: "rgba(15,17,21,0.55)" }} />
      </Link>

      {/* Sign out */}
      <div className="mt-5">
        {confirmSignOut ? (
          <div
            className="flex flex-wrap items-center gap-3 rounded-2xl px-5 py-4"
            style={{ background: "#FFFFFF", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            <span className="flex-1" style={{ fontSize: 15, color: "rgba(15,17,21,0.75)" }}>
              Sign out? You can sign back in anytime.
            </span>
            <button
              onClick={() => setConfirmSignOut(false)}
              className="rounded-xl px-4 py-2"
              style={{ fontSize: 14, fontWeight: 600, background: "rgba(0,0,0,0.05)", color: "rgba(15,17,21,0.75)" }}
            >
              Cancel
            </button>
            <button
              onClick={() => signOut()}
              className="rounded-xl px-4 py-2"
              style={{ fontSize: 14, fontWeight: 700, background: "#DC2626", color: "#fff" }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmSignOut(true)}
            className="w-full flex items-center gap-3 rounded-2xl px-5 py-4 transition-colors hover:bg-[rgba(239,68,68,0.04)]"
            style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}` }}
          >
            <LogOut size={20} style={{ color: "#EF4444" }} />
            <span className="flex-1 text-left" style={{ fontSize: 15.5, fontWeight: 600, color: "#DC2626" }}>Sign out</span>
          </button>
        )}
      </div>

      {/* Avatar picker */}
      {picking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,17,21,0.35)" }}>
          {/* Backdrop click-away */}
          <button
            aria-label="Close"
            onClick={() => setPicking(false)}
            className="absolute inset-0 cursor-default"
            style={{ background: "transparent" }}
          />
          <div
            className="relative w-full overflow-y-auto rounded-[24px] p-6"
            style={{ maxWidth: 480, maxHeight: "86vh", background: "#FFFFFF", border: `1px solid ${HAIRLINE}`, boxShadow: "0 24px 64px rgba(15,17,21,0.18)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 style={{ fontSize: 21, fontWeight: 700, color: INK }}>Pick your avatar</h2>
              <button onClick={() => setPicking(false)} className="p-1.5 rounded-full" style={{ color: "rgba(15,17,21,0.55)" }}>
                <X size={19} />
              </button>
            </div>

            {/* Live preview */}
            <div
              className="mx-auto mb-6 rounded-full flex items-center justify-center"
              style={{ width: 96, height: 96, background: avatarColor }}
            >
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl(avatar, 220)} alt="" width={96} height={96} style={{ width: 96, height: 96, borderRadius: "9999px" }} />
              ) : (
                <span style={{ color: "#fff", fontSize: 42, fontWeight: 800 }}>{initial}</span>
              )}
            </div>

            <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(15,17,21,0.6)", marginBottom: 10 }}>
              Avatar
            </div>
            <div className="flex flex-wrap gap-2.5 mb-6">
              {AVATARS.map(a => (
                <button
                  key={a}
                  onClick={() => saveAvatar(a, avatarColor)}
                  className="rounded-full flex items-center justify-center overflow-hidden transition-transform hover:scale-105"
                  style={{
                    width: 60,
                    height: 60,
                    background: "rgba(0,0,0,0.04)",
                    border: avatar === a ? `3px solid ${avatarColor}` : "3px solid transparent",
                  }}
                  title={a}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarUrl(a, 120)} alt={a} width={54} height={54} style={{ width: 54, height: 54, borderRadius: "9999px" }} />
                </button>
              ))}
            </div>

            <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(15,17,21,0.6)", marginBottom: 10 }}>
              Background
            </div>
            <div className="flex flex-wrap gap-2.5 mb-6">
              {AVATAR_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => saveAvatar(avatar ?? AVATARS[0], c)}
                  className="rounded-full flex items-center justify-center transition-transform hover:scale-105"
                  style={{
                    width: 42,
                    height: 42,
                    background: c,
                    border: avatarColor === c ? "3px solid rgba(15,17,21,0.22)" : "3px solid transparent",
                  }}
                  title={c}
                >
                  {avatarColor === c && <Check size={16} style={{ color: "#fff" }} />}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPicking(false)}
              className="w-full rounded-2xl py-3.5"
              style={{ background: avatarColor, color: "#fff", fontSize: 16, fontWeight: 700 }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
