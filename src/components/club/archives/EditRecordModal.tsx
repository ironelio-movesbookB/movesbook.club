'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { createProcedureClient } from '@/lib/club/procedureClient';
import { toDateInputValue } from '@/lib/club/servicePurchasesClient';
import { getProcedureDefinition } from '@/lib/procedures/registry';
import { PROCEDURE_TYPE_CODES, type ProcedureTypeCode } from '@/lib/procedures/types';

type EditRecordModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  procedureCode?: ProcedureTypeCode;
  record: {
    id: string;
    recordDate: string | null;
    paydate: string | null;
    expireDate?: string | null;
    notes: string;
    operatorId: string | null;
  };
};

export default function EditRecordModal({
  isOpen,
  onClose,
  onSaved,
  procedureCode = PROCEDURE_TYPE_CODES.SERVICE_SALE,
  record,
}: EditRecordModalProps) {
  const client = useMemo(() => createProcedureClient(procedureCode), [procedureCode]);
  const title = getProcedureDefinition(procedureCode)?.name ?? 'Record';
  const [recordDate, setRecordDate] = useState('');
  const [expireDate, setExpireDate] = useState('');
  const [notes, setNotes] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [operators, setOperators] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setRecordDate(toDateInputValue(record.recordDate));
    // A caller that supplies `expireDate` owns the value, even when it is null (no expiration set).
    setExpireDate(
      toDateInputValue(record.expireDate !== undefined ? record.expireDate : record.paydate)
    );
    setNotes(record.notes ?? '');
    setOperatorId(record.operatorId ?? '');
    setError(null);
    setSaving(false);
    client
      .fetchFormOptions<{ operators?: { id: string; name: string }[] }>()
      .then((options) => setOperators(options.operators ?? []))
      .catch(() => {});
  }, [isOpen, record, client]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await client.updateRecord(record.id, {
        recordDate: recordDate || undefined,
        dueDate: expireDate || undefined,
        notes: notes || undefined,
        operatorId: operatorId || undefined,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md border border-gray-400 bg-[#f3f3f3] shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="absolute right-3 top-3 z-10 rounded p-1 text-white/90 hover:bg-white/10 disabled:opacity-50"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="bg-[#6b1020] px-4 py-2.5 pr-10 text-sm font-semibold text-white">
          Edit {title} Record
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label htmlFor="edit-record-date" className="mb-1 block text-sm text-gray-800">Date</label>
            <input
              id="edit-record-date"
              type="date"
              value={recordDate}
              readOnly
              disabled
              className="w-full rounded border border-gray-400 bg-gray-100 px-3 py-2 text-sm text-gray-600 disabled:opacity-100"
            />
          </div>

          <div>
            <label htmlFor="edit-expire-date" className="mb-1 block text-sm text-gray-800">Expiration Date</label>
            <input
              id="edit-expire-date"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={expireDate}
              onChange={(e) => setExpireDate(e.target.value)}
              disabled={saving}
              className="w-full rounded border border-gray-400 px-3 py-2 text-sm disabled:opacity-60"
              style={{ backgroundColor: '#d3f07b' }}
            />
          </div>

          <div>
            <label htmlFor="edit-notes" className="mb-1 block text-sm text-gray-800">Notes</label>
            <textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
              rows={3}
              className="w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="edit-operator" className="mb-1 block text-sm text-gray-800">Operator</label>
            <select
              id="edit-operator"
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              disabled={saving}
              className="w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm disabled:opacity-60"
            >
              <option value="">Select operator</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>{op.name}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-center gap-4 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="flex items-center justify-center gap-2 rounded-lg border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-8 py-2.5 text-sm font-semibold text-white shadow disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-lg border border-gray-900 bg-gradient-to-b from-gray-700 to-black px-8 py-2.5 text-sm font-semibold text-white shadow disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
