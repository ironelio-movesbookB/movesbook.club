'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import PaymentModeSelect from '@/components/club/PaymentModeSelect';
import TaxDocumentModal, { type TaxDocumentFormValues } from '@/components/procedures/TaxDocumentModal';
import { useClubDefaultPaymentMethods } from '@/hooks/useClubDefaultPaymentMethods';
import { formatEuro } from '@/lib/club/servicePurchasesClient';
import { blockedPayModesFor } from '@/lib/procedures/payModes';
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
  sellingPayment,
}: PaymentFormProps) {
  const defaultPaymentMethods = useClubDefaultPaymentMethods();
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [createReceipt, setCreateReceipt] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [operatorId, setOperatorId] = useState(sellingPayment?.defaultOperatorId || '');
  const [operatorPassword, setOperatorPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [taxDocument, setTaxDocument] = useState<TaxDocumentFormValues | null>(null);
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!operatorId && sellingPayment?.defaultOperatorId) {
      setOperatorId(sellingPayment.defaultOperatorId);
    }
  }, [operatorId, sellingPayment?.defaultOperatorId]);

  const paidAmount = Number(amountPaid) || 0;
  const newRest = Math.max(0, maxAmount - paidAmount);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!paidAmount || paidAmount <= 0) return;
    if (paidAmount > maxAmount) return;
    setFormError('');
    if (sellingPayment) {
      if (!payMode) return setFormError('Select the mode of payment.');
      if (!operatorId) return setFormError('Select the operator.');
      if (sellingPayment.passwordRequired !== false && !operatorPassword.trim()) {
        return setFormError('Operator password is required.');
      }
      if (createReceipt && !taxDocument) return setFormError('Open the receipt and save it before saving the payment.');
    }

    await onSubmit({
      amountPaid: paidAmount,
      paymentDate,
      notes,
      createReceipt: sellingPayment ? Boolean(createReceipt && taxDocument) : createReceipt,
      receiptNumber: taxDocument?.documentNumber || receiptNumber,
      payMode: sellingPayment ? payMode : undefined,
      operatorId: sellingPayment ? operatorId : undefined,
      operatorPassword: sellingPayment ? operatorPassword : undefined,
      taxDocument: taxDocument ? { ...taxDocument } : undefined,
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

      {sellingPayment && (
        <label className="block">
          <span className="text-sm text-gray-600">Mode of payment</span>
          <PaymentModeSelect
            className="mt-1 w-full border rounded px-3 py-2"
            value={payMode}
            onChange={setPayMode}
            allowEmpty={false}
            defaultPaymentMethods={defaultPaymentMethods}
            disabledMethods={blockedPayModesFor(['product_sale'])}
          />
        </label>
      )}

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
          onChange={(e) => {
            const checked = e.target.checked;
            setCreateReceipt(checked);
            if (!checked) setTaxDocument(null);
            else if (sellingPayment) setTaxModalOpen(true);
          }}
        />
        Create receipt for this payment
      </label>

      {createReceipt && !sellingPayment && (
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

      {sellingPayment && createReceipt && (
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            className="rounded bg-gray-200 px-3 py-2 hover:bg-gray-300"
            onClick={() => setTaxModalOpen(true)}
          >
            Open receipt
          </button>
          <span className="text-gray-600">
            {taxDocument ? `Document No. ${taxDocument.documentNumber}` : 'The receipt opens in a popup.'}
          </span>
        </div>
      )}

      {sellingPayment && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-gray-600">Operator</span>
            <select
              className="mt-1 w-full border rounded px-3 py-2"
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
            >
              <option value="">Select operator</option>
              {sellingPayment.operators.map((operator) => (
                <option key={operator.id} value={operator.id}>{operator.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-gray-600">Operator password</span>
            <span className="relative mt-1 block">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full border rounded px-3 py-2 pr-10"
                value={operatorPassword}
                onChange={(e) => setOperatorPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>
        </div>
      )}

      {formError && <p className="text-red-600 text-sm">{formError}</p>}
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

      {sellingPayment && (
        <TaxDocumentModal
          open={taxModalOpen}
          memberName={sellingPayment.memberName}
          defaultCausal={notes}
          defaultTotal={paidAmount}
          defaultResidual={newRest}
          initial={taxDocument ?? undefined}
          onClose={() => setTaxModalOpen(false)}
          onSave={(values) => {
            setTaxDocument(values);
            setTaxModalOpen(false);
          }}
        />
      )}
    </form>
  );
}
