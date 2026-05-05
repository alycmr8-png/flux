"use client";
import { useEffect } from "react";
import { initI18n, LANGUAGES, type Language } from "@sano/i18n";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem("lang") ?? "en";
    initI18n(saved);
  }, []);
  return <>{children}</>;
}

export function LanguageSwitcher() {
  async function change(lang: Language) {
    localStorage.setItem("lang", lang);
    try {
      await fetch("/api/settings/language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang }),
      });
    } catch {}
    window.location.reload();
  }

  const current = typeof window !== "undefined" ? localStorage.getItem("lang") ?? "en" : "en";

  return (
    <div className="relative group">
      <button className="flex items-center gap-1.5 text-xs text-[#555] hover:text-white transition-colors px-3 py-2 rounded-xl border border-[#1a1a1a] hover:border-[#333]">
        <span>{LANGUAGES.find((l) => l.code === current)?.flag}</span>
        <span>{LANGUAGES.find((l) => l.code === current)?.label}</span>
      </button>
      <div className="absolute bottom-full mb-2 left-0 bg-[#111] border border-[#222] rounded-xl overflow-hidden hidden group-hover:block w-36 z-50">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => change(lang.code as Language)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[#1a1a1a] transition-colors ${
              lang.code === current ? "text-white" : "text-[#555]"
            }`}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
