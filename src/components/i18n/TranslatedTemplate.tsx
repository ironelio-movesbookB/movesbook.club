'use client';

import { Fragment, type ReactNode } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translateSportLabel } from '@/lib/sport/sportI18n';

/**
 * A sentence with elements inside (`You have been invited to join the club {0} as a coach.`):
 * the whole template is translated, then `{0}`, `{1}`… are replaced by `values`.
 * Register the template as a label so it gets translated.
 */
export default function TranslatedTemplate({ text, values }: { text: string; values: ReactNode[] }) {
  const { t } = useLanguage();
  const parts = translateSportLabel(t, text).split(/(\{\d\})/);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\{(\d)\}$/.exec(part);
        return <Fragment key={i}>{m ? values[Number(m[1])] : part}</Fragment>;
      })}
    </>
  );
}
