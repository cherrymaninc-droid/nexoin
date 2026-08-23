import { createContext, useContext, useState, useCallback } from "react";
import { translations } from "@/i18n/translations";

const LanguageContext = createContext(null);

const STORAGE_KEY = "nexoin-lang";

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return stored && translations[stored] ? stored : "fr";
  });

  const setLang = useCallback((next) => {
    if (!translations[next]) return;
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  const t = translations[lang];

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, langs: Object.keys(translations) }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
