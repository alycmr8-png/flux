"use client";
import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import { makeTranslator, type Translate } from "@sano/i18n/ui";

/**
 * The language a server component already resolved from the cookie. Client
 * components below it render in that language on the very first paint, so the
 * server HTML and the hydrated markup agree.
 */
const LangContext = createContext<string | null>(null);

export function LangProvider({ lang, children }: { lang: string; children: ReactNode }) {
  return createElement(LangContext.Provider, { value: lang }, children);
}

/**
 * Interface text in the student's language, looked up by the English wording.
 * The language switcher reloads the page, so reading it once is enough.
 */
export function useTr(): Translate {
  const fromServer = useContext(LangContext);
  return useMemo(() => {
    if (fromServer) return makeTranslator(fromServer);
    const lang = typeof window === "undefined" ? "en" : localStorage.getItem("lang") ?? "en";
    return makeTranslator(lang);
  }, [fromServer]);
}
