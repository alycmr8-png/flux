"use client";
import { initI18n } from "@sano/i18n";

let initialized = false;

export function getI18n() {
  if (!initialized) {
    const saved = typeof window !== "undefined" ? localStorage.getItem("lang") ?? "en" : "en";
    initI18n(saved);
    initialized = false; // allow re-init with saved lang
  }
  return initI18n(
    typeof window !== "undefined" ? localStorage.getItem("lang") ?? "en" : "en"
  );
}
