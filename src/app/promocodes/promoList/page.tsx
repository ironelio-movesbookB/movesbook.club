'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  consumePromocodeListRefreshSignal,
  isPromocodeInviteSentMessage,
  isPromocodeSavedMessage,
  PROMOCODE_LIST_REFRESH_STORAGE_KEY,
} from '@/lib/promocodes/promocodeInviteEvents';
import PromocodesTabs from '@/components/promocodes/PromocodesTabs';
import PromocodeListSubTabs from '@/components/promocodes/PromocodeListSubTabs';
import PromocodeSendInviteModal from '@/components/promocodes/PromocodeSendInviteModal';
import PromocodeSettingsTable from '@/components/promocodes/PromocodeSettingsTable';
import PromocodesPagination from '@/components/promocodes/PromocodeAppliesTable';
import PromocodePageSizeSelect from '@/components/promocodes/PromocodePageSizeSelect';
import { promocodesFetch, usePromocodesAdminAuth } from '@/components/promocodes/usePromocodesAdminAuth';
import { usePromocodeDialogs } from '@/components/promocodes/usePromocodeDialogs';
import type { PaginatedResult, PromocodeSettingRow } from '@/lib/promocodes/types';

export default function PromocodesPromoListPage() {
  const ready = usePromocodesAdminAuth();
  const { showAlert, showConfirm, dialogs } = usePromocodeDialogs();
  const [data, setData] = useState<PaginatedResult<PromocodeSettingRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [orderBy, setOrderBy] = useState('');
  const [usableBy, setUsableBy] = useState('');
  const [versionId, setVersionId] = useState('');
  const [available, setAvailable] = useState('');
  const [creatorSource, setCreatorSource] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePromocodeRow, setInvitePromocodeRow] = useState<PromocodeSettingRow | null>(null);
  const invitePopupPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const addPopupPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (options?: { page?: number }) => {
    const effectivePage = options?.page ?? page;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(effectivePage), pageSize: String(pageSize) });
      if (appliedSearch.trim()) params.set('search', appliedSearch.trim());
      if (orderBy) params.set('orderBy', orderBy);
      if (usableBy) params.set('usableBy', usableBy);
      if (versionId) params.set('versionId', versionId);
      if (available) params.set('available', available);
      if (creatorSource) params.set('creatorSource', creatorSource);
      const res = await promocodesFetch(`/api/admin/promocodes/settings?${params}`);
      setData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, appliedSearch, orderBy, usableBy, versionId, available, creatorSource]);

  const refreshAfterPromocodeCreate = useCallback(
    (createdId?: number) => {
      setPage(1);
      setSelectedIds([]);
      if (createdId != null && Number.isFinite(createdId)) {
        setHighlightedId(createdId);
      }
      void load({ page: 1 });
    },
    [load]
  );

  const checkPromocodeListRefreshSignal = useCallback(() => {
    const signal = consumePromocodeListRefreshSignal();
    if (signal) {
      refreshAfterPromocodeCreate(signal.createdId);
      return true;
    }
    return false;
  }, [refreshAfterPromocodeCreate]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  useEffect(() => {
    if (!ready) return;
    checkPromocodeListRefreshSignal();
  }, [ready, checkPromocodeListRefreshSignal]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (isPromocodeInviteSentMessage(event.data)) {
        void load();
        return;
      }
      if (isPromocodeSavedMessage(event.data)) {
        refreshAfterPromocodeCreate(event.data.createdId);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [load, refreshAfterPromocodeCreate]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PROMOCODE_LIST_REFRESH_STORAGE_KEY) return;
      checkPromocodeListRefreshSignal();
    };
    const onFocus = () => {
      checkPromocodeListRefreshSignal();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [checkPromocodeListRefreshSignal]);

  useEffect(() => {
    return () => {
      if (invitePopupPollRef.current) {
        clearInterval(invitePopupPollRef.current);
        invitePopupPollRef.current = null;
      }
      if (addPopupPollRef.current) {
        clearInterval(addPopupPollRef.current);
        addPopupPollRef.current = null;
      }
    };
  }, []);

  const deleteSelected = () => {
    if (selectedIds.length === 0) {
      showAlert('Select at least one promocode.');
      return;
    }
    showConfirm(
      `Delete ${selectedIds.length} promocode(s)?`,
      async () => {
        await promocodesFetch('/api/admin/promocodes/settings', {
          method: 'DELETE',
          body: JSON.stringify({ ids: selectedIds }),
        });
        setSelectedIds([]);
        void load();
      },
      { title: 'Confirm delete', confirmLabel: 'Delete', destructive: true }
    );
  };

  const openPromoDetail = (id: number) => {
    window.open(`/promocodes/promoDetail/${id}`, '_blank');
  };

  const findRow = (id: number) => data?.items.find((r) => r.id === id) ?? null;

  const handleRecipientsSelected = () => {
    const ids =
      highlightedId != null
        ? [highlightedId]
        : selectedIds.length > 0
          ? selectedIds
          : [];

    if (ids.length === 0) {
      showAlert('Please select a promocode row first.');
      return;
    }

    ids.forEach((id) => openPromoDetail(id));
  };

  const buildSendInvitePreviewUrl = (row: PromocodeSettingRow, email: string) => {
    const params = new URLSearchParams({
      email_address: email.trim(),
      promocode: row.code ?? '',
      other_info: '',
      adv_page: '',
      html_page_id: row.helpHtmlPagesId != null ? String(row.helpHtmlPagesId) : '',
      language_id: row.languageId != null ? String(row.languageId) : '1',
    });
    return `/promocodes/send-invite?${params.toString()}`;
  };

  const handleSendInvite = () => {
    if (selectedIds.length === 0) {
      showAlert('Please select one promocode.');
      return;
    }
    if (selectedIds.length > 1) {
      showAlert('Please select one promocode!');
      return;
    }

    const row = findRow(selectedIds[0]);
    if (!row) {
      showAlert('Promocode not found.');
      return;
    }

    setInvitePromocodeRow(row);
    setInviteEmail(row.email ?? '');
    setInviteModalOpen(true);
  };

  const watchInvitePopupUntilClosed = (popup: Window | null) => {
    if (!popup) return;
    if (invitePopupPollRef.current) {
      clearInterval(invitePopupPollRef.current);
    }
    invitePopupPollRef.current = setInterval(() => {
      if (!popup.closed) return;
      if (invitePopupPollRef.current) {
        clearInterval(invitePopupPollRef.current);
        invitePopupPollRef.current = null;
      }
      void load();
    }, 400);
  };

  const watchAddPopupUntilClosed = (popup: Window | null) => {
    if (!popup) return;
    if (addPopupPollRef.current) {
      clearInterval(addPopupPollRef.current);
    }
    addPopupPollRef.current = setInterval(() => {
      if (!popup.closed) return;
      if (addPopupPollRef.current) {
        clearInterval(addPopupPollRef.current);
        addPopupPollRef.current = null;
      }
      checkPromocodeListRefreshSignal();
    }, 400);
  };

  const openAddPromocodePopup = () => {
    const popup = window.open('/promocodes/add', '_blank', 'noopener,noreferrer');
    watchAddPopupUntilClosed(popup);
  };

  const submitInviteFromModal = () => {
    if (!inviteEmail.trim()) {
      showAlert('Please enter an email address.');
      return;
    }
    if (!invitePromocodeRow) return;

    const popup = window.open(buildSendInvitePreviewUrl(invitePromocodeRow, inviteEmail), '_blank');
    watchInvitePopupUntilClosed(popup);
    setInviteModalOpen(false);
  };

  if (!ready) return null;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="promocodes-page max-w-[1400px] mx-auto">
      <div className="reddish_row1 mtop10">Subscriptions with Promo codes</div>

      <PromocodesTabs active="promoList" onAddPromocode={openAddPromocodePopup} />

      <form
        className="mt-4 flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedSearch(search);
          setPage(1);
        }}
      >
        <button
          type="button"
          onClick={() => setFilterOpen(!filterOpen)}
          className="px-4 py-2 bg-gray-700 text-white text-sm rounded"
        >
          Filter ▾
        </button>
        <select
          value={creatorSource}
          onChange={(e) => {
            setCreatorSource(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border text-sm min-w-[180px]"
        >
          <option value="">Movesbook and other users</option>
          <option value="movesbook">Movesbook</option>
          <option value="other">Other users</option>
        </select>
        <select
          value={orderBy}
          onChange={(e) => setOrderBy(e.target.value)}
          className="px-3 py-2 border text-sm"
        >
          <option value="">Ordering</option>
          <option value="created">by date</option>
          <option value="usable_by">Usage</option>
          <option value="valid_from">by start date</option>
          <option value="version_id">by date end subscription</option>
        </select>
        <span className="text-sm font-semibold">Search user</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Username"
          className="px-3 py-2 border text-sm"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-[#7b0a26] text-white text-sm rounded"
        >
          Search
        </button>
        <div className="ml-auto flex items-center gap-3">
          <button type="button" onClick={() => window.print()} className="text-sm underline">
            Print
          </button>
          <button type="button" onClick={deleteSelected} className="text-sm text-red-700 font-bold">
            Delete
          </button>
        </div>
      </form>

      {filterOpen && (
        <div className="mt-3 p-4 bg-gray-100 border border-gray-300 rounded space-y-3 max-w-md">
          <div>
            <label className="text-sm font-medium block mb-1">Usage mode</label>
            <select
              value={usableBy}
              onChange={(e) => setUsableBy(e.target.value)}
              className="w-full px-3 py-2 border text-sm"
            >
              <option value="">All</option>
              <option value="Once">Once</option>
              <option value="Always">Always</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Version</label>
            <input
              value={versionId}
              onChange={(e) => setVersionId(e.target.value)}
              placeholder="Subscription version id"
              className="w-full px-3 py-2 border text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Available</label>
            <select
              value={available}
              onChange={(e) => setAvailable(e.target.value)}
              className="w-full px-3 py-2 border text-sm"
            >
              <option value="">All</option>
              <option value="current">Still available</option>
              <option value="expired">Availability expired</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              void load({ page: 1 });
              setFilterOpen(false);
            }}
            className="px-4 py-2 bg-[#7b0a26] text-white text-sm rounded"
          >
            OK
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

      <PromocodeListSubTabs
        onRecipientsSelected={handleRecipientsSelected}
        onSendInvite={handleSendInvite}
        onAddNew={openAddPromocodePopup}
      />

      {loading ? (
        <div className="py-12 text-center text-gray-500">Loading…</div>
      ) : (
        <PromocodeSettingsTable
          rows={data?.items ?? []}
          selectedIds={selectedIds}
          highlightedId={highlightedId}
          onHighlight={setHighlightedId}
          onRowDoubleClick={openPromoDetail}
          onToggle={(id) => {
            setHighlightedId(id);
            setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
          }}
          onToggleAll={(checked) =>
            setSelectedIds(checked ? (data?.items ?? []).map((r) => r.id) : [])
          }
        />
      )}

      <PromocodesPagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <PromocodeSendInviteModal
        open={inviteModalOpen}
        email={inviteEmail}
        onEmailChange={setInviteEmail}
        onClose={() => setInviteModalOpen(false)}
        onSend={submitInviteFromModal}
      />

      {dialogs}
    </div>
  );
}
