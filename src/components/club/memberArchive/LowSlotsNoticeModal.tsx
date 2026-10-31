'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  fetchArchiveLowSlotsNoticeText,
  getAddAvailableSlotsButtonLabels,
  getLowSlotsNoticeTitle,
} from '@/constants/memberArchiveSlotsLongText';
import { getInfoRepsCloseLabel } from '@/constants/infoRepsLongText';
import { useLanguage } from '@/contexts/LanguageContext';
import { sanitizeRichHtml } from '@/lib/sanitizeRichHtml';
import { normalizeToolsLanguage } from '@/utils/toolsProfileLanguage';
import { longTextDisplayHtml } from '@/utils/richTextTranslation';

type LowSlotsNoticeModalProps = {
  open: boolean;
  onClose: () => void;
  onAddSlots: () => void;
};

/** Residual slots &lt; 10 — Notice + same “Add new available slots” action as the header. */
export default function LowSlotsNoticeModal({
  open,
  onClose,
  onAddSlots,
}: LowSlotsNoticeModalProps) {
  const { currentLanguage } = useLanguage();
  const language = normalizeToolsLanguage(currentLanguage);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const bodyHtml = useMemo(() => sanitizeRichHtml(longTextDisplayHtml(body)), [body]);
  const closeLabel = getInfoRepsCloseLabel(language);
  const noticeTitle = getLowSlotsNoticeTitle(language);
  const addSlotsLabels = getAddAvailableSlotsButtonLabels(language);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setBody('');
    void fetchArchiveLowSlotsNoticeText(language)
      .then((text) => {
        if (cancelled) return;
        setBody(text);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, language]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="low-slots-notice-title"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-md border border-gray-300 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 bg-red-700 px-4 py-3 text-white">
          <h3 id="low-slots-notice-title" className="text-base font-semibold">
            {noticeTitle}
          </h3>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-white/60 px-2.5 py-1 text-sm font-semibold hover:bg-white/10"
            onClick={onClose}
            aria-label={closeLabel}
          >
            {closeLabel}
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="px-5 py-4 text-sm leading-relaxed text-gray-700">
          {loading ? (
            <p className="text-gray-500">{language === 'it' ? 'Caricamento…' : 'Loading…'}</p>
          ) : (
            <div
              className="prose prose-sm max-w-none prose-p:my-2"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          )}
        </div>
        <div className="flex flex-wrap items-stretch justify-end gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[3.25rem] items-center justify-center rounded-md border border-gray-300 bg-gray-100 px-5 text-sm font-semibold text-gray-950 hover:bg-gray-200"
          >
            {closeLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onAddSlots();
            }}
            className="inline-flex min-h-[3.25rem] flex-col justify-center rounded-md border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-4 py-2 text-left text-sm font-bold text-white shadow hover:from-red-600 hover:to-red-800"
          >
            <span className="block leading-tight">{addSlotsLabels.title}</span>
            <span className="mt-0.5 block text-[11px] font-medium leading-snug opacity-95">
              {addSlotsLabels.subtitle}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
