'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';

type Props = {
  receiptIds: string[];
  onClose: () => void;
};

/** Archive of Receipts → Send data: mails the selected receipt PDFs to an editable address. */
export default function SendReceiptPdfModal({ receiptIds, onClose }: Props) {
  const [to, setTo] = useState('');
  const [memberName, setMemberName] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const firstId = receiptIds[0] ?? '';

  useEffect(() => {
    if (!firstId) return;
    let active = true;
    clubApiFetch<{ email?: string; memberName?: string }>(
      `/api/club/receipts/send-pdf?receiptId=${encodeURIComponent(firstId)}`,
    )
      .then((data) => {
        if (!active) return;
        setTo((current) => current || data.email || '');
        setMemberName(data.memberName ?? '');
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [firstId]);

  const send = async () => {
    setError('');
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setSending(true);
    try {
      const result = await clubApiFetch<{ to: string; sent: number }>('/api/club/receipts/send-pdf', {
        method: 'POST',
        body: JSON.stringify({ receiptIds, to: to.trim() }),
      });
      window.alert(`${result.sent} receipt PDF${result.sent === 1 ? '' : 's'} sent to ${result.to}.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the receipts');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          className="absolute right-3 top-3 text-gray-400 hover:text-black disabled:opacity-50"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Send receipt PDF</h2>
        <p className="mb-4 text-sm text-gray-600">
          {receiptIds.length === 1
            ? `The PDF of the selected receipt${memberName ? ` (${memberName})` : ''} is attached to the mail.`
            : `The PDFs of the ${receiptIds.length} selected receipts are attached to one mail.`}{' '}
          The address below is the member email; you can change it.
        </p>
        <label className="mb-2 block text-sm font-medium text-gray-700">Mail address</label>
        <input
          type="email"
          autoFocus
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="name@example.com"
          className="mb-3 w-full rounded border border-gray-400 px-3 py-2 text-sm text-gray-900"
          autoComplete="email"
        />
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded border border-gray-400 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send mail'}
          </button>
        </div>
      </div>
    </div>
  );
}
