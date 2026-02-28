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

function applyTheme(theme?: string) {
  const resolved = theme || 'dark';
  if (resolved === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  } else {
    document.documentElement.dataset.theme = resolved;
  }
}

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

  // Listen for settings changes from other components (language + theme)
  useEffect(() => {
    const handler = () => {
      try {
        const saved = localStorage.getItem('owlivion-settings');
        if (saved) {
          const settings = JSON.parse(saved);
          if (settings.language && settings.language !== lang) {
            setLangState(settings.language);
          }
          applyTheme(settings.theme);
        }
      } catch { /* ignore */ }
    };

    window.addEventListener('owlivion-settings-updated', handler);
    return () => window.removeEventListener('owlivion-settings-updated', handler);
  }, [lang]);

  // Apply theme to document on mount and when system preference changes
  useEffect(() => {
    const saved = localStorage.getItem('owlivion-settings');
    const settings = saved ? JSON.parse(saved) : {};
    applyTheme(settings.theme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const systemHandler = () => {
      const s = localStorage.getItem('owlivion-settings');
      const st = s ? JSON.parse(s) : {};
      if (st.theme === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', systemHandler);
    return () => mediaQuery.removeEventListener('change', systemHandler);
  }, []);

  return React.createElement(
    LanguageContext.Provider,
    { value: { t, lang, setLang } },
    children
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
