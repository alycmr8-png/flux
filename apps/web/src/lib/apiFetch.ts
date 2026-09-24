"use client";
import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import { apiBase } from "@/lib/apiBase";

const BASE = apiBase();

/**
 * Turns a 429 into a sentence that names what ran out and what to do about it.
 *
 * The free plan is a single lecture, so "this month's limit" would be wrong as well
 * as vague — nothing resets in a month for a student who has used their one lecture.
 * This message is the upgrade prompt, so it has to say which wall was hit.
 */
function quotaMessage(body: string, fr: boolean): string {
  let kind = "";
  let plan = "";
  try {
    ({ kind, plan } = JSON.parse(body));
  } catch {
    // Fall through to the generic wording below.
  }

  if (plan === "free") {
    const free: Record<string, [string, string]> = {
      lecture: [
        "That was your free lecture. Upgrade to record the rest of your semester.",
        "C'était ton cours gratuit. Passe à un forfait payant pour enregistrer tout ton semestre.",
      ],
      minutes: [
        "Your free lecture has used up the free recording time. Upgrade to keep recording.",
        "Ton cours gratuit a épuisé le temps d'enregistrement gratuit. Passe à un forfait payant pour continuer.",
      ],
      ask: [
        "You've used your free questions. Upgrade to keep asking about your lectures.",
        "Tu as utilisé tes questions gratuites. Passe à un forfait payant pour continuer à poser des questions.",
      ],
      gen: [
        "You've used what the free lecture includes. Upgrade for notes, flashcards and quizzes on every class.",
        "Tu as utilisé tout ce qu'inclut le cours gratuit. Passe à un forfait payant pour les notes, cartes et quiz de chaque cours.",
      ],
    };
    const msg = free[kind];
    if (msg) return fr ? msg[1] : msg[0];
    return fr
      ? "Limite du plan gratuit atteinte. Passe à un forfait payant pour continuer."
      : "You've reached the free plan's limit. Upgrade to keep going.";
  }

  return fr
    ? "Limite mensuelle atteinte. Elle se réinitialise au début du mois prochain."
    : "You've hit this month's limit. It resets at the start of next month.";
}

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
          const err = new Error(quotaMessage(body, fr));
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
