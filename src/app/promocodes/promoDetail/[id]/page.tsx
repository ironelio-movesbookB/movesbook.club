'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PromocodesPagination, {
  PromocodeAppliesTable,
} from '@/components/promocodes/PromocodeAppliesTable';
import PromocodePageSizeSelect from '@/components/promocodes/PromocodePageSizeSelect';
import { promocodesFetch, usePromocodesAdminAuth } from '@/components/promocodes/usePromocodesAdminAuth';
import { formatPromocodeDisplayDate } from '@/lib/promocodes/formatPromocodeDate';
import type { PaginatedResult, PromocodeApplyRow, PromocodeSettingRow } from '@/lib/promocodes/types';

export default function PromocodeDetailPage() {
  const ready = usePromocodesAdminAuth();
  const params = useParams();
  const id = parseInt(String(params?.id ?? ''), 10);

  const [setting, setSetting] = useState<PromocodeSettingRow | null>(null);
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
    if (!Number.isFinite(id)) return;
    setLoading(true);
    try {
      const [settingRes, appliesParams] = await Promise.all([
        promocodesFetch(`/api/admin/promocodes/settings/${id}`),
        (() => {
          const p = new URLSearchParams({
            page: String(page),
            pageSize: String(pageSize),
            promocodeId: String(id),
          });
          if (search.trim()) p.set('search', search.trim());
          if (orderBy) p.set('orderBy', orderBy);
          if (fromDate) p.set('fromDate', fromDate);
          if (toDate) p.set('toDate', toDate);
          if (senderUsername) p.set('senderUsername', senderUsername);
          if (secondaryUsername) p.set('secondaryUsername', secondaryUsername);
          if (recipientUsername) p.set('recipientUsername', recipientUsername);
          return p;
        })(),
      ]);
      const settingJson = await settingRes.json();
      setSetting(settingJson.setting ?? null);

      const appliesRes = await promocodesFetch(`/api/admin/promocodes/applies?${appliesParams}`);
      setData(await appliesRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id, page, pageSize, search, orderBy, fromDate, toDate, senderUsername, secondaryUsername, recipientUsername]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  if (!ready) return null;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="bg-[#7b0a26] text-white px-4 py-2 font-bold text-lg">
        Subscriptions with Promo codes
      </div>

      {setting && (
        <div className="mt-4 flex flex-wrap gap-2 text-base">
          <span className="text-[#b3363a]">Promocode</span>
          <span className="text-[#7b0a26] font-bold">{setting.code}</span>
          <span>created on</span>
          <span className="font-bold">{formatPromocodeDisplayDate(setting.validFrom)}</span>
          <span>Expiration on</span>
          <span className="font-bold">{formatPromocodeDisplayDate(setting.validTo)}</span>
        </div>
      )}

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
          placeholder="Username or email"
          className="px-3 py-2 border text-sm min-w-[200px]"
        />
        <button type="submit" className="px-4 py-2 bg-[#7b0a26] text-white text-sm rounded">
          Search
        </button>
      </form>

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
          variant="detail"
          onSenderClick={(name) => {
            setSenderUsername(name);
            setPage(1);
          }}
          onSecondaryClick={(name) => {
            setSecondaryUsername(name);
            setPage(1);
          }}
          onRecipientClick={(name) => {
            setRecipientUsername(name);
            setPage(1);
          }}
        />
      )}

      <PromocodesPagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
