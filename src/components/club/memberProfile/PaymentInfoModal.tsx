'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { getInfoRepsCloseLabel } from '@/constants/infoRepsLongText';
import { fetchPaymentInfoText } from '@/constants/paymentInfoLongText';
import { resolveProfileLanguageCodeForToolsLoad } from '@/utils/toolsProfileLanguage';
import { longTextDisplayHtml } from '@/utils/richTextTranslation';
import { sanitizeRichHtml } from '@/lib/sanitizeRichHtml';

type PaymentInfoModalProps = {
  open: boolean;
  onClose: () => void;
};

/** Types of payments help — `Payment_info` long text in the signed-in user's profile language. */
export default function PaymentInfoModal({ open, onClose }: PaymentInfoModalProps) {
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('en');
  const bodyHtml = useMemo(() => sanitizeRichHtml(longTextDisplayHtml(body)), [body]);
  const closeLabel = getInfoRepsCloseLabel(language);

  useEffect(() => {
    if (!open) return;
    const lang = resolveProfileLanguageCodeForToolsLoad();
    setLanguage(lang);
    let cancelled = false;
    setLoading(true);
    setBody('');
    void fetchPaymentInfoText(lang).then((text) => {
      if (cancelled) return;
      setBody(text);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

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
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-info-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-gray-300 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 bg-red-700 px-4 py-3 text-white">
          <h3 id="payment-info-title" className="text-base font-semibold">
            Info
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
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-gray-700">
          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <div
              className="long-text-display [&_h3]:mb-3 [&_h3]:mt-5 [&_h3:first-child]:mt-0 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-gray-900 [&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:font-bold [&_h4]:text-red-700 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
