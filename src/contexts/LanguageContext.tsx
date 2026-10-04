'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback, useRef } from 'react';
import { i18n } from '@/lib/i18n';
import { DEFAULT_ACTIVE_LANGUAGES } from '@/constants/language.constants';

interface LanguageContextType {
  currentLanguage: string;
  setLanguage: (code: string) => void;
  t: (key: string) => string;
  availableLanguages: Array<{ code: string; name: string }>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function readActiveLanguages(): string[] {
  try {
    const saved = localStorage.getItem('activeLanguages');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Error parsing active languages:', e);
  }
  return DEFAULT_ACTIVE_LANGUAGES;
}

/** First visit: the first browser language the site offers (e.g. `it-IT` → `it`). */
function detectBrowserLanguage(offered: string[]): string | null {
  const wanted = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of wanted) {
    const code = String(tag || '').toLowerCase().split('-')[0];
    if (offered.includes(code)) return code;
  }
  return null;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [stringsVersion, setStringsVersion] = useState(0);
  const [activeLanguages, setActiveLanguages] = useState<string[]>([]);
  const loadedLanguages = useRef(new Set<string>());

  // Initialize language and active languages from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const active = readActiveLanguages();
      setActiveLanguages(active);
      const offered = i18n.getLanguages().map((l) => l.code).filter((c) => active.includes(c));
      let savedLanguage = localStorage.getItem('language');
      if (!savedLanguage) {
        savedLanguage = detectBrowserLanguage(offered) || 'en';
        localStorage.setItem('language', savedLanguage);
      }
      setCurrentLanguage(savedLanguage);
      i18n.setLanguage(savedLanguage);
    }
  }, []);

  // Section languages (DB) overlay the built-in strings of the current language.
  useEffect(() => {
    const wanted = currentLanguage === 'en' ? ['en'] : ['en', currentLanguage];
    if (wanted.every((code) => loadedLanguages.current.has(code))) return;
    let cancelled = false;
    fetch(`/api/translations?lang=${encodeURIComponent(currentLanguage)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { strings?: Record<string, Record<string, string>> } | null) => {
        if (cancelled || !data?.strings) return;
        for (const [code, strings] of Object.entries(data.strings)) {
          i18n.mergeStrings(code, strings);
          loadedLanguages.current.add(code);
        }
        setStringsVersion((v) => v + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentLanguage]);

  // Page language for browsers' built-in translation and screen readers.
  useEffect(() => {
    document.documentElement.lang = currentLanguage;
  }, [currentLanguage]);

  // Listen for changes to active languages
  useEffect(() => {
    const handleStorageChange = () => {
      if (typeof window !== 'undefined' && localStorage.getItem('activeLanguages')) {
        setActiveLanguages(readActiveLanguages());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom event for same-tab updates
    window.addEventListener('activeLanguagesChanged', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('activeLanguagesChanged', handleStorageChange);
    };
  }, []);

  const setLanguage = useCallback((code: string) => {
    setCurrentLanguage(code);
    i18n.setLanguage(code);
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', code);
    }
  }, []);

  // New identity whenever the language or the loaded strings change, so consumers re-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const t = useCallback((key: string) => i18n.t(key), [currentLanguage, stringsVersion]);

  // Memoize available languages - filter by active status AND preserve custom order
  const availableLanguages = useMemo(() => {
    const allLanguages = i18n.getLanguages().map(lang => ({
      code: lang.code,
      name: lang.name
    }));
    
    // If no active languages set yet, return all
    if (activeLanguages.length === 0) {
      return allLanguages;
    }
    
    // Preserve the custom order from activeLanguages array
    // This ensures the navbar displays languages in the priority order set by admin
    return activeLanguages
      .map(code => allLanguages.find(lang => lang.code === code))
      .filter(lang => lang !== undefined) as Array<{ code: string; name: string }>;
  }, [activeLanguages]);

  const value = useMemo(() => ({
    currentLanguage,
    setLanguage,
    t,
    availableLanguages
  }), [currentLanguage, setLanguage, t, availableLanguages]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
