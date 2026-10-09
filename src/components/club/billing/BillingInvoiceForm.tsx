'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import {
  BILLING_INVOICE_DIRECTIONS,
  BILLING_PAYMENT_METHODS,
  BILLING_VAT_RATES,
  EMPTY_INCOMING_INVOICE,
  EMPTY_OUTGOING_INVOICE,
  calcInvoiceTotal,
  formatEuro,
  type BillingInvoice,
  type BillingInvoiceDirection,
  type BillingInvoiceInput,
  type BillingMemberCandidate,
  type BillingParty,
} from '@/lib/club/clubBilling.constants';
import { Field, SectionCard, inputClass } from '@/components/club/billing/BillingFormBits';

type Props = {
  invoiceId?: string;
  direction?: BillingInvoiceDirection;
  initialPartyId?: string;
};

export default function BillingInvoiceForm({ invoiceId, direction = 'outgoing', initialPartyId = '' }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<BillingInvoiceInput>(
    direction === 'outgoing'
      ? { ...EMPTY_OUTGOING_INVOICE, partyId: initialPartyId }
      : { ...EMPTY_INCOMING_INVOICE, partyId: initialPartyId },
  );
  const outgoing = value.direction === 'outgoing';
  const [parties, setParties] = useState<BillingParty[]>([]);
  const [members, setMembers] = useState<BillingMemberCandidate[]>([]);
  const [recipient, setRecipient] = useState<'party' | 'member'>('party');
  const [memberId, setMemberId] = useState('');
  const [loading, setLoading] = useState(Boolean(invoiceId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void clubApiFetch<{ items: BillingParty[] }>('/api/club/billing/parties?kind=all').then((data) =>
      setParties(data.items),
    );
    void clubApiFetch<{ items: BillingMemberCandidate[] }>('/api/club/billing/members')
      .then((data) => setMembers(data.items))
      .catch(() => setMembers([]));
  }, []);

  const pickMember = async (userId: string) => {
    setMemberId(userId);
    setError('');
    if (!userId) {
      setValue((v) => ({ ...v, partyId: '' }));
      return;
    }
    try {
      const { party } = await clubApiFetch<{ party: BillingParty }>('/api/club/billing/members', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      setParties((list) => (list.some((p) => p.id === party.id) ? list : [...list, party]));
      setMembers((list) => list.map((m) => (m.userId === userId ? { ...m, partyId: party.id } : m)));
      setValue((v) => ({ ...v, partyId: party.id }));
    } catch (e) {
      setValue((v) => ({ ...v, partyId: '' }));
      setError(e instanceof Error ? e.message : 'Failed to select the member');
    }
  };

  useEffect(() => {
    if (!invoiceId) {
      if (direction !== 'outgoing') return;
      void clubApiFetch<{ number: string }>(
        `/api/club/billing/invoices?nextNumber=1&direction=${encodeURIComponent(direction)}`,
      ).then((data) => setValue((v) => ({ ...v, documentNumber: data.number, direction })));
      return;
    }
    let cancelled = false;
    void clubApiFetch<{ invoice: BillingInvoice }>(`/api/club/billing/invoices/${encodeURIComponent(invoiceId)}`)
      .then((data) => {
        if (cancelled) return;
        const i = data.invoice;
        setValue({
          direction: i.direction,
          partyId: i.partyId,
          documentNumber: i.documentNumber,
          invoiceDate: i.invoiceDate,
          paymentDueDate: i.paymentDueDate,
          paymentMethod: i.paymentMethod,
          productName: i.productName,
          description: i.description,
          netAmount: String(i.netAmount),
          vatRate: i.vatRate,
          vatExempt: i.vatExempt,
          budgetCategory: i.budgetCategory,
          forPublicAdmin: i.forPublicAdmin,
          paid: i.paid,
          paidOn: i.paidOn,
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
  }, [direction, invoiceId]);

  const partyOptions = useMemo(() => {
    // Both create flows include Suppliers; outgoing also includes customers.
    if (value.direction === 'incoming') {
      return parties.filter((p) => p.kind === 'supplier' || p.kind === 'both');
    }
    return parties.filter((p) => p.kind === 'customer' || p.kind === 'supplier' || p.kind === 'both');
  }, [parties, value.direction]);

  const net = Number(String(value.netAmount).replace(',', '.')) || 0;
  const rate = value.vatExempt ? 0 : Number(value.vatRate) || 0;
  const total = Number.isFinite(net) ? calcInvoiceTotal(net, rate, value.vatExempt) : NaN;

  const patch = (partial: Partial<BillingInvoiceInput>) => setValue((v) => ({ ...v, ...partial }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const body = JSON.stringify(value);
      if (invoiceId) {
        await clubApiFetch(`/api/club/billing/invoices/${encodeURIComponent(invoiceId)}`, {
          method: 'PATCH',
          body,
        });
      } else {
        await clubApiFetch('/api/club/billing/invoices', { method: 'POST', body });
      }
      router.push(
        initialPartyId
          ? `/club/billing/parties/${encodeURIComponent(initialPartyId)}`
          : `/club/billing/invoices?type=${value.direction}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const title = outgoing ? 'Create issued invoice' : 'Create received invoice';

  return (
    <div className="min-h-full bg-gray-50 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{invoiceId ? 'Edit invoice' : title}</h1>
          <p className="text-xs text-gray-500">
            <span>Billing</span> &gt; <span>Invoices</span> &gt; <span>{outgoing ? 'Edit issued invoice' : 'Edit received invoice'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={initialPartyId ? `/club/billing/parties/${encodeURIComponent(initialPartyId)}` : '/club/billing/invoices'}
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
          {!invoiceId ? (
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
                    router.replace(`/club/billing/invoices/new?${qs}`);
                  }}
                  className={`rounded-md border px-4 py-1.5 text-sm font-semibold ${
                    d.value === value.direction
                      ? 'border-violet-700 bg-violet-700 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {d.value === 'outgoing' ? 'Issued invoice' : 'Received invoice'}
                </button>
              ))}
            </div>
          ) : null}
          <SectionCard title={outgoing ? 'Recipient' : 'Information'}>
            {outgoing && !invoiceId ? (
              <div className="flex flex-wrap gap-4 text-sm text-gray-800">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="recipient"
                    checked={recipient === 'party'}
                    onChange={() => setRecipient('party')}
                  />
                  Customer / supplier (external user)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="recipient"
                    checked={recipient === 'member'}
                    onChange={() => {
                      setRecipient('member');
                      void pickMember(memberId);
                    }}
                  />
                  Member
                </label>
              </div>
            ) : null}
            {outgoing && recipient === 'member' && !invoiceId ? (
              <Field label="Select member * (only those with Fiscal code linked)">
                <select value={memberId} onChange={(e) => void pickMember(e.target.value)} className={inputClass}>
                  <option value="">Select a member</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId} disabled={!m.fiscalCode}>
                      {m.name}
                      {m.fiscalCode ? ` (${m.fiscalCode})` : ' (no fiscal code)'}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field
                label={
                  outgoing
                    ? 'Select customer * (only those with VAT number or Fiscal code linked)'
                    : 'Select supplier * (only those with VAT number or Fiscal code linked)'
                }
              >
                <select value={value.partyId} onChange={(e) => patch({ partyId: e.target.value })} className={inputClass}>
                  <option value="">{outgoing ? 'Select a customer' : 'Select a supplier'}</option>
                  {partyOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.kind === 'supplier' || p.kind === 'both' ? ' (Supplier)' : ' (Customer)'}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <p className="text-sm">
              <Link
                href={`/club/billing/parties/new?kind=${outgoing ? 'customer' : 'supplier'}`}
                className="text-blue-700 hover:underline"
              >
                {outgoing ? 'New customer? Click here to create it' : 'New supplier? Click here to create it'}
              </Link>
            </p>
            <Field
              label={
                outgoing
                  ? 'Select budget category (if not selected, it will be assigned by default to the "sponsor" category)'
                  : 'Select budget category (if not selected, it will be assigned by default to the "customers/suppliers" category)'
              }
            >
              <input
                value={value.budgetCategory}
                onChange={(e) => patch({ budgetCategory: e.target.value })}
                className={inputClass}
                placeholder={outgoing ? 'sponsor' : 'customers/suppliers'}
              />
            </Field>
          </SectionCard>

          <SectionCard title="Invoice data">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Invoice number" required={outgoing}>
                <input
                  value={value.documentNumber}
                  onChange={(e) => patch({ documentNumber: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Date" required>
                <input
                  type="date"
                  value={value.invoiceDate}
                  onChange={(e) => patch({ invoiceDate: e.target.value })}
                  className={inputClass}
                />
              </Field>
              {outgoing ? (
                <Field label="Payment deadline" required>
                  <input
                    type="date"
                    value={value.paymentDueDate}
                    onChange={(e) => patch({ paymentDueDate: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              ) : (
                <Field label="Payment method" required>
                  <select
                    value={value.paymentMethod}
                    onChange={(e) => patch({ paymentMethod: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Select</option>
                    {BILLING_PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
            {outgoing ? (
              <Field label="Payment method" required>
                <select
                  value={value.paymentMethod}
                  onChange={(e) => patch({ paymentMethod: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select</option>
                  {BILLING_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Field label="Product name" required>
              <input value={value.productName} onChange={(e) => patch({ productName: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Description" required>
              <textarea
                rows={4}
                value={value.description}
                onChange={(e) => patch({ description: e.target.value })}
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Net price in €" required>
                <input
                  type="number"
                  step="0.01"
                  value={value.netAmount}
                  onChange={(e) => patch({ netAmount: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Applied rate" required>
                <select
                  value={value.vatExempt ? '' : String(value.vatRate)}
                  disabled={value.vatExempt}
                  onChange={(e) => patch({ vatRate: Number(e.target.value) })}
                  className={inputClass}
                >
                  <option value="">Select rate</option>
                  {BILLING_VAT_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {outgoing ? (
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={value.vatExempt}
                  onChange={(e) => patch({ vatExempt: e.target.checked })}
                />
                VAT exempt invoice
              </label>
            ) : null}
            <div className="flex justify-end text-sm">
              <span className="mr-2 font-medium text-gray-700">Total on invoice:</span>
              <span className="font-semibold text-violet-800" translate="no">
                {Number.isFinite(total) ? formatEuro(total) : 'Invalid value'}
              </span>
            </div>
          </SectionCard>

          {outgoing ? (
            <SectionCard title="For public administration">
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={value.forPublicAdmin}
                  onChange={(e) => patch({ forPublicAdmin: e.target.checked })}
                />
                Invoice for public administration
              </label>
            </SectionCard>
          ) : null}

          <SectionCard title="Payment status">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input type="checkbox" checked={value.paid} onChange={(e) => patch({ paid: e.target.checked })} />
                Paid
              </label>
              <Field label="Balance date">
                <input type="date" value={value.paidOn} onChange={(e) => patch({ paidOn: e.target.value })} className={inputClass} />
              </Field>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
