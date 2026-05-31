"use client";
import { useState } from "react";
import { translations, type Lang, type TranslationTree } from "./translations";

export function useT(): TranslationTree {
  const [lang] = useState<Lang>(() => {
    if (typeof window === "undefined") return "en";
    const stored = localStorage.getItem("lang") as Lang | null;
    return stored && stored in translations ? stored : "en";
  });
  return (translations[lang] ?? translations.en) as TranslationTree;
}
