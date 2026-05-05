import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import fr from "./locales/fr";
import ar from "./locales/ar";
import es from "./locales/es";
import pt from "./locales/pt";

export const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
];

export const resources = { en: { translation: en }, fr: { translation: fr }, ar: { translation: ar }, es: { translation: es }, pt: { translation: pt } };

export function initI18n(lng = "en") {
  if (i18n.isInitialized) return i18n;
  i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
  return i18n;
}

export { i18n };
export type Language = "en" | "fr" | "ar" | "es" | "pt";
