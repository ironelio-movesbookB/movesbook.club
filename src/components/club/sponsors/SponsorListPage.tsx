'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PublicLinkBanner from '@/components/club/sponsors/PublicLinkBanner';
import {
  ContractStatusBadge,
  PaymentsStatusBadge,
  formatYmd,
  inputClass,
  primaryButton,
  secondaryButton,
} from '@/components/club/sponsors/sponsorUi';
import {
  CONTRACT_STATUS_LABELS,
  PAYMENTS_STATUS_LABELS,
  SPONSOR_EXPIRING_DAYS,
  SPONSOR_SECTIONS,
  formatSponsorEuro,
  type SponsorContractStatus,
  type SponsorListItem,
  type SponsorListSummary,
  type SponsorPaymentsStatus,
} from '@/lib/club/sponsors/sponsorConstants';
import { sponsorApi, sponsorKitPath, sponsorWorkspaceId } from '@/lib/club/sponsors/sponsorClient';

const SECTION_LABEL = new Map<string, string>(SPONSOR_SECTIONS.map((s) => [s.key, s.label]));

export default function SponsorListPage() {
  const [items, setItems] = useState<SponsorListItem[]>([]);
  const [summary, setSummary] = useState<SponsorListSummary>({ contractsValue: 0, collected: 0, expiringSoon: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');

  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'visible' | 'hidden'>('all');
  const [contract, setContract] = useState<'all' | SponsorContractStatus>('all');
  const [payments, setPayments] = useState<'all' | SponsorPaymentsStatus>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await sponsorApi<{ items: SponsorListItem[]; summary: SponsorListSummary }>('');
      setItems(data.items);
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the sponsors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setWorkspaceId(sponsorWorkspaceId());
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((s) => {
      if (q && !`${s.name} ${s.businessName}`.toLowerCase().includes(q)) return false;
      if (visibility === 'visible' && !s.visible) return false;
      if (visibility === 'hidden' && s.visible) return false;
      if (contract !== 'all' && s.contractStatus !== contract) return false;
      if (payments !== 'all' && s.paymentsStatus !== payments) return false;
      return true;
    });
  }, [items, search, visibility, contract, payments]);

  const filtersActive = search || visibility !== 'all' || contract !== 'all' || payments !== 'all';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sponsors</h1>
          <p className="text-sm text-gray-600">
            Sponsors are shown in your club presentation and in the sections you choose for each of them.
          </p>
        </div>
        <Link href="/clubs/marketing/sponsors/new" className={primaryButton}>
          + New sponsor
        </Link>
      </div>

      {workspaceId ? (
        <PublicLinkBanner
          title="Sponsorship kit"
          description="Send this page to potential sponsors: it shows your community, your results and what a sponsor gets."
          path={sponsorKitPath(workspaceId)}
          qrFileName="sponsorship-kit-qr"
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Contracts value" value={formatSponsorEuro(summary.contractsValue)} />
        <StatCard label="Collected" value={formatSponsorEuro(summary.collected)} tone="text-green-700" />
        <StatCard
          label={`Expiring within ${SPONSOR_EXPIRING_DAYS} days`}
          value={String(summary.expiringSoon)}
          tone={summary.expiringSoon > 0 ? 'text-amber-600' : undefined}
        />
      </div>

      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input
          className={inputClass}
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={inputClass} value={visibility} onChange={(e) => setVisibility(e.target.value as never)}>
          <option value="all">Visibility: all</option>
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
        </select>
        <select className={inputClass} value={contract} onChange={(e) => setContract(e.target.value as never)}>
          <option value="all">Contract: all</option>
          {(Object.keys(CONTRACT_STATUS_LABELS) as SponsorContractStatus[]).map((k) => (
            <option key={k} value={k}>
              {CONTRACT_STATUS_LABELS[k]}
            </option>
          ))}
        </select>
        <select className={inputClass} value={payments} onChange={(e) => setPayments(e.target.value as never)}>
          <option value="all">Payments: all</option>
          {(Object.keys(PAYMENTS_STATUS_LABELS) as SponsorPaymentsStatus[]).map((k) => (
            <option key={k} value={k}>
              {PAYMENTS_STATUS_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-4 py-3">Sponsor</th>
              <th className="px-4 py-3">Contract</th>
              <th className="px-4 py-3">Active sections</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  {filtersActive ? 'No sponsor matches the filters.' : 'No sponsors yet. Add the first one.'}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="align-top hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {s.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.logoUrl} alt="" className="h-10 w-10 rounded border border-gray-200 object-contain" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100 text-sm font-bold text-gray-500">
                          {s.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900">{s.name}</div>
                        {s.businessName ? <div className="text-xs text-gray-500">{s.businessName}</div> : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {s.currentContract ? (
                      <>
                        <div>
                          {formatYmd(s.currentContract.startDate)} – {formatYmd(s.currentContract.endDate)}
                        </div>
                        <div className="text-xs text-gray-500">{formatSponsorEuro(s.currentContract.value)}</div>
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.activeSections.length === 0 ? (
                      <span className="text-gray-400">None</span>
                    ) : (
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {s.activeSections.map((k) => (
                          <span key={k} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-700">
                            {SECTION_LABEL.get(k) ?? k}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="space-y-1 px-4 py-3">
                    <div>
                      <ContractStatusBadge status={s.contractStatus} />
                    </div>
                    <div>
                      <PaymentsStatusBadge status={s.paymentsStatus} />
                    </div>
                    {!s.visible ? <div className="text-xs font-semibold text-gray-500">Hidden</div> : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/clubs/marketing/sponsors/${s.id}`} className={secondaryButton}>
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone ?? 'text-gray-900'}`}>{value}</div>
    </div>
  );
}
