"use client";
import { useSignIn } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { X } from "lucide-react";

export function GoogleBanner() {
  const { signIn, isLoaded } = useSignIn();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, []);

  async function handleGoogle() {
    if (!isLoaded) return;
    await signIn.authenticateWithRedirect({
      strategy: "oauth_google",
      redirectUrl: `${window.location.origin}/sso-callback`,
      redirectUrlComplete: "/dashboard",
    });
  }

  return (
    <div
      className={`fixed top-6 right-6 z-50 transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      }`}
    >
      <div className="bg-[#111] border border-[#222] rounded-2xl px-5 py-4 flex items-center gap-4 shadow-2xl w-80">
        {/* Google G */}
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-medium mb-0.5">Continue with Google</div>
          <div className="text-[#555] text-xs leading-snug">Sign in instantly — no password needed</div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            onClick={() => setVisible(false)}
            className="text-[#444] hover:text-white transition-colors"
          >
            <X size={13} />
          </button>
          <button
            onClick={handleGoogle}
            className="bg-white text-black text-xs font-medium rounded-full px-4 py-1.5 hover:bg-[#eee] transition-colors whitespace-nowrap"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
