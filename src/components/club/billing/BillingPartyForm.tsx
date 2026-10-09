'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import {
  BILLING_PARTY_KINDS,
  BILLING_PARTY_TYPES,
  EMPTY_BILLING_PARTY,
  type BillingParty,
  type BillingPartyInput,
} from '@/lib/club/clubBilling.constants';
import { Field, SectionCard, inputClass } from '@/components/club/billing/BillingFormBits';

type Props = {
  partyId?: string;
  defaultKind?: BillingPartyInput['kind'];
  headerActions?: ReactNode;
};

export default function BillingPartyForm({ partyId, defaultKind = 'supplier', headerActions }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<BillingPartyInput>({ ...EMPTY_BILLING_PARTY, kind: defaultKind });
  const [loading, setLoading] = useState(Boolean(partyId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!partyId) return;
    let cancelled = false;
    void clubApiFetch<{ party: BillingParty }>(`/api/club/billing/parties/${encodeURIComponent(partyId)}`)
      .then((data) => {
        if (cancelled) return;
        const p = data.party;
        setValue({
          kind: p.kind,
          name: p.name,
          partyType: p.partyType,
          vatNumber: p.vatNumber,
          fiscalCode: p.fiscalCode,
          address: p.address,
          city: p.city,
          zip: p.zip,
          province: p.province,
          contactPerson: p.contactPerson,
          email: p.email,
          pec: p.pec,
          phone: p.phone,
          sdiCode: p.sdiCode,
          notes: p.notes,
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
  }, [partyId]);

  const patch = (partial: Partial<BillingPartyInput>) => setValue((v) => ({ ...v, ...partial }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const body = JSON.stringify(value);
      if (partyId) {
        await clubApiFetch(`/api/club/billing/parties/${encodeURIComponent(partyId)}`, {
          method: 'PATCH',
          body,
        });
        router.push(`/club/billing/parties/${encodeURIComponent(partyId)}`);
      } else {
        const created = await clubApiFetch<{ party: BillingParty }>('/api/club/billing/parties', {
          method: 'POST',
          body,
        });
        router.push(`/club/billing/parties/${encodeURIComponent(created.party.id)}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const title = partyId ? value.name || 'Customer / supplier' : 'Add customer/supplier';

  return (
    <div className="min-h-full bg-gray-50 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          <p className="text-xs text-gray-500">
            <Link href="/club/billing/parties" className="hover:underline">
              Accounting
            </Link>
            {' > '}
            <Link href="/club/billing/parties" className="hover:underline">
              Customers / suppliers
            </Link>
            {' > '}
            {partyId ? value.name || 'Edit' : 'Create'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/club/billing/parties"
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
          {headerActions}
        </div>
      </div>
      {error ? <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="mx-auto max-w-4xl space-y-4">
          <SectionCard title="Main data">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Company name or name" required>
                <input value={value.name} onChange={(e) => patch({ name: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Type (company, private, etc.)">
                <select value={value.partyType} onChange={(e) => patch({ partyType: e.target.value })} className={inputClass}>
                  <option value="">Select</option>
                  {BILLING_PARTY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Role">
                <select
                  value={value.kind}
                  onChange={(e) => patch({ kind: e.target.value as BillingPartyInput['kind'] })}
                  className={inputClass}
                >
                  {BILLING_PARTY_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="VAT number">
                <input value={value.vatNumber} onChange={(e) => patch({ vatNumber: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Fiscal code">
                <input value={value.fiscalCode} onChange={(e) => patch({ fiscalCode: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Address">
                <input value={value.address} onChange={(e) => patch({ address: e.target.value })} className={inputClass} />
              </Field>
              <Field label="City">
                <input value={value.city} onChange={(e) => patch({ city: e.target.value })} className={inputClass} />
              </Field>
              <Field label="ZIP code">
                <input value={value.zip} onChange={(e) => patch({ zip: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Province">
                <input value={value.province} onChange={(e) => patch({ province: e.target.value })} className={inputClass} />
              </Field>
            </div>
          </SectionCard>
          <SectionCard title="Contacts">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Contact person">
                <input
                  value={value.contactPerson}
                  onChange={(e) => patch({ contactPerson: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Email address">
                <input value={value.email} onChange={(e) => patch({ email: e.target.value })} className={inputClass} />
              </Field>
              <Field label="PEC address">
                <input value={value.pec} onChange={(e) => patch({ pec: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Phone">
                <input value={value.phone} onChange={(e) => patch({ phone: e.target.value })} className={inputClass} />
              </Field>
              <Field
                label="SDI code"
                className="md:col-span-2"
                hint="(6 characters for Public Administration, 7 for companies and VAT holders). Mandatory for sending electronic invoices to the Public Administration."
              >
                <input value={value.sdiCode} onChange={(e) => patch({ sdiCode: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Notes" className="md:col-span-2">
                <textarea value={value.notes} rows={4} onChange={(e) => patch({ notes: e.target.value })} className={inputClass} />
              </Field>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
