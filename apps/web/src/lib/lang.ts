import { cookies } from "next/headers";
import { TRANSLATED_UI } from "@sano/i18n/ui";

/** The cookie the language switcher writes, readable during server rendering. */
export const LANG_COOKIE = "lang";

/**
 * The visitor's language, on the server.
 *
 * The public pages are server-rendered for SEO, so the language has to be known
 * before any HTML is produced — a cookie can be read there, localStorage cannot.
 * The switcher writes both, so the dashboard (which reads localStorage) agrees.
 */
export async function getLang(): Promise<string> {
  const value = (await cookies()).get(LANG_COOKIE)?.value ?? "en";
  return TRANSLATED_UI.includes(value) || value === "en" ? value : "en";
}
