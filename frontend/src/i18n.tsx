import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import en from "./locales/en.json";
import hi from "./locales/hi.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import zh from "./locales/zh.json";

export const languages = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
  zh: "中文",
  hi: "हिन्दी",
} as const;

export type Language = keyof typeof languages;
export type TranslationKey = keyof typeof en;

const languageOrder: Language[] = ["en", "ko", "ja", "zh", "hi"];

const translations: Record<Language, Record<TranslationKey, string>> = {
  en,
  ko,
  ja,
  zh,
  hi,
};

type I18nValue = {
  language: Language;
  languageLabel: string;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function normalizeLanguage(value: string | null): Language | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.startsWith("ko")) return "ko";
  if (normalized.startsWith("ja")) return "ja";
  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("hi")) return "hi";
  if (normalized.startsWith("en")) return "en";
  return null;
}

function getInitialLanguage(): Language {
  const saved = normalizeLanguage(localStorage.getItem("channel-vault-language"));
  if (saved) return saved;
  return normalizeLanguage(navigator.language) ?? "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    localStorage.setItem("channel-vault-language", language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nValue>(() => {
    const setLanguage = (nextLanguage: Language) => setLanguageState(nextLanguage);
    const toggleLanguage = () =>
      setLanguageState((current) => {
        const index = languageOrder.indexOf(current);
        return languageOrder[(index + 1) % languageOrder.length];
      });
    const t = (key: TranslationKey) => translations[language][key] ?? translations.en[key] ?? key;
    return {
      language,
      languageLabel: languages[language],
      setLanguage,
      toggleLanguage,
      t,
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}
