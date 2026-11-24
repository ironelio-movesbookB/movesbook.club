'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import FaqDisplay from '@/components/faqs/FaqDisplay';
import FaqLanguageFlags from '@/components/faqs/FaqLanguageFlags';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  isFaqLanguage,
  type FaqLanguageCode,
  type FaqPublicItemDto,
  type FaqViewMode,
} from '@/lib/faqs/faqConstants';

type PageData = {
  mode: FaqViewMode;
  path: string;
  items: FaqPublicItemDto[];
  languages: FaqLanguageCode[];
};

/** FAQ Details: every FAQ linked to `?url=` in the chosen language, in the "current page" modality. */
export default function FaqCurrentPageClient() {
  const searchParams = useSearchParams();
  const url = searchParams?.get('url') ?? '';
  const qLang = searchParams?.get('lang');
  const { currentLanguage } = useLanguage();

  const [lang, setLang] = useState<FaqLanguageCode>(
    isFaqLanguage(qLang) ? qLang : isFaqLanguage(currentLanguage) ? currentLanguage : 'en',
  );
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState('');
  const autoSwitched = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setError('');
    const params = new URLSearchParams({ url, lang });
    fetch(`/api/public/faqs/page?${params}`, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Unable to load FAQs');
        if (cancelled) return;
        // First load in a language without FAQs for this page: switch to one that has them.
        if (!autoSwitched.current && !json.items.length && json.languages.length && !json.languages.includes(lang)) {
          autoSwitched.current = true;
          setLang(json.languages[0]);
          return;
        }
        autoSwitched.current = true;
        setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to load FAQs');
      });
    return () => {
      cancelled = true;
    };
  }, [url, lang]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">FAQ Details</h1>
          {data?.path ? <p className="text-xs text-gray-500">{data.path}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-gray-900">Select Language:</span>
          <FaqLanguageFlags value={lang} onChange={setLang} available={data?.languages} />
        </div>
      </div>

      {error ? <p className="text-center text-sm text-red-700">{error}</p> : null}
      {!url ? <p className="text-center text-sm text-gray-500">No page selected.</p> : null}
      {url && data ? (
        <FaqDisplay items={data.items} mode={data.mode} emptyText="There are no FAQs for this page yet." />
      ) : null}
    </div>
  );
}
