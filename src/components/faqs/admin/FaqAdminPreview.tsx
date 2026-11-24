'use client';

import { useEffect, useState } from 'react';
import FaqHtml from '@/components/faqs/FaqHtml';
import { faqAdminFetch } from '@/lib/faqs/faqClient';
import { FAQ_LANGUAGES, type FaqLanguageCode } from '@/lib/faqs/faqConstants';
import type { FaqDetailDto } from '@/lib/faqs/faqService';

/** 👁 preview under a row: "Language Selected" flags + title, sub-title and content of that language. */
export default function FaqAdminPreview({ faqId, initialLang }: { faqId: string; initialLang: FaqLanguageCode }) {
  const [faq, setFaq] = useState<FaqDetailDto | null>(null);
  const [error, setError] = useState('');
  const [lang, setLang] = useState<FaqLanguageCode>(initialLang);

  useEffect(() => {
    faqAdminFetch<{ faq: FaqDetailDto }>(`/api/admin/faqs/items/${encodeURIComponent(faqId)}`)
      .then((d) => {
        setFaq(d.faq);
        if (!d.faq.filledLangs.includes(initialLang) && d.faq.filledLangs.length) setLang(d.faq.filledLangs[0]);
      })
      .catch((e) => setError(e.message));
  }, [faqId, initialLang]);

  if (!faq) return <p className="p-3 text-sm text-gray-500">{error || 'Loading…'}</p>;

  const t = faq.translations.find((x) => x.lang === lang);

  return (
    <div className="bg-white text-sm text-gray-900">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-gray-200 px-4 py-2">
        <span className="mr-6 text-gray-700">Language Selected</span>
        {FAQ_LANGUAGES.map((l) => {
          const filled = faq.filledLangs.includes(l.code);
          return (
            <button
              key={l.code}
              type="button"
              onClick={() => setLang(l.code)}
              title={`${l.name}${filled ? '' : ' — empty'}`}
              className="inline-flex items-center gap-1"
            >
              <span
                className={`h-2.5 w-2.5 rounded-full border ${
                  lang === l.code
                    ? 'border-green-700 bg-green-600'
                    : filled
                      ? 'border-red-700 bg-red-600'
                      : 'border-gray-500 bg-white'
                }`}
                aria-hidden
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.flag} alt={l.name} className="h-3 w-4 object-cover" />
            </button>
          );
        })}
      </div>
      <p className="mt-1 px-4 text-xs text-gray-500">
        Green: language shown · Red: has content · Empty: no content
      </p>
      {t ? (
        <dl className="grid grid-cols-[80px_minmax(0,1fr)] gap-x-2 gap-y-1 px-4 py-3">
          <dt className="font-bold">Title:</dt>
          <dd>{t.title}</dd>
          <dt className="font-bold">sub-title:</dt>
          <dd>{t.subtitle}</dd>
          <dt className="font-bold">Content:</dt>
          <dd>
            <FaqHtml html={t.content} />
          </dd>
        </dl>
      ) : (
        <p className="px-4 py-3 text-gray-500">No content in this language.</p>
      )}
    </div>
  );
}
