import i18n from "i18next";

export const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
] as const;

export type Language = (typeof LANGUAGES)[number]["code"];

export function initI18n(lng = "en") {
  if (i18n.isInitialized) return i18n;
  i18n.init({
    lng,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    resources: {},
  });
  return i18n;
}
