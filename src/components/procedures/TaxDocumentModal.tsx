'use client';

import { useEffect, useState } from 'react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import {
  buildMemberDisplayName,
  buildTaxDocumentDefaults,
  computeVatBreakdown,
  counterValueForDocumentType,
  nextDocumentNumber,
  TAX_DOCUMENT_TYPE_OPTIONS,
  type TaxDocumentClubSettings,
  type TaxDocumentDefaults,
} from '@/lib/procedures/taxDocumentDefaults';
import {
  procedureHighlightInputClass,
  procedureInputClass,
  procedureReadonlyInputClass,
} from './ProcedureFormLayout';

export type TaxDocumentFormValues = {
  documentType: string;
  heading: string;
  documentDate: string;
  documentNumber: string;
  causal: string;
  total: number;
  residualTotal: number;
  methodPayment: string;
  vatPercentage: number;
  vatAmount: number;
  net: number;
  memberDisplayName: string;
  originalMemberName: string;
  memberAlias: string;
  memberNameEditable: boolean;
  formCausal: string;
  counterKey: 'taxReceipt' | 'invoice' | 'simpleReceipt';
};

type Props = {
  open: boolean;
  memberName: string;
  defaultCausal?: string;
  initial?: Partial<TaxDocumentFormValues>;
  defaultTotal?: number;
  defaultResidual?: number;
  hideMemberName?: boolean;
  /** Override primary save button label (default: SAVE RECEIPT AT THE END). */
  saveLabel?: string;
  onClose: () => void;
  onSave: (values: TaxDocumentFormValues) => void | Promise<void>;
};

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function applyVatToForm(
  form: TaxDocumentFormValues,
  total: number,
  vatPercentage: number
): TaxDocumentFormValues {
  const { vatAmount, net } = computeVatBreakdown(total, vatPercentage);
  return { ...form, total, vatPercentage, vatAmount, net };
}

function buildFormState(
  settings: TaxDocumentClubSettings,
  defaults: TaxDocumentDefaults,
  memberName: string,
  defaultCausal: string,
  defaultTotal: number,
  defaultResidual: number,
  initial?: Partial<TaxDocumentFormValues>,
  hideMemberName?: boolean
): TaxDocumentFormValues {
  const documentType = initial?.documentType ?? defaults.documentType;
  const counterValue = counterValueForDocumentType(settings, documentType);
  const documentNumber = initial?.documentNumber ?? nextDocumentNumber(counterValue);
  const vatPercentage = defaults.vatPercentage;
  const total = initial?.total ?? defaultTotal;
  const base: TaxDocumentFormValues = {
    documentType,
    heading: initial?.heading ?? defaults.heading,
    documentDate: initial?.documentDate ?? todayDate(),
    documentNumber,
    causal: initial?.causal ?? defaultCausal,
    total,
    residualTotal: initial?.residualTotal ?? defaultResidual,
    methodPayment: initial?.methodPayment ?? 'D',
    vatPercentage,
    vatAmount: 0,
    net: total,
    memberDisplayName: hideMemberName ? '' : (initial?.memberDisplayName ?? memberName),
    originalMemberName: hideMemberName ? '' : (initial?.originalMemberName ?? memberName),
    memberAlias: hideMemberName ? '' : (initial?.memberAlias ?? memberName),
    memberNameEditable: hideMemberName ? false : (initial?.memberNameEditable ?? false),
    formCausal: initial?.formCausal ?? defaultCausal,
    counterKey: initial?.counterKey ?? defaults.counterKey,
  };

  if (initial?.memberDisplayName?.includes('\\')) {
    const [original, alias] = initial.memberDisplayName.split('\\');
    base.originalMemberName = original || memberName;
    base.memberAlias = alias || memberName;
    base.memberNameEditable = true;
  }

  return applyVatToForm(base, total, vatPercentage);
}

export default function TaxDocumentModal({
  open,
  memberName,
  defaultCausal = '',
  initial,
  defaultTotal = 0,
  defaultResidual = 0,
  hideMemberName = false,
  saveLabel = 'SAVE RECEIPT AT THE END',
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState<TaxDocumentFormValues | null>(null);
  const [settings, setSettings] = useState<TaxDocumentClubSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError('');

    clubApiFetch<{ settings: TaxDocumentClubSettings; defaults: TaxDocumentDefaults }>(
      '/api/club/procedures/tax-document-defaults'
    )
      .then((data) => {
        if (cancelled) return;
        setSettings(data.settings);
        setForm(
          buildFormState(
            data.settings,
            data.defaults,
            memberName,
            defaultCausal,
            defaultTotal,
            defaultResidual,
            initial,
            hideMemberName
          )
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load document settings');
        const fallbackSettings: TaxDocumentClubSettings = {
          documentType: 'Tax receipt',
          enableHeader: 'primary',
          primaryHeading: '',
          secondaryHeading: '',
          tax: '',
          calTaxStatus: false,
          taxReceipt: '',
          invoice: '',
          simpleReceipt: '',
        };
        const fallbackDefaults = buildTaxDocumentDefaults(fallbackSettings);
        setSettings(fallbackSettings);
        setForm(
          buildFormState(
            fallbackSettings,
            fallbackDefaults,
            memberName,
            defaultCausal,
            defaultTotal,
            defaultResidual,
            initial,
            hideMemberName
          )
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Snapshot parent props when the modal opens; avoid resetting while the user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function updateForm(next: TaxDocumentFormValues) {
    setForm(next);
  }

  function handleDocumentTypeChange(documentType: string) {
    if (!form || !settings) return;
    const defaults = buildTaxDocumentDefaults(settings, documentType);
    const next = applyVatToForm(
      {
        ...form,
        documentType,
        heading: defaults.heading,
        documentNumber: defaults.documentNumber,
        counterKey: defaults.counterKey,
      },
      form.total,
      defaults.vatPercentage
    );
    updateForm(next);
  }

  function handleTotalChange(total: number) {
    if (!form) return;
    updateForm(applyVatToForm(form, total, form.vatPercentage));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    setSaving(true);
    setError('');
    try {
      const memberDisplayName = hideMemberName
        ? ''
        : form.memberNameEditable
          ? buildMemberDisplayName(form.originalMemberName, form.memberAlias)
          : form.originalMemberName;

      // Payment flow: parent remembers until Confirm. Archive edit: parent persists via updateReceipt.
      const payload: TaxDocumentFormValues = {
        ...form,
        memberDisplayName,
        formCausal: defaultCausal,
      };
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prepare receipt');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl border border-gray-200">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-lg font-semibold text-gray-800">Tax document</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {loading || !form ? (
          <div className="p-6 text-sm text-gray-600">Loading document settings...</div>
        ) : (
          <form onSubmit={handleSave} className="p-4 space-y-3 max-h-[80vh] overflow-y-auto">
            {!hideMemberName && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                <span className="text-sm text-gray-600 md:text-right">Member</span>
                <div className="md:col-span-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.memberNameEditable}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        updateForm({
                          ...form,
                          memberNameEditable: checked,
                          memberAlias: checked ? form.memberAlias || form.originalMemberName : form.originalMemberName,
                        });
                      }}
                    />
                    <span className="text-xs text-gray-500">Allow editing member name for receipt</span>
                  </div>
                  <input
                    type="text"
                    readOnly={!form.memberNameEditable}
                    className={form.memberNameEditable ? procedureInputClass : procedureReadonlyInputClass}
                    value={form.memberNameEditable ? form.memberAlias : form.originalMemberName}
                    onChange={(e) => updateForm({ ...form, memberAlias: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
              <span className="text-sm text-gray-600 md:text-right">Document type</span>
              <div className="md:col-span-3">
                <select
                  className={procedureInputClass}
                  value={form.documentType}
                  onChange={(e) => handleDocumentTypeChange(e.target.value)}
                >
                  {TAX_DOCUMENT_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
              <span className="text-sm text-gray-600 md:text-right">Heading</span>
              <div className="md:col-span-3">
                <input
                  type="text"
                  className={procedureInputClass}
                  value={form.heading}
                  onChange={(e) => updateForm({ ...form, heading: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm text-gray-600">Date</span>
                <input
                  type="date"
                  className={`mt-1 ${procedureInputClass}`}
                  value={form.documentDate}
                  onChange={(e) => updateForm({ ...form, documentDate: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">Number</span>
                <input
                  type="text"
                  className={`mt-1 ${procedureHighlightInputClass}`}
                  value={form.documentNumber}
                  onChange={(e) => updateForm({ ...form, documentNumber: e.target.value })}
                />
                <p className="text-xs text-amber-600 mt-1">
                  WARNING: This number is only reserved when you Confirm the payment. Until then the
                  receipt is not saved and the counter is not updated.
                </p>
              </label>
            </div>

            <label className="block">
              <span className="text-sm text-gray-600">Causal</span>
              <textarea
                className={`mt-1 ${procedureInputClass}`}
                rows={2}
                value={form.causal}
                onChange={(e) => updateForm({ ...form, causal: e.target.value })}
              />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-sm text-gray-600">Total (€)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`mt-1 ${procedureHighlightInputClass}`}
                  value={form.total}
                  onChange={(e) => handleTotalChange(Number(e.target.value) || 0)}
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">Residual total (€)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`mt-1 ${procedureHighlightInputClass}`}
                  value={form.residualTotal}
                  onChange={(e) => updateForm({ ...form, residualTotal: Number(e.target.value) || 0 })}
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">Method payment</span>
                <select
                  className={`mt-1 ${procedureInputClass}`}
                  value={form.methodPayment}
                  onChange={(e) => updateForm({ ...form, methodPayment: e.target.value })}
                >
                  <option value="D">Down payment</option>
                  <option value="B">Balance</option>
                </select>
              </label>
            </div>

            {settings?.calTaxStatus && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-sm text-gray-600">VAT %</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    readOnly
                    className={`mt-1 ${procedureReadonlyInputClass}`}
                    value={form.vatPercentage}
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">VAT amount (€)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    readOnly
                    className={`mt-1 ${procedureReadonlyInputClass}`}
                    value={form.vatAmount}
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">Net (€)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    readOnly
                    className={`mt-1 ${procedureReadonlyInputClass}`}
                    value={form.net}
                  />
                </label>
              </div>
            )}

            {error && (
              <div className="text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-red-700 text-white rounded hover:bg-red-800 text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : saveLabel}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
