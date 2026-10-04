'use client';

import { useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translateSportLabel } from '@/lib/sport/sportI18n';

/** Translates English sport labels through the Section languages (`sport_*` keys). */
export function useSportT(): (text: string) => string {
  const { t, currentLanguage } = useLanguage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((text: string) => translateSportLabel(t, text), [t, currentLanguage]);
}
