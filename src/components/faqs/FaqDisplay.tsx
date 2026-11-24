'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ExternalLink, Eye, RefreshCw } from 'lucide-react';
import FaqHtml from '@/components/faqs/FaqHtml';
import { faqIconSrc } from '@/lib/faqs/faqClient';
import type { FaqPublicItemDto, FaqViewMode } from '@/lib/faqs/faqConstants';

type Props = {
  items: FaqPublicItemDto[];
  mode: FaqViewMode;
  emptyText?: string;
};

/**
 * Public FAQ display in the modality chosen in Settings ("Modality Of View"):
 * 3 for row, 4 for row, or Cascade. "Reverse Button" switches light/dark cards.
 */
export default function FaqDisplay({ items, mode, emptyText = 'No FAQs available.' }: Props) {
  const [reversed, setReversed] = useState(false);

  if (!items.length) {
    return <p className="py-10 text-center text-sm text-gray-500">{emptyText}</p>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setReversed((r) => !r)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-red-700 hover:underline"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        Reverse Button
      </button>
      {mode === 'cascade' ? (
        <FaqCascade items={items} reversed={reversed} />
      ) : (
        <div
          className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${
            mode === 'grid4' ? 'lg:grid-cols-3 xl:grid-cols-4' : 'lg:grid-cols-3'
          }`}
        >
          {items.map((item) => (
            <FaqCard key={item.id} item={item} reversed={reversed} />
          ))}
        </div>
      )}
    </div>
  );
}

function FaqIcon({ path }: { path: string | null }) {
  const src = faqIconSrc(path);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="h-6 w-6 rounded-sm bg-white object-cover" />;
}

function FaqLink({ item, reversed }: { item: FaqPublicItemDto; reversed: boolean }) {
  if (item.docType !== 'link' || !item.url) return null;
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-2 inline-flex items-center gap-1 text-sm hover:underline ${
        reversed ? 'text-cyan-200' : 'text-blue-700'
      }`}
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      Open link
    </a>
  );
}

/** 👁 — open the FAQ at full page (PHP FaqPage/faq_doubleclick/{id}). */
function FaqOpenFull({ id, className = '' }: { id: string; className?: string }) {
  return (
    <Link
      href={`/faqs/view/${encodeURIComponent(id)}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Open the FAQ at full page"
      aria-label="Open the FAQ at full page"
      className={`inline-flex shrink-0 items-center justify-center rounded p-1 hover:bg-black/10 ${className}`}
    >
      <Eye className="h-4 w-4" />
    </Link>
  );
}

function FaqCard({ item, reversed }: { item: FaqPublicItemDto; reversed: boolean }) {
  return (
    <article
      className={`flex min-w-0 flex-col rounded-lg p-4 shadow-[0_2px_10px_rgba(0,0,0,0.18)] ${
        reversed ? 'bg-[#0b2a4a] text-white' : 'bg-white text-gray-900'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <FaqIcon path={item.iconPath} />
        <FaqOpenFull id={item.id} className="ml-auto" />
      </div>
      <h3 className="mt-3 text-xl leading-snug">{item.title}</h3>
      {item.subtitle ? (
        <p className={`mt-1 text-base ${reversed ? 'text-slate-300' : 'text-gray-700'}`}>{item.subtitle}</p>
      ) : null}
      <FaqHtml html={item.content} className={`faq-card-content mt-2 text-sm ${reversed ? 'faq-html-dark' : ''}`} />
      <FaqLink item={item} reversed={reversed} />
    </article>
  );
}

function FaqCascade({ items, reversed }: { items: FaqPublicItemDto[]; reversed: boolean }) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    setOpenId(items[0]?.id ?? null);
  }, [items]);

  return (
    <div className={`space-y-2 rounded p-3 ${reversed ? 'bg-[#071d33]' : 'bg-[#e9fbf6]'}`}>
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <section key={item.id} className="overflow-hidden rounded-sm shadow-sm">
            <div
              className={`flex w-full items-center gap-1 pr-2 text-sm ${
                open
                  ? 'bg-[#1a9ba5] text-white'
                  : reversed
                    ? 'bg-[#0b2a4a] text-white hover:bg-[#12385f]'
                    : 'bg-[#e6e6e6] text-gray-900 hover:bg-[#dcdcdc]'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : item.id)}
                aria-expanded={open}
                className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-4 text-left"
              >
                <FaqIcon path={item.iconPath} />
                <span className="min-w-0 flex-1">
                  <strong>{item.title}</strong>
                  {' - '}
                  <span>{item.subtitle}</span>
                </span>
              </button>
              <FaqOpenFull id={item.id} />
              <button
                type="button"
                onClick={() => setOpenId(open ? null : item.id)}
                aria-label={open ? 'Hide content' : 'Show content'}
                className="rounded p-1 hover:bg-black/10"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
              </button>
            </div>
            {open ? (
              <div className={`px-4 py-3 ${reversed ? 'bg-[#0b2a4a] text-white' : 'bg-white text-gray-800'}`}>
                <FaqHtml html={item.content} className={`text-sm ${reversed ? 'faq-html-dark' : ''}`} />
                <FaqLink item={item} reversed={reversed} />
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
