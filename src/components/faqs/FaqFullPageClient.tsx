'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import FaqHtml from '@/components/faqs/FaqHtml';
import FaqLanguageFlags from '@/components/faqs/FaqLanguageFlags';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  faqSectionLabel,
  faqSubsectionLabel,
  isFaqLanguage,
  type FaqLanguageCode,
} from '@/lib/faqs/faqConstants';
import type { FaqPublicDetailDto } from '@/lib/faqs/faqService';

type Data = { faq: FaqPublicDetailDto; languages: FaqLanguageCode[] };

/** FAQ Details at full page: Title, Code, Document Type, Section, Sub Section, Content (PHP layout). */
export default function FaqFullPageClient({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const qLang = searchParams?.get('lang');
  const { currentLanguage } = useLanguage();
  const [lang, setLang] = useState<FaqLanguageCode>(
    isFaqLanguage(qLang) ? qLang : isFaqLanguage(currentLanguage) ? currentLanguage : 'en',
  );
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    fetch(`/api/public/faqs/item?${new URLSearchParams({ id, lang })}`, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Unable to load the FAQ');
        if (cancelled) return;
        // Requested language not written: show the first language that has content.
        if (!json.faq.hasLang && json.languages.length && !json.languages.includes(lang)) {
          setLang(json.languages[0]);
          return;
        }
        setData(json);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Unable to load the FAQ'));
    return () => {
      cancelled = true;
    };
  }, [id, lang]);

  const faq = data?.faq;
  const row = 'text-sm text-gray-800';

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl text-gray-800">FAQ Details</h1>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-gray-900">Select Language:</span>
          <FaqLanguageFlags value={lang} onChange={setLang} available={data?.languages} />
        </div>
      </div>

      {error ? <p className="py-6 text-center text-sm text-red-700">{error}</p> : null}
      {!faq && !error ? <p className="py-6 text-center text-sm text-gray-500">Loading…</p> : null}

      {faq ? (
        <div className="space-y-4 bg-[#f4f4f4] px-4 py-5">
          <p className={row}>
            <strong>Title:</strong> {faq.title}
            {faq.subtitle ? <span className="text-gray-600"> - {faq.subtitle}</span> : null}
          </p>
          <p className={row}>
            <strong>Code:</strong> {faq.code}
          </p>
          <p className={row}>
            <strong>Document Type:</strong>{' '}
            {faq.url ? (
              <a
                href={faq.url}
                target="_blank"
                rel="noopener noreferrer"
                title={faq.url}
                aria-label="Open the linked document"
                className="inline-flex align-middle text-gray-700 hover:text-blue-700"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <span>{faq.docType === 'link' ? 'Link' : 'Document'}</span>
            )}
          </p>
          <p className={row}>
            <strong>Section:</strong> {faq.pairs.map((p) => faqSectionLabel(p.section)).join(', ')}
          </p>
          <p className={row}>
            <strong>Sub Section:</strong> {faq.pairs.map((p) => faqSubsectionLabel(p.subsection)).join(', ')}
          </p>
          <div className={row}>
            <strong>Content:</strong>
            {faq.hasLang ? (
              <FaqHtml html={faq.content} className="mt-2" />
            ) : (
              <p className="mt-2 text-gray-500">No content in this language.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
