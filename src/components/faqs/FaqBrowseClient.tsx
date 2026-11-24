'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import FaqDisplay from '@/components/faqs/FaqDisplay';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  FAQ_LANGUAGES,
  FAQ_SECTIONS,
  FAQ_SUBSECTIONS,
  isFaqLanguage,
  isFaqSection,
  isFaqSubsection,
  isValidFaqPair,
  type FaqLanguageCode,
  type FaqPublicItemDto,
  type FaqSectionKey,
  type FaqSubsectionKey,
  type FaqViewMode,
} from '@/lib/faqs/faqConstants';

type Result = { mode: FaqViewMode; items: FaqPublicItemDto[] };

function Pill({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-w-[120px] items-center justify-center gap-2 rounded-full border-2 px-5 py-2 text-base transition ${
        selected
          ? 'border-[#333] bg-[#333] text-white'
          : 'border-gray-200 bg-white text-gray-800 hover:border-gray-400'
      } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full border-2 ${selected ? 'border-white bg-white' : 'border-gray-700'}`} />
      {label}
    </button>
  );
}

export default function FaqBrowseClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { currentLanguage } = useLanguage();

  const qSection = searchParams?.get('section');
  const qSubsection = searchParams?.get('subsection');
  const qLang = searchParams?.get('lang');

  const [section, setSection] = useState<FaqSectionKey | null>(isFaqSection(qSection) ? qSection : null);
  const [subsection, setSubsection] = useState<FaqSubsectionKey | null>(
    isFaqSubsection(qSubsection) ? qSubsection : null,
  );
  const [lang, setLang] = useState<FaqLanguageCode>(
    isFaqLanguage(qLang) ? qLang : isFaqLanguage(currentLanguage) ? currentLanguage : 'en',
  );
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (s: FaqSectionKey, sub: FaqSubsectionKey, l: FaqLanguageCode) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ section: s, subsection: sub, lang: l });
      const res = await fetch(`/api/public/faqs?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Unable to load FAQs');
      setResult({ mode: data.mode, items: data.items });
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : 'Unable to load FAQs');
    } finally {
      setLoading(false);
    }
  }, []);

  // Opening a shared link (?section=&subsection=&lang=) shows the results immediately.
  useEffect(() => {
    if (isFaqSection(qSection) && isFaqSubsection(qSubsection) && isValidFaqPair(qSection, qSubsection)) {
      void load(qSection, qSubsection, isFaqLanguage(qLang) ? qLang : lang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pairValid = !!section && !!subsection && isValidFaqPair(section, subsection);

  const search = () => {
    if (!section || !subsection) {
      setError('Select a Section and a Sub Section');
      return;
    }
    if (!pairValid) {
      setError('This Section has no such Sub Section');
      return;
    }
    router.replace(`${pathname}?${new URLSearchParams({ section, subsection, lang })}`, { scroll: false });
    void load(section, subsection, lang);
  };

  const selectSection = (s: FaqSectionKey) => {
    setSection(s);
    if (subsection && !isValidFaqPair(s, subsection)) setSubsection(null);
  };

  return (
    <div>
      <div className="rounded-sm bg-[#e59a09] px-6 py-8 text-white">
        <h1 className="mb-6 text-5xl font-bold">FAQS</h1>
        <div className="flex flex-col items-center gap-5">
          <span className="rounded-full bg-[#1a9ba5] px-8 py-2 text-xl">Sections</span>
          <div role="radiogroup" aria-label="Sections" className="flex flex-wrap justify-center gap-2">
            {FAQ_SECTIONS.map((s) => (
              <Pill key={s.key} label={s.label} selected={section === s.key} onClick={() => selectSection(s.key)} />
            ))}
          </div>
          <span className="rounded-full bg-[#1a9ba5] px-8 py-2 text-xl">Sub Sections</span>
          <div role="radiogroup" aria-label="Sub Sections" className="flex flex-wrap justify-center gap-2">
            {FAQ_SUBSECTIONS.map((s) => (
              <Pill
                key={s.key}
                label={s.label}
                selected={subsection === s.key}
                disabled={!!section && !isValidFaqPair(section, s.key)}
                onClick={() => setSubsection(s.key)}
              />
            ))}
          </div>
        </div>
        <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="flex flex-col gap-1 text-base text-gray-900">
            Select Language
            <select
              value={lang}
              onChange={(e) => {
                const l = e.target.value as FaqLanguageCode;
                setLang(l);
                if (result && pairValid) {
                  router.replace(`${pathname}?${new URLSearchParams({ section: section!, subsection: subsection!, lang: l })}`, {
                    scroll: false,
                  });
                  void load(section!, subsection!, l);
                }
              }}
              className="w-40 rounded-sm border border-gray-400 bg-white px-2 py-1 text-gray-900"
            >
              {FAQ_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={search}
            disabled={loading}
            className="rounded-full bg-[#1a9ba5] px-12 py-2 text-xl text-white hover:bg-[#158891] disabled:opacity-60"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
          <span className="hidden w-40 sm:block" />
        </div>
      </div>

      {error ? <p className="mt-4 text-center text-sm text-red-700">{error}</p> : null}

      {result ? (
        <div className="mt-6">
          <FaqDisplay
            items={result.items}
            mode={result.mode}
            emptyText="No FAQs in this section for the selected language."
          />
        </div>
      ) : null}
    </div>
  );
}
