'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import {
  fetchAddAvailableSlotsFormText,
  getAddAvailableSlotsModalTitle,
} from '@/constants/memberArchiveSlotsLongText';
import { getInfoRepsCloseLabel } from '@/constants/infoRepsLongText';
import { useLanguage } from '@/contexts/LanguageContext';
import { sanitizeRichHtml } from '@/lib/sanitizeRichHtml';
import { normalizeToolsLanguage } from '@/utils/toolsProfileLanguage';
import { longTextDisplayHtml } from '@/utils/richTextTranslation';
import { renameQuotaFromSlotCount } from '@/lib/club/clubMemberRenameQuota';

type AddAvailableSlotsModalProps = {
  open: boolean;
  onClose: () => void;
  /** Called after a successful purchase so Archive capacity can reload. */
  onPurchased?: () => void;
};

/**
 * Modal opened by “Add new available slots”.
 * Purchasing N slots: Total += N, rename allowance A += floor(10% × N).
 */
export default function AddAvailableSlotsModal({
  open,
  onClose,
  onPurchased,
}: AddAvailableSlotsModalProps) {
  const { currentLanguage } = useLanguage();
  const language = normalizeToolsLanguage(currentLanguage);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState('100');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const bodyHtml = useMemo(() => sanitizeRichHtml(longTextDisplayHtml(body)), [body]);
  const closeLabel = getInfoRepsCloseLabel(language);
  const title = getAddAvailableSlotsModalTitle(language);

  const slotsNum = Math.round(Number(slots));
  const renamesPreview =
    Number.isFinite(slotsNum) && slotsNum > 0 ? renameQuotaFromSlotCount(slotsNum) : 0;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setBody('');
    setError('');
    setSuccess('');
    setSlots('100');
    void fetchAddAvailableSlotsFormText(language)
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
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, submitting]);

  const handlePurchase = async () => {
    // TODO: enable real slot purchase when payment/checkout flow is ready.
    // Purchase slots is intentionally disabled — do not call the API yet.
    setError('');
    setSuccess('');
    setError(
      language === 'it'
        ? 'Acquisto posti non ancora attivo.'
        : 'Slot purchase is not enabled yet.',
    );
    return;

    // --- disabled purchase flow (keep for later) ---
    // if (!Number.isFinite(slotsNum) || slotsNum < 1) {
    //   setError(
    //     language === 'it'
    //       ? 'Inserisci un numero di posti valido (minimo 1).'
    //       : 'Enter a valid number of slots (minimum 1).',
    //   );
    //   return;
    // }
    // setSubmitting(true);
    // try {
    //   const result = await clubApiFetch<PurchaseResponse>('/api/club/member-slots/purchase', {
    //     method: 'POST',
    //     body: JSON.stringify({ slots: slotsNum }),
    //   });
    //   const added = result.slotsAdded ?? slotsNum;
    //   const renames = result.renamesAddedToA ?? renamesPreview;
    //   setSuccess(
    //     language === 'it'
    //       ? `Aggiunti ${added} posti. Rinomine disponibili (A) +${renames}. Residuali rinomine: ${result.renameResidual ?? '—'}.`
    //       : `Added ${added} slots. Rename allowance (A) +${renames}. Residual renamings: ${result.renameResidual ?? '—'}.`,
    //   );
    //   onPurchased?.();
    // } catch (e: unknown) {
    //   setError(
    //     e instanceof Error
    //       ? e.message
    //       : language === 'it'
    //         ? 'Acquisto non riuscito.'
    //         : 'Purchase failed.',
    //   );
    // } finally {
    //   setSubmitting(false);
    // }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-available-slots-title"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-md border border-gray-300 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 bg-red-700 px-4 py-3 text-white">
          <h3 id="add-available-slots-title" className="text-base font-semibold">
            {title}
          </h3>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-white/60 px-2.5 py-1 text-sm font-semibold hover:bg-white/10 disabled:opacity-60"
            onClick={onClose}
            disabled={submitting}
            aria-label={closeLabel}
          >
            {closeLabel}
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="min-h-[8rem] space-y-4 px-5 py-4 text-sm leading-relaxed text-gray-700">
          {loading ? (
            <p className="text-gray-500">{language === 'it' ? 'Caricamento…' : 'Loading…'}</p>
          ) : (
            <div
              className="prose prose-sm max-w-none prose-p:my-2"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          )}

          <div className="rounded border border-gray-300 bg-gray-50 p-3">
            <label
              htmlFor="purchase-slots-qty"
              className="mb-1 block text-sm font-semibold text-gray-800"
            >
              {language === 'it' ? 'Numero di posti da acquistare' : 'Number of slots to purchase'}
            </label>
            <input
              id="purchase-slots-qty"
              type="number"
              min={1}
              step={1}
              value={slots}
              disabled={submitting}
              onChange={(e) => setSlots(e.target.value)}
              className="w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900"
            />
            <p className="mt-2 text-xs text-gray-600">
              {language === 'it'
                ? `Questo acquisto aggiunge ${renamesPreview} rinomine a A (10% di ${Number.isFinite(slotsNum) && slotsNum > 0 ? slotsNum : 0}).`
                : `This purchase adds ${renamesPreview} renames to A (10% of ${Number.isFinite(slotsNum) && slotsNum > 0 ? slotsNum : 0}).`}
            </p>
          </div>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          {success ? <p className="text-sm font-medium text-emerald-700">{success}</p> : null}
        </div>
        <div className="flex flex-wrap items-stretch justify-end gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex min-h-[3.25rem] items-center justify-center rounded-md border border-gray-300 bg-gray-100 px-5 text-sm font-semibold text-gray-950 hover:bg-gray-200 disabled:opacity-60"
          >
            {closeLabel}
          </button>
          <button
            type="button"
            onClick={() => void handlePurchase()}
            disabled={submitting}
            className="inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-md border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-5 text-sm font-bold text-white shadow hover:from-red-600 hover:to-red-800 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {language === 'it' ? 'Acquista posti' : 'Purchase slots'}
          </button>
        </div>
      </div>
    </div>
  );
}
