"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * The frame around Clerk's sign-in and sign-up forms.
 *
 * <SignIn /> and <SignUp /> render nothing on the server — the form only exists once
 * Clerk's ~330 KB bundle has downloaded and mounted. The pages were a bare dark div,
 * so until that happened a student saw an empty black screen with no logo, no
 * spinner, and nothing to read. On a slow connection that is several seconds of
 * looking like a broken site; if the bundle is blocked outright — an ad blocker, a
 * privacy extension, a campus network — it never arrives and the page stays blank
 * forever, which is exactly what gets reported as "sign in doesn't work".
 *
 * So: the branding and a spinner are in the server HTML and visible immediately, and
 * if Clerk has not mounted after a few seconds the student is told what to try
 * instead of being left staring at nothing.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    // Clerk injects its own root; its presence means the form has actually rendered,
    // which a React effect alone cannot tell us.
    const check = () => {
      if (document.querySelector(".cl-rootBox, .cl-card")) {
        setMounted(true);
        return true;
      }
      return false;
    };
    if (check()) return;
    const poll = setInterval(() => { if (check()) clearInterval(poll); }, 200);
    // Long enough not to flash on a merely slow connection, short enough that nobody
    // sits in front of a blank screen wondering.
    const giveUp = setTimeout(() => setSlow(true), 6000);
    return () => { clearInterval(poll); clearTimeout(giveUp); };
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5"
      style={{ background: "#111110" }}
    >
      <Link
        href="/"
        className="flex items-center gap-2.5 mb-8"
        style={{ textDecoration: "none" }}
      >
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "#4B5FE8" }}
          aria-hidden
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
            <path d="m6.08 12-3.5 1.6a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83L18.92 12" />
          </svg>
        </span>
        <span style={{ fontSize: 21, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.4px" }}>
          <span style={{ color: "#8A9BFF" }}>U</span>corns
        </span>
      </Link>

      {children}

      {/* Shown only while Clerk's form is absent, and hidden the moment it appears. */}
      {!mounted && (
        <div className="flex flex-col items-center text-center" role="status" aria-live="polite">
          {!slow ? (
            <>
              <span className="auth-spinner" aria-hidden />
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14.5, marginTop: 14 }}>
                Loading sign-in…
              </p>
            </>
          ) : (
            <div
              className="rounded-2xl px-6 py-5 max-w-sm"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              <p style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                The sign-in form isn&apos;t loading
              </p>
              <p style={{ color: "rgba(255,255,255,0.62)", fontSize: 14.5, lineHeight: 1.5 }}>
                An ad blocker or a restricted network can block it. Try pausing your
                blocker, opening this page in a private window, or switching off campus
                Wi-Fi — then reload.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-full px-5 py-2 text-[14.5px] font-semibold"
                style={{ background: "#4B5FE8", color: "#FFFFFF", border: "none", cursor: "pointer" }}
              >
                Reload
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        .auth-spinner {
          width: 26px; height: 26px; border-radius: 999px;
          border: 2.5px solid rgba(255,255,255,0.16);
          border-top-color: #4B5FE8;
          animation: auth-spin 0.8s linear infinite;
          display: block;
        }
        @keyframes auth-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .auth-spinner { animation-duration: 2.4s; } }
      `}</style>
    </div>
  );
}
