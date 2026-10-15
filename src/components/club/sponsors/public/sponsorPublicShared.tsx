'use client';

import { Languages } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { SPONSOR_PUBLIC_TEXTS, fillSponsorText } from '@/lib/club/sponsors/sponsorPublicTexts';

/** `?lang=` first, then the visitor's site language; empty lets the server use the club admin's language. */
export function initialSponsorPageLanguage(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('language') || '';
}

export function makeSponsorT(texts: Record<string, string> | undefined) {
  return (key: string, vars?: Record<string, string | number>) =>
    fillSponsorText(texts?.[key] ?? SPONSOR_PUBLIC_TEXTS[key]?.en ?? key, vars);
}

export function SponsorLanguageSelect({
  value,
  label,
  onChange,
  className,
}: {
  value: string;
  label: string;
  onChange: (code: string) => void;
  className?: string;
}) {
  const { availableLanguages, setLanguage } = useLanguage();
  const options = availableLanguages.some((l) => l.code === value)
    ? availableLanguages
    : [...availableLanguages, { code: value, name: value.toUpperCase() }];
  return (
    <label className={`inline-flex items-center gap-1.5 text-sm ${className ?? ''}`}>
      <Languages className="h-4 w-4" aria-hidden />
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => {
          setLanguage(e.target.value);
          onChange(e.target.value);
        }}
        className="rounded-md border border-white/40 bg-white/10 px-2 py-1 text-sm text-inherit focus:outline-none [&>option]:text-gray-900"
      >
        {options.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function sectionLabel(t: ReturnType<typeof makeSponsorT>, key: string): string {
  return t(key ? `spk_section_${key}` : 'spk_section_presentation');
}
