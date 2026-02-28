import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { en } from './locales/en';
import type { TranslationKeys } from './locales/en';
import { tr } from './locales/tr';

type Translations = TranslationKeys;

interface LanguageContextType {
  t: (key: string) => string;
  lang: string;
  setLang: (lang: string) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  t: (key: string) => key,
  lang: 'en',
  setLang: () => {},
});

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : undefined;
}

const locales: Record<string, Translations> = { en, tr };

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem('owlivion-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        return settings.language || 'en';
      }
    } catch { /* ignore */ }
    return 'en';
  });

  const t = useCallback((key: string): string => {
    const translations = locales[lang] || locales.en;
    return getNestedValue(translations as unknown as Record<string, unknown>, key) || key;
  }, [lang]);

  const setLang = useCallback((newLang: string) => {
    setLangState(newLang);
    // Sync to localStorage settings
    try {
      const saved = localStorage.getItem('owlivion-settings');
      const settings = saved ? JSON.parse(saved) : {};
      settings.language = newLang;
      localStorage.setItem('owlivion-settings', JSON.stringify(settings));
    } catch { /* ignore */ }
  }, []);

  // Listen for settings changes from other components
  useEffect(() => {
    const handler = () => {
      try {
        const saved = localStorage.getItem('owlivion-settings');
        if (saved) {
          const settings = JSON.parse(saved);
          if (settings.language && settings.language !== lang) {
            setLangState(settings.language);
          }
        }
      } catch { /* ignore */ }
    };

    window.addEventListener('owlivion-settings-updated', handler);
    return () => window.removeEventListener('owlivion-settings-updated', handler);
  }, [lang]);

  return React.createElement(
    LanguageContext.Provider,
    { value: { t, lang, setLang } },
    children
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
