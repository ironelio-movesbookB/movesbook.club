'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PromocodesTabs from '@/components/promocodes/PromocodesTabs';
import PromocodesPagination, {
  PromocodeAppliesTable,
} from '@/components/promocodes/PromocodeAppliesTable';
import PromocodePageSizeSelect from '@/components/promocodes/PromocodePageSizeSelect';
import { promocodesFetch, usePromocodesAdminAuth } from '@/components/promocodes/usePromocodesAdminAuth';
import { usePromocodeDialogs } from '@/components/promocodes/usePromocodeDialogs';
import PromocodeSendMessageModal from '@/components/promocodes/PromocodeSendMessageModal';
import {
  promocodeApplyRecipientEmail,
  promocodeRecipientLabel,
} from '@/lib/promocodes/promocodeApplyDisplay';
import type { PaginatedResult, PromocodeApplyRow } from '@/lib/promocodes/types';

export default function PromocodesIndexPage() {
  const ready = usePromocodesAdminAuth();
  const { showAlert, showConfirm, dialogs } = usePromocodeDialogs();
  const [data, setData] = useState<PaginatedResult<PromocodeApplyRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [orderBy, setOrderBy] = useState('created_desc');
  const [registeredOnly, setRegisteredOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [senderUsername, setSenderUsername] = useState('');
  const [secondaryUsername, setSecondaryUsername] = useState('');
  const [recipientUsername, setRecipientUsername] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sendMessageOpen, setSendMessageOpen] = useState(false);
  const [sendMessageEmail, setSendMessageEmail] = useState('');
  const [sendMessageLabel, setSendMessageLabel] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        registeredOnly: registeredOnly ? '1' : '0',
      });
      if (search.trim()) params.set('search', search.trim());
      if (orderBy) params.set('orderBy', orderBy);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      if (senderUsername) params.set('senderUsername', senderUsername);
      if (secondaryUsername) params.set('secondaryUsername', secondaryUsername);
      if (recipientUsername) params.set('recipientUsername', recipientUsername);
      const res = await promocodesFetch(`/api/admin/promocodes/applies?${params}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, orderBy, registeredOnly, fromDate, toDate, senderUsername, secondaryUsername, recipientUsername]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const openSendMessage = () => {
    if (!selectedId) {
      showAlert('Please select a row first.');
      return;
    }
    const row = data?.items.find((item) => item.id === selectedId);
    if (!row) {
      showAlert('Selected row is no longer available. Refresh the list and try again.');
      return;
    }
    const email = promocodeApplyRecipientEmail(row);
    if (!email) {
      showAlert('No valid email address found for the selected recipient.');
      return;
    }
    setSendMessageEmail(email);
    setSendMessageLabel(promocodeRecipientLabel(row).text || email);
    setSendMessageOpen(true);
  };

  const handleSendMessage = async (payload: { to: string; subject: string; html: string }) => {
    const res = await promocodesFetch('/api/admin/promocodes/send-message', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to send message');
    }
    showAlert(json.message || 'Message sent successfully.');
  };

  const deleteSelected = () => {
    if (!selectedId) {
      showAlert('Please select a row first.');
      return;
    }
    showConfirm(
      'Delete selected invite record?',
      async () => {
        await promocodesFetch('/api/admin/promocodes/applies', {
          method: 'DELETE',
          body: JSON.stringify({ ids: [selectedId] }),
        });
        void load();
      },
      { title: 'Confirm delete', confirmLabel: 'Delete', destructive: true }
    );
  };

  if (!ready) return null;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="promocodes-page max-w-[1400px] mx-auto">
      <div className="reddish_row1 mtop10">Subscriptions with Promo codes</div>

      <PromocodesTabs active="index" />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setFilterOpen(!filterOpen)}
          className="px-4 py-2 bg-gray-700 text-white text-sm rounded"
        >
          Filter ▾
        </button>
        <button type="button" onClick={() => window.print()} className="text-sm text-blue-800 underline">
          Print
        </button>
        <button type="button" onClick={openSendMessage} className="text-sm text-blue-800 underline">
          Send Msg
        </button>
        <button type="button" onClick={deleteSelected} className="text-sm text-red-700 underline">
          Delete
        </button>
        <div className="ml-auto">
          {registeredOnly ? (
            <div className="flex items-center gap-2">
              <Link
                href="/promocodes"
                onClick={(e) => {
                  e.preventDefault();
                  setRegisteredOnly(false);
                  setPage(1);
                }}
                className="px-4 py-2 border-2 border-[#7b0a26] bg-[#7b0a26] text-white text-sm font-bold rounded"
              >
                Show all invites
              </Link>
              <span className="text-green-800 font-bold text-sm">Completed registrations only</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRegisteredOnly(true);
                setPage(1);
              }}
              className="px-4 py-2 border-2 border-[#7b0a26] bg-white text-[#7b0a26] text-sm font-bold rounded hover:bg-red-50"
            >
              Display only registrations
            </button>
          )}
        </div>
      </div>

      {filterOpen && (
        <div className="mt-3 p-4 bg-gray-100 border border-gray-300 rounded flex flex-wrap items-end gap-3">
          <select
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value)}
            className="px-3 py-2 border text-sm min-w-[220px]"
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
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Username, email or promocode"
            className="px-3 py-2 border text-sm min-w-[220px]"
          />
          <button
            type="button"
            onClick={() => {
              setPage(1);
              void load();
            }}
            className="px-4 py-2 bg-[#7b0a26] text-white text-sm rounded"
          >
            Search
          </button>
          <button type="button" onClick={() => setFilterOpen(false)} className="px-4 py-2 border text-sm rounded">
            Exit
          </button>
        </div>
      )}

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
          variant="index"
          selectedId={selectedId}
          onSelect={setSelectedId}
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

      <PromocodeSendMessageModal
        open={sendMessageOpen}
        toEmail={sendMessageEmail}
        recipientLabel={sendMessageLabel}
        onClose={() => setSendMessageOpen(false)}
        onSend={handleSendMessage}
      />

      {dialogs}
    </div>
  );
}
