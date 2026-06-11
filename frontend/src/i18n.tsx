import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import en from "./locales/en.json";

export const languages = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
  zh: "中文",
  hi: "हिन्दी",
} as const;

export type Language = keyof typeof languages;
export type TranslationKey = keyof typeof en;
type TranslationCatalog = Record<TranslationKey, string>;
type TranslationModule = { default: TranslationCatalog };

const languageOrder: Language[] = ["en", "ko", "ja", "zh", "hi"];

const fallbackTranslations = en as TranslationCatalog;

const translationLoaders: Record<Language, () => Promise<TranslationModule>> = {
  en: () => Promise.resolve({ default: fallbackTranslations }),
  ko: () => import("./locales/ko.json") as Promise<TranslationModule>,
  ja: () => import("./locales/ja.json") as Promise<TranslationModule>,
  zh: () => import("./locales/zh.json") as Promise<TranslationModule>,
  hi: () => import("./locales/hi.json") as Promise<TranslationModule>,
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
  const [translations, setTranslations] = useState<Partial<Record<Language, TranslationCatalog>>>({
    en: fallbackTranslations,
  });

  useEffect(() => {
    localStorage.setItem("channel-vault-language", language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (translations[language]) return;
    let cancelled = false;
    void translationLoaders[language]()
      .then((module) => {
        if (cancelled) return;
        setTranslations((current) => ({ ...current, [language]: module.default }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [language, translations]);

  const value = useMemo<I18nValue>(() => {
    const setLanguage = (nextLanguage: Language) => setLanguageState(nextLanguage);
    const toggleLanguage = () =>
      setLanguageState((current) => {
        const index = languageOrder.indexOf(current);
        return languageOrder[(index + 1) % languageOrder.length];
      });
    const activeTranslations = translations[language] ?? fallbackTranslations;
    const t = (key: TranslationKey) => activeTranslations[key] ?? fallbackTranslations[key] ?? key;
    return {
      language,
      languageLabel: languages[language],
      setLanguage,
      toggleLanguage,
      t,
    };
  }, [language, translations]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}
