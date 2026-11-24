'use client';

import { Loader2 } from 'lucide-react';

type PromocodeConfirmModalProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Raise when the modal opens on top of another overlay. */
  zIndexClass?: string;
};

export default function PromocodeConfirmModal({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onClose,
  onConfirm,
  zIndexClass = 'z-[110]',
}: PromocodeConfirmModalProps) {
  if (!open) return null;

  const btnClass =
    'rounded border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-gray-200 disabled:opacity-60';

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/55 p-4`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="promocode-confirm-title"
      onClick={loading ? undefined : onClose}
    >
      <div
        className="w-full max-w-md border border-gray-400 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-300 bg-[#7b0a26] px-4 py-3 text-lg font-semibold text-white">
          <h2 id="promocode-confirm-title">{title}</h2>
        </div>
        <p className="whitespace-pre-wrap px-4 py-5 text-sm text-gray-800">{message}</p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
          <button type="button" onClick={onClose} disabled={loading} className={btnClass}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={
              destructive
                ? 'inline-flex items-center gap-2 rounded border border-red-700 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60'
                : 'inline-flex items-center gap-2 rounded border border-[#7b0a26] bg-[#7b0a26] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5c081d] disabled:opacity-60'
            }
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
