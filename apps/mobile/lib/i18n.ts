import { initI18n, i18n } from "@sano/i18n";
import * as SecureStore from "expo-secure-store";

const LANG_KEY = "sano_lang";

export async function loadI18n() {
  const saved = await SecureStore.getItemAsync(LANG_KEY).catch(() => null);
  initI18n(saved ?? "en");
}

export async function setLanguage(lang: string, apiBase?: string) {
  await SecureStore.setItemAsync(LANG_KEY, lang).catch(() => {});
  i18n.changeLanguage(lang);
  if (apiBase) {
    try {
      await fetch(`${apiBase}/api/settings/language`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang }),
      });
    } catch {}
  }
}

export { i18n };
