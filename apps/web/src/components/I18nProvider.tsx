"use client";
import { useEffect, useState, useRef } from "react";
import { initI18n, LANGUAGES, type Language } from "@/lib/i18nConfig";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem("lang") ?? "en";
    initI18n(saved);
  }, []);
  return <>{children}</>;
}

export function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = typeof window !== "undefined" ? localStorage.getItem("lang") ?? "en" : "en";

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  async function change(lang: Language) {
    setOpen(false);
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-colors"
        style={{ color: "rgba(255,255,255,0.45)", borderColor: "rgba(255,255,255,0.1)", background: open ? "rgba(255,255,255,0.07)" : "transparent" }}
      >
        <span>{LANGUAGES.find(l => l.code === current)?.flag}</span>
        <span>{LANGUAGES.find(l => l.code === current)?.label}</span>
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 rounded-xl overflow-hidden z-50 w-40"
          style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => change(lang.code as Language)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-white/10"
              style={{ color: lang.code === current ? "white" : "rgba(255,255,255,0.5)" }}
            >
              <span className="text-base">{lang.flag}</span>
              <span>{lang.label}</span>
              {lang.code === current && <span className="ml-auto text-[#3b82f6]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
