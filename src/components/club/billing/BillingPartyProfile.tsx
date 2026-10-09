'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import PromocodeConfirmModal from '@/components/promocodes/PromocodeConfirmModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { translateSportLabel } from '@/lib/sport/sportI18n';
import {
  formatEuro,
  formatYmd,
  type BillingCreditNote,
  type BillingInvoice,
  type BillingParty,
} from '@/lib/club/clubBilling.constants';
import BillingPartyForm from '@/components/club/billing/BillingPartyForm';

export default function BillingPartyProfile({ partyId }: { partyId: string }) {
  const [party, setParty] = useState<BillingParty | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [creditNotes, setCreditNotes] = useState<BillingCreditNote[]>([]);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    let cancelled = false;
    void clubApiFetch<{ party: BillingParty; invoices: BillingInvoice[]; creditNotes: BillingCreditNote[] }>(
      `/api/club/billing/parties/${encodeURIComponent(partyId)}?docs=1`,
    )
      .then((data) => {
        if (cancelled) return;
        setParty(data.party);
        setInvoices(data.invoices);
        setCreditNotes(data.creditNotes);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      });
    return () => {
      cancelled = true;
    };
  }, [partyId]);

  const docs = [
    ...invoices.map((i) => ({
      id: i.id,
      kind: i.direction === 'outgoing' ? 'outgoing' : 'incoming',
      number: i.documentNumber,
      date: i.invoiceDate,
      net: i.netAmount,
      href: `/club/billing/invoices/${i.id}`,
    })),
    ...creditNotes.map((c) => ({
      id: c.id,
      kind: c.direction === 'outgoing' ? 'credit-outgoing' : 'credit-incoming',
      number: c.documentNumber,
      date: c.creditNoteDate,
      net: c.netAmount,
      href: `/club/billing/credit-notes/${c.id}`,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const isSupplier = party?.kind === 'supplier' || party?.kind === 'both';
  const q = `partyId=${encodeURIComponent(partyId)}`;
  const actions = [
    { label: 'Create issued invoice', href: `/club/billing/invoices/new?type=outgoing&${q}` },
    ...(isSupplier
      ? [
          { label: 'Register received invoice', href: `/club/billing/invoices/new?type=incoming&${q}` },
          { label: 'Register received credit note', href: `/club/billing/credit-notes/new?type=incoming&${q}` },
        ]
      : []),
    { label: 'Create issued credit note', href: `/club/billing/credit-notes/new?type=outgoing&${q}` },
  ];

  const confirmDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await clubApiFetch(`/api/club/billing/parties/${encodeURIComponent(partyId)}`, { method: 'DELETE' });
      router.push('/club/billing/parties');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const actionsMenu = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md border border-violet-600 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"
      >
        <MoreHorizontal className="h-4 w-4" />
        Actions
      </button>
      {menuOpen ? (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className="block px-3 py-2 text-sm text-gray-800 hover:bg-gray-50">
              {a.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setConfirmOpen(true);
            }}
            className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4">
      {error ? <p className="mx-4 mt-4 text-sm text-red-600">{error}</p> : null}
      <BillingPartyForm partyId={partyId} headerActions={actionsMenu} />
      <PromocodeConfirmModal
        open={confirmOpen}
        title={translateSportLabel(t, 'Delete customer/supplier')}
        message={translateSportLabel(t, 'Delete this customer/supplier?')}
        confirmLabel={translateSportLabel(t, 'Delete')}
        cancelLabel={translateSportLabel(t, 'Cancel')}
        destructive
        loading={deleting}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void confirmDelete()}
      />
      <div className="mx-auto max-w-4xl px-4 pb-8">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-gray-900">Invoices</h2>
          <div className="mb-3 flex flex-wrap gap-3 text-xs text-gray-700">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Issued invoices
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Received invoices
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" /> Issued credit notes
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-pink-400" /> Received credit notes
            </span>
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="py-2 pr-3">Number</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2">Net amount</th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-gray-500">
                    No invoices for {party?.name || 'this party'} yet.
                  </td>
                </tr>
              ) : (
                docs.map((d) => (
                  <tr key={d.kind + d.id} className="border-t border-gray-100">
                    <td className="py-2 pr-3">
                      <Link href={d.href} className="inline-flex items-center gap-2 text-violet-800 hover:underline">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            d.kind === 'outgoing'
                              ? 'bg-emerald-500'
                              : d.kind === 'incoming'
                                ? 'bg-red-500'
                                : d.kind === 'credit-outgoing'
                                  ? 'bg-emerald-300'
                                  : 'bg-pink-400'
                          }`}
                        />
                        <span translate="no">{d.number || '—'}</span>
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{formatYmd(d.date)}</td>
                    <td className="py-2" translate="no">
                      {formatEuro(d.net)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
