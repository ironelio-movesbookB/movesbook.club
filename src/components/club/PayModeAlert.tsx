'use client';

import { useEffect, useState } from 'react';
import { fetchPayModeAlertText } from '@/constants/payModeAlertLongText';
import { useLanguage } from '@/contexts/LanguageContext';
import { stripStoredHtml } from '@/lib/promocodes/suggestMovesbookCopy';

/** Red/blue pay mode legend (Language → Long texts → `Pay_mode_alert`). */
export default function PayModeAlert({ className = '' }: { className?: string }) {
  const { currentLanguage } = useLanguage();
  const [text, setText] = useState('');

  useEffect(() => {
    let active = true;
    void fetchPayModeAlertText(currentLanguage).then((value) => {
      if (active) setText(stripStoredHtml(value));
    });
    return () => {
      active = false;
    };
  }, [currentLanguage]);

  if (!text) return null;
  return (
    <p
      role="note"
      className={`rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ${className}`}
    >
      {text}
    </p>
  );
}
