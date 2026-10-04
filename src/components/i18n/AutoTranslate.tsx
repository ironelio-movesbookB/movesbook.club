'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { attachAutoTranslate, createTextTranslator } from '@/lib/translation/domAutoTranslate';
import { sportLabelKey } from '@/lib/sport/sportI18n';
import autoTranslatePatterns from '@/lib/sport/autoTranslatePatterns.json';

function useAutoTranslateElement(el: HTMLElement | null) {
  const { t } = useLanguage();
  const translate = useMemo(
    () =>
      createTextTranslator((text) => {
        if (!/[A-Za-z]/.test(text)) return null;
        const key = sportLabelKey(text);
        if (key === 'sport_') return null;
        const value = t(key);
        return value && value !== key ? value : null;
      }, autoTranslatePatterns),
    [t],
  );
  useEffect(() => {
    if (!el) return;
    return attachAutoTranslate(el, translate);
  }, [el, translate]);
}

/** Callback ref for content rendered outside an <AutoTranslate> tree (portals, popups). */
export function useAutoTranslateRef<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  useAutoTranslateElement(el);
  return setEl;
}

/**
 * Shows every fixed English text inside `children` (labels, options, placeholders, titles) in the
 * current language, using the section-language strings (`sport_*` keys). Wrap a whole screen;
 * mark user content with `translate="no"` when it must never be swapped.
 */
export default function AutoTranslate({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => setEl(ref.current), []);
  useAutoTranslateElement(el);

  return (
    <div ref={ref} data-auto-translate="" style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
