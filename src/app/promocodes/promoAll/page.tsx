'use client';

import { useCallback, useEffect, useState } from 'react';
import PromocodesTabs from '@/components/promocodes/PromocodesTabs';
import PromocodesPagination, {
  PromocodeAppliesTable,
} from '@/components/promocodes/PromocodeAppliesTable';
import PromocodePageSizeSelect from '@/components/promocodes/PromocodePageSizeSelect';
import { promocodesFetch, usePromocodesAdminAuth } from '@/components/promocodes/usePromocodesAdminAuth';
import type { PaginatedResult, PromocodeApplyRow } from '@/lib/promocodes/types';

export default function PromocodesPromoAllPage() {
  const ready = usePromocodesAdminAuth();
  const [data, setData] = useState<PaginatedResult<PromocodeApplyRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [orderBy, setOrderBy] = useState('created_desc');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [senderUsername, setSenderUsername] = useState('');
  const [secondaryUsername, setSecondaryUsername] = useState('');
  const [recipientUsername, setRecipientUsername] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search.trim()) params.set('search', search.trim());
      if (orderBy) params.set('orderBy', orderBy);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      if (senderUsername) params.set('senderUsername', senderUsername);
      if (secondaryUsername) params.set('secondaryUsername', secondaryUsername);
      if (recipientUsername) params.set('recipientUsername', recipientUsername);
      const res = await promocodesFetch(`/api/admin/promocodes/applies?${params}`);
      setData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, orderBy, fromDate, toDate, senderUsername, secondaryUsername, recipientUsername]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  if (!ready) return null;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const activeFilter = senderUsername
    ? { label: `Sender: ${senderUsername}`, clear: () => setSenderUsername('') }
    : secondaryUsername
      ? { label: `Also Credits To: ${secondaryUsername}`, clear: () => setSecondaryUsername('') }
      : recipientUsername
        ? { label: `Recipient: ${recipientUsername}`, clear: () => setRecipientUsername('') }
        : null;

  return (
    <div className="promocodes-page max-w-[1400px] mx-auto">
      <div className="reddish_row1 mtop10">Subscriptions with Promo codes</div>

      <PromocodesTabs active="promoAll" />

      <form
        className="mt-4 flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <select
          value={orderBy}
          onChange={(e) => setOrderBy(e.target.value)}
          className="px-3 py-2 border text-sm min-w-[200px]"
        >
          <option value="">Ordering</option>
          <option value="created_desc">By date (newest first)</option>
          <option value="created_asc">By date (oldest first)</option>
        </select>
        <label className="text-sm">
          From
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="ml-2 px-2 py-2 border text-sm"
          />
        </label>
        <label className="text-sm">
          To
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="ml-2 px-2 py-2 border text-sm"
          />
        </label>
        <span className="text-sm font-semibold">Search user</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Username, email or promocode"
          className="px-3 py-2 border text-sm min-w-[200px]"
        />
        <button type="submit" className="px-4 py-2 bg-[#7b0a26] text-white text-sm rounded">
          Search
        </button>
      </form>

      {activeFilter ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-2 border border-[#7b0a26] bg-[#faf0f2] px-3 py-1">
            {activeFilter.label}
            <button
              type="button"
              className="text-[#7b0a26] font-semibold underline"
              onClick={() => {
                activeFilter.clear();
                setPage(1);
              }}
            >
              Clear
            </button>
          </span>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <PromocodePageSizeSelect
          value={pageSize}
          onChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
        <PromocodesPagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500">Loading…</div>
      ) : (
        <PromocodeAppliesTable
          rows={data?.items ?? []}
          variant="promoAll"
          onSenderClick={(name) => {
            setSenderUsername(name);
            setSecondaryUsername('');
            setRecipientUsername('');
            setPage(1);
          }}
          onSecondaryClick={(name) => {
            setSecondaryUsername(name);
            setSenderUsername('');
            setRecipientUsername('');
            setPage(1);
          }}
          onRecipientClick={(name) => {
            setRecipientUsername(name);
            setSenderUsername('');
            setSecondaryUsername('');
            setPage(1);
          }}
        />
      )}

      <PromocodesPagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
