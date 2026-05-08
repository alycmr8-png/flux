"use client";
import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function useApiFetch() {
  const { userId } = useAuth();

  return useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          "x-clerk-user-id": userId ?? "",
        },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`API ${res.status}: ${body}`);
      }
      return res.json();
    },
    [userId]
  );
}

export function useApiSWRFetcher() {
  const { userId } = useAuth();
  return useCallback(
    async (url: string) => {
      const r = await fetch(url, { headers: { "x-clerk-user-id": userId ?? "" } });
      if (!r.ok) throw new Error(`API ${r.status}`);
      return r.json();
    },
    [userId]
  );
}
