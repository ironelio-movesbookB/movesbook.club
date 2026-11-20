'use client';

import { FAQ_LANGUAGES, type FaqLanguageCode } from '@/lib/faqs/faqConstants';

type Props = {
  value: FaqLanguageCode;
  onChange: (lang: FaqLanguageCode) => void;
  /** Languages that have content; others are shown dimmed and disabled. Omit to enable all. */
  available?: FaqLanguageCode[];
};

/** "Select Language:" flag row of the PHP FAQ Details page. */
export default function FaqLanguageFlags({ value, onChange, available }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {FAQ_LANGUAGES.map((l) => {
        const enabled = !available || available.includes(l.code);
        const selected = value === l.code;
        return (
          <button
            key={l.code}
            type="button"
            title={enabled ? l.name : `${l.name} — no FAQs in this language`}
            aria-label={l.name}
            aria-pressed={selected}
            disabled={!enabled}
            onClick={() => onChange(l.code)}
            className={`rounded-sm p-0.5 ${
              selected ? 'ring-2 ring-blue-600' : 'ring-1 ring-transparent hover:ring-gray-400'
            } ${enabled ? '' : 'cursor-not-allowed opacity-30'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.flag} alt="" className="h-4 w-6 object-cover" />
          </button>
        );
      })}
    </div>
  );
}
