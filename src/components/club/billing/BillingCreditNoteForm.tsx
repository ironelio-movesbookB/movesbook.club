'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import {
  BILLING_INVOICE_DIRECTIONS,
  BILLING_REIMBURSEMENT_MODES,
  BILLING_VAT_RATES,
  EMPTY_CREDIT_NOTE,
  calcInvoiceTotal,
  calcVatAmount,
  formatEuro,
  formatYmd,
  type BillingCreditNote,
  type BillingCreditNoteInput,
  type BillingInvoice,
  type BillingInvoiceDirection,
  type BillingParty,
} from '@/lib/club/clubBilling.constants';
import { Field, SectionCard, inputClass } from '@/components/club/billing/BillingFormBits';

export default function BillingCreditNoteForm({
  creditNoteId,
  initialPartyId = '',
  initialDirection = 'incoming',
}: {
  creditNoteId?: string;
  initialPartyId?: string;
  initialDirection?: BillingInvoiceDirection;
}) {
  const router = useRouter();
  const [value, setValue] = useState<BillingCreditNoteInput>({
    ...EMPTY_CREDIT_NOTE,
    direction: initialDirection,
    partyId: initialPartyId,
    reimbursementMode: initialDirection === 'outgoing' ? 'Customer credit' : 'Supplier credit',
  });
  const [parties, setParties] = useState<BillingParty[]>([]);
  const [partyInvoices, setPartyInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(Boolean(creditNoteId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const incoming = value.direction === 'incoming';

  useEffect(() => {
    void clubApiFetch<{ items: BillingParty[] }>('/api/club/billing/parties?kind=all').then((data) =>
      setParties(data.items),
    );
  }, []);

  useEffect(() => {
    if (!value.partyId) {
      setPartyInvoices([]);
      return;
    }
    let cancelled = false;
    void clubApiFetch<{ invoices: BillingInvoice[] }>(
      `/api/club/billing/parties/${encodeURIComponent(value.partyId)}?docs=1`,
    )
      .then((data) => {
        if (!cancelled) setPartyInvoices(data.invoices.filter((i) => i.direction === value.direction));
      })
      .catch(() => {
        if (!cancelled) setPartyInvoices([]);
      });
    return () => {
      cancelled = true;
    };
  }, [value.direction, value.partyId]);

  const pickInvoiceReference = (reference: string) => {
    const match = partyInvoices.find((i) => i.documentNumber && i.documentNumber === reference.trim());
    setValue((v) => ({ ...v, invoiceReference: reference, ...(match ? { invoiceDate: match.invoiceDate } : {}) }));
  };

  useEffect(() => {
    if (!creditNoteId) {
      const today = new Date().toISOString().slice(0, 10);
      setValue((v) => ({ ...v, registrationDate: today, creditNoteDate: today }));
      return;
    }
    let cancelled = false;
    void clubApiFetch<{ creditNote: BillingCreditNote }>(
      `/api/club/billing/credit-notes/${encodeURIComponent(creditNoteId)}`,
    )
      .then((data) => {
        if (cancelled) return;
        const c = data.creditNote;
        setValue({
          direction: c.direction,
          partyId: c.partyId,
          registrationDate: c.registrationDate,
          creditNoteDate: c.creditNoteDate,
          documentNumber: c.documentNumber,
          invoiceReference: c.invoiceReference,
          invoiceDate: c.invoiceDate,
          causal: c.causal,
          netAmount: String(c.netAmount),
          vatRate: c.vatRate,
          budgetCategory: c.budgetCategory,
          reimbursementMode: c.reimbursementMode,
        });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [creditNoteId]);

  const suppliers = useMemo(
    () => (incoming ? parties.filter((p) => p.kind === 'supplier' || p.kind === 'both') : parties),
    [incoming, parties],
  );
  const selected = suppliers.find((p) => p.id === value.partyId);
  const net = Number(String(value.netAmount).replace(',', '.')) || 0;
  const rate = Number(value.vatRate) || 0;
  const vatAmount = calcVatAmount(net, rate);
  const total = calcInvoiceTotal(net, rate);

  const patch = (partial: Partial<BillingCreditNoteInput>) => setValue((v) => ({ ...v, ...partial }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const body = JSON.stringify(value);
      if (creditNoteId) {
        await clubApiFetch(`/api/club/billing/credit-notes/${encodeURIComponent(creditNoteId)}`, {
          method: 'PATCH',
          body,
        });
      } else {
        await clubApiFetch('/api/club/billing/credit-notes', { method: 'POST', body });
      }
      router.push(
        initialPartyId
          ? `/club/billing/parties/${encodeURIComponent(initialPartyId)}`
          : `/club/billing/credit-notes?type=${value.direction}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-50 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {creditNoteId ? 'Edit credit note' : 'Create credit note'}
          </h1>
          <p className="text-xs text-gray-500"><span>Billing</span> &gt; <span>Credit notes</span></p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={initialPartyId ? `/club/billing/parties/${encodeURIComponent(initialPartyId)}` : '/club/billing/credit-notes'}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void save()}
            className="rounded-md bg-teal-600 px-8 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {error ? <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="mx-auto max-w-3xl space-y-4">
          {!creditNoteId ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
              <span className="text-sm font-semibold text-gray-900">Type</span>
              {BILLING_INVOICE_DIRECTIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => {
                    if (d.value === value.direction) return;
                    const qs = new URLSearchParams({ type: d.value });
                    if (initialPartyId) qs.set('partyId', initialPartyId);
                    router.replace(`/club/billing/credit-notes/new?${qs}`);
                  }}
                  className={`rounded-md border px-4 py-1.5 text-sm font-semibold ${
                    d.value === value.direction
                      ? 'border-violet-700 bg-violet-700 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {d.value === 'outgoing' ? 'Issued credit note' : 'Received credit note'}
                </button>
              ))}
            </div>
          ) : null}
          <SectionCard title="Credit note">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Date registration" required>
                <input
                  type="date"
                  value={value.registrationDate}
                  onChange={(e) => patch({ registrationDate: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Date note credit" required>
                <input
                  type="date"
                  value={value.creditNoteDate}
                  onChange={(e) => patch({ creditNoteDate: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Document number (NC)" required hint="Example: 12 TD04">
                <input
                  value={value.documentNumber}
                  onChange={(e) => patch({ documentNumber: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label={incoming ? 'Supplier' : 'Customer'} required>
                <select value={value.partyId} onChange={(e) => patch({ partyId: e.target.value })} className={inputClass}>
                  <option value="">{incoming ? 'Select a supplier' : 'Select a customer'}</option>
                  {suppliers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fiscal code">
                <input value={selected?.fiscalCode || selected?.vatNumber || ''} readOnly className={`${inputClass} bg-gray-50`} />
              </Field>
              <Field label="Invoice of reference">
                <input
                  value={value.invoiceReference}
                  onChange={(e) => pickInvoiceReference(e.target.value)}
                  className={inputClass}
                  placeholder="FT 45"
                  list="credit-note-invoice-refs"
                />
                <datalist id="credit-note-invoice-refs">
                  {partyInvoices
                    .filter((i) => i.documentNumber)
                    .map((i) => (
                      <option key={i.id} value={i.documentNumber}>
                        {formatYmd(i.invoiceDate)} · {formatEuro(i.totalAmount)}
                      </option>
                    ))}
                </datalist>
              </Field>
              <Field label="Date invoice">
                <input
                  type="date"
                  value={value.invoiceDate}
                  onChange={(e) => patch({ invoiceDate: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Mode of reimbursement">
                <select
                  value={value.reimbursementMode}
                  onChange={(e) => patch({ reimbursementMode: e.target.value })}
                  className={inputClass}
                >
                  {BILLING_REIMBURSEMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Contability section" className="md:col-span-2">
                <input
                  value={value.budgetCategory}
                  onChange={(e) => patch({ budgetCategory: e.target.value })}
                  className={inputClass}
                  placeholder="Office furniture"
                />
              </Field>
              <Field label="Causal" className="md:col-span-2">
                <textarea
                  rows={3}
                  value={value.causal}
                  onChange={(e) => patch({ causal: e.target.value })}
                  className={inputClass}
                  placeholder="Return 2 defective chairs DDT 8"
                />
              </Field>
              <Field label="Value (detraction)" required>
                <input
                  type="number"
                  step="0.01"
                  value={value.netAmount}
                  onChange={(e) => patch({ netAmount: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Aliquote %" required>
                <select
                  value={String(value.vatRate)}
                  onChange={(e) => patch({ vatRate: Number(e.target.value) })}
                  className={inputClass}
                >
                  {BILLING_VAT_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Value aliquote">
                <input readOnly value={formatEuro(vatAmount)} className={`${inputClass} bg-gray-50`} />
              </Field>
              <Field label="Total">
                <input readOnly value={formatEuro(total)} className={`${inputClass} bg-gray-50 font-semibold`} />
              </Field>
            </div>
            <p className="text-sm">
              <Link
                href={`/club/billing/parties/new?kind=${incoming ? 'supplier' : 'customer'}`}
                className="text-blue-700 hover:underline"
              >
                {incoming ? 'New supplier? Click here to create it' : 'New customer? Click here to create it'}
              </Link>
            </p>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
