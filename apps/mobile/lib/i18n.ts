import { initI18n, i18n } from "@sano/i18n";
import * as SecureStore from "expo-secure-store";

const LANG_KEY = "sano_lang";

export async function loadI18n() {
  const saved = await SecureStore.getItemAsync(LANG_KEY).catch(() => null);
  initI18n(saved ?? "en");
}

/**
 * Saves the language on the device and on the account, so lectures are
 * transcribed and every generated note is written in it. `save` performs the
 * signed-in API call (the caller has the session).
 */
export async function setLanguage(lang: string, save?: (language: string) => Promise<unknown>) {
  await SecureStore.setItemAsync(LANG_KEY, lang).catch(() => {});
  i18n.changeLanguage(lang);
  if (save) await save(lang).catch(() => {});
}

export async function currentLanguage(): Promise<string> {
  return (await SecureStore.getItemAsync(LANG_KEY).catch(() => null)) ?? "en";
}

export { i18n };
