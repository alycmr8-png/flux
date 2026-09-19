"use client";
import { useEffect, useRef, useState } from "react";
import { Globe, Check } from "lucide-react";
import { LANGUAGES, type Language } from "@/lib/i18nConfig";
import { useTr } from "@/lib/useTr";

/**
 * The language switch for visitors — before there is an account to save it to.
 *
 * The choice goes into a cookie because the public pages are server-rendered in
 * the visitor's language, and into localStorage so the dashboard agrees; the
 * reload is what makes the server re-render everything translated.
 */
export function LanguageMenu({ dark = false }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("en");
  const ref = useRef<HTMLDivElement>(null);
  const tr = useTr();

  useEffect(() => {
    const cookie = document.cookie.match(/(?:^|;\s*)lang=([^;]+)/)?.[1];
    setCurrent(cookie ?? localStorage.getItem("lang") ?? "en");
  }, []);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function change(lang: Language) {
    localStorage.setItem("lang", lang);
    document.cookie = `lang=${lang}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }

  const fg = dark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";
  const active = LANGUAGES.find(l => l.code === current);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={tr("Language")}
        className="flex items-center gap-1.5 transition-colors"
        style={{ fontSize: 16, fontWeight: 500, color: fg, padding: "8px 10px", borderRadius: 999 }}
      >
        <Globe size={17} />
        <span className="hidden md:inline">{active?.flag} {active?.label}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 rounded-2xl overflow-hidden z-50 w-48"
          style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", boxShadow: "0 12px 32px rgba(0,0,0,0.14)" }}
        >
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => change(lang.code as Language)}
              className="w-full flex items-center gap-2.5 px-3.5 py-3 transition-colors hover:bg-black/5"
              style={{ fontSize: 15, color: "#0f1115", fontWeight: lang.code === current ? 700 : 500 }}
            >
              <span className="text-base">{lang.flag}</span>
              <span>{lang.label}</span>
              {lang.code === current && <Check size={16} className="ml-auto" style={{ color: "#4B5FE8" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
