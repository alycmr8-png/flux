"use client";
import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function useApiFetch() {
  const { getToken } = useAuth();

  return useCallback(
    async (path: string, init?: RequestInit) => {
      const token = await getToken();
      const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        // Monthly quota hit — surface a human message instead of raw JSON,
        // since many call sites display e.message directly in a toast.
        if (res.status === 429 && body.includes("quota_exceeded")) {
          const fr = typeof window !== "undefined" && localStorage.getItem("lang") === "fr";
          const err = new Error(
            fr
              ? "Limite mensuelle du plan gratuit atteinte. Passe à un plan payant dans Facturation pour continuer."
              : "You've hit this month's free plan limit. Upgrade in Billing to keep going."
          );
          err.name = "QuotaError";
          throw err;
        }
        throw new Error(`API ${res.status}: ${body}`);
      }
      return res.json();
    },
    [getToken]
  );
}

export function useApiSWRFetcher() {
  const { getToken } = useAuth();
  return useCallback(
    async (url: string) => {
      const token = await getToken();
      const r = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error(`API ${r.status}`);
      return r.json();
    },
    [getToken]
  );
}
