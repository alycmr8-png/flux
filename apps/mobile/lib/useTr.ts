import { useEffect, useState } from "react";
import { makeTranslator, type Translate } from "@sano/i18n/ui";
import { i18n } from "./i18n";

/** Interface text in the student's language, looked up by the English wording. */
export function useTr(): Translate {
  const [tr, setTr] = useState<Translate>(() => makeTranslator(i18n.language ?? "en"));
  useEffect(() => {
    const onChange = (lang: string) => setTr(() => makeTranslator(lang));
    i18n.on("languageChanged", onChange);
    return () => { i18n.off("languageChanged", onChange); };
  }, []);
  return tr;
}
