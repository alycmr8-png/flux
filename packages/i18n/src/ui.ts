// Interface strings, looked up by their English text so screens stay readable:
//   tr("Start recording")  →  "Démarrer l'enregistrement"
// A string with no translation falls back to the English, so nothing can break.
// {name} placeholders are filled from the second argument.
import { fr } from "./ui/fr";

const DICTIONARIES: Record<string, Record<string, string>> = { fr };

export type Translate = (english: string, vars?: Record<string, string | number>) => string;

export function makeTranslator(language: string): Translate {
  const dictionary = DICTIONARIES[language] ?? {};
  return (english, vars) => {
    let out = dictionary[english] ?? english;
    if (vars) {
      for (const [key, value] of Object.entries(vars)) out = out.split(`{${key}}`).join(String(value));
    }
    return out;
  };
}

/** Languages the interface is translated into (others fall back to English). */
export const TRANSLATED_UI = Object.keys(DICTIONARIES);
