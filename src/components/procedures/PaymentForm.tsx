'use client';

import { useState } from 'react';
import { formatEuro } from '@/lib/club/servicePurchasesClient';
import type { PaymentFormProps } from './types';

export default function PaymentForm({
  maxAmount,
  disabled,
  saving,
  error,
  success,
  onSubmit,
  onCancel,
  cancelLabel = 'Back to deadlines',
}: PaymentFormProps) {
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [createReceipt, setCreateReceipt] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');

  const paidAmount = Number(amountPaid) || 0;
  const newRest = Math.max(0, maxAmount - paidAmount);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!paidAmount || paidAmount <= 0) return;
    if (paidAmount > maxAmount) return;

    await onSubmit({
      amountPaid: paidAmount,
      paymentDate,
      notes,
      createReceipt,
      receiptNumber,
    });

    setAmountPaid('');
    setNotes('');
    setReceiptNumber('');
    setCreateReceipt(false);
  }

  if (disabled) {
    return (
      <div className="text-green-700 bg-green-50 border border-green-200 rounded p-4">
        This record is fully paid.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm text-gray-600">Payment IN (€)</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={maxAmount}
            className="mt-1 w-full border rounded px-3 py-2 bg-yellow-50"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">Payment date</span>
          <input
            type="date"
            className="mt-1 w-full border rounded px-3 py-2"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
          />
        </label>
      </div>

      <div className="text-sm bg-gray-50 p-3 rounded">
        After payment — Rest: <strong className="text-red-600">{formatEuro(newRest)}</strong>
      </div>

      <label className="block">
        <span className="text-sm text-gray-600">Notes</span>
        <textarea
          className="mt-1 w-full border rounded px-3 py-2"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={createReceipt}
          onChange={(e) => setCreateReceipt(e.target.checked)}
        />
        Create receipt for this payment
      </label>

      {createReceipt && (
        <label className="block">
          <span className="text-sm text-gray-600">Document No.</span>
          <input
            type="text"
            className="mt-1 w-full border rounded px-3 py-2"
            placeholder="0001-2026"
            value={receiptNumber}
            onChange={(e) => setReceiptNumber(e.target.value)}
          />
        </label>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {success && <p className="text-green-700 text-sm">{success}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 bg-teal-700 text-white rounded hover:bg-teal-800 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save payment'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            {cancelLabel}
          </button>
        )}
      </div>
    </form>
  );
}
