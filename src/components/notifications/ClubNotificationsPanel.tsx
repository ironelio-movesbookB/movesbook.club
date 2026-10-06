'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { NotificationDto } from '@/lib/notifications/notificationService';

const CKEditor = dynamic(() => import('@/components/news/CKEditor'), { ssr: false });

function userToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

const today = () => new Date().toISOString().slice(0, 10);

type StatusFilter = 'all' | 'active' | 'expired';

type Props = {
  /** When set = MY CLUB (one club). When omitted = MY PAGE (all owned clubs). */
  clubId?: string | null;
  /** Prefill For Club Staff when opened from Quick menu */
  initialAudienceKind?: 'members' | 'staff';
  /**
   * Member Overview: only show notifies whose audience is club members
   * (broadcasts that apply to the selected member).
   */
  memberAudienceOnly?: boolean;
};

export default function ClubNotificationsPanel({
  clubId,
  initialAudienceKind = 'members',
  memberAudienceOnly = false,
}: Props) {
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ownedClubs, setOwnedClubs] = useState<{ id: string; name: string }[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [path, setPath] = useState('');
  const [untilDate, setUntilDate] = useState(today());
  const [prioritary, setPrioritary] = useState(false);
  const [audienceKind, setAudienceKind] = useState<'members' | 'staff'>(initialAudienceKind);
  const [selectedClubIds, setSelectedClubIds] = useState<string[]>([]);
  const [rangeFrom, setRangeFrom] = useState(today());
  const [rangeTo, setRangeTo] = useState(today());

  const load = useCallback(async () => {
    const token = userToken();
    if (!token) {
      setError('Please sign in');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: '10',
        status: statusFilter,
      });
      if (clubId) qs.set('clubId', clubId);
      const res = await fetch(`/api/notifications/club?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const rawItems = (data.items || []) as NotificationDto[];
      const filtered = memberAudienceOnly
        ? rawItems.filter((item) => item.audienceKind === 'members')
        : rawItems;
      setItems(filtered);
      setTotal(memberAudienceOnly ? filtered.length : data.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [clubId, page, statusFilter, memberAudienceOnly]);

  const loadOwnedClubs = useCallback(async () => {
    const token = userToken();
    if (!token) return;
    const res = await fetch('/api/notifications/club?ownedClubs=1', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return;
    const data = await res.json();
    setOwnedClubs(data.clubs || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadOwnedClubs();
  }, [loadOwnedClubs]);

  function changeStatus(next: StatusFilter) {
    setStatusFilter(next);
    setPage(1);
  }

  function resetForm() {
    setEditId(null);
    setTitle('');
    setDescription('');
    setPath('');
    setUntilDate(today());
    setPrioritary(false);
    setAudienceKind(initialAudienceKind);
    setSelectedClubIds(clubId ? [clubId] : []);
    setFormError('');
  }

  function openCreate() {
    resetForm();
    setModalOpen(true);
  }

  useEffect(() => {
    if (initialAudienceKind === 'staff') {
      openCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once when landing with ?audience=staff
  }, []);

  function openEdit(item: NotificationDto) {
    setEditId(item.id);
    setTitle(item.title);
    setDescription(item.description);
    setPath(item.path || '');
    setUntilDate(item.untilDate);
    setPrioritary(item.prioritary);
    setAudienceKind(item.audienceKind === 'staff' ? 'staff' : 'members');
    setSelectedClubIds(item.clubIds.length ? item.clubIds : clubId ? [clubId] : []);
    setFormError('');
    setModalOpen(true);
  }

  async function save() {
    const token = userToken();
    if (!token) return;
    setSaving(true);
    setFormError('');
    try {
      const body: Record<string, unknown> = {
        title,
        description,
        path,
        untilDate,
        prioritary,
        audienceKind,
        editId: editId || undefined,
        clubIds: clubId ? [clubId] : selectedClubIds,
      };
      const res = await fetch('/api/notifications/club', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setModalOpen(false);
      resetForm();
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleShow(item: NotificationDto) {
    const token = userToken();
    if (!token) return;
    await fetch('/api/notifications/club', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: item.id, isShow: !item.isShow }),
    });
    await load();
  }

  async function remove(item: NotificationDto) {
    if (!confirm('Delete this notification?')) return;
    const token = userToken();
    if (!token) return;
    await fetch(`/api/notifications/club?id=${encodeURIComponent(item.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  }

  async function deleteRange() {
    const token = userToken();
    if (!token) return;
    if (!confirm(`Delete notifications from ${rangeFrom} to ${rangeTo}?`)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/notifications/club', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete_range',
          fromDate: rangeFrom,
          toDate: rangeTo,
          clubId: clubId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setRangeOpen(false);
      await load();
      alert(`Deleted ${data.deleted ?? 0} notification(s).`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  const scopeLabel = clubId
    ? 'Members of the selected club (MY CLUB)'
    : 'Members of all clubs you own (MY PAGE)';

  const statusTabs: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'expired', label: 'Expired' },
  ];

  return (
    <div className="w-full p-4 md:p-6 text-gray-900">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notifications for the Club Staff</h1>
          <p className="text-sm text-gray-600 mt-1">{scopeLabel}</p>
          <p className="text-xs text-gray-500 mt-1">
            Broadcast notifies among club admin and staff (no reply). Use “Post messages for the Club Staff” for
            conversations with replies.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/users/notification/all/all/movesbook"
            className="rounded border border-gray-300 px-3 py-1.5 text-sm bg-white text-gray-900 hover:bg-gray-50"
          >
            By Movesbook
          </Link>
          <button
            type="button"
            onClick={() => setRangeOpen(true)}
            className="rounded border border-gray-400 bg-white px-3 py-1.5 text-sm text-gray-900"
          >
            Multiple deletion
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1 rounded bg-red-700 px-3 py-1.5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Add new
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-300 pb-0">
        {statusTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => changeStatus(tab.id)}
            className={`px-4 py-1.5 text-sm border border-b-0 rounded-t ${
              statusFilter === tab.id
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No club notifications sent yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded border border-gray-300 bg-white">
              <div className="flex items-center gap-2 p-3">
                <button type="button" className="text-red-700 shrink-0" onClick={() => void remove(item)}>
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="flex-1 text-left min-w-0"
                  onClick={() => setExpandedId((v) => (v === item.id ? null : item.id))}
                >
                  <div className="flex items-center gap-2">
                    {item.prioritary ? <MapPin className="h-4 w-4 text-red-600 shrink-0" /> : null}
                    <span className="font-semibold text-gray-900">{item.title}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.createdAt.slice(0, 10)} · until {item.untilDate} · {item.audienceKind} ·{' '}
                    {item.clubIds.length} club(s)
                  </p>
                </button>
                <div className="min-w-[7rem] max-w-[10rem] shrink-0 text-right">
                  <p className="text-xs font-semibold text-gray-900 leading-snug break-words">
                    {item.senderOfficialName || item.submittedByName || 'Club'}
                  </p>
                  {item.submittedByUsername ? (
                    <p className="text-[11px] text-gray-500 truncate">@{item.submittedByUsername}</p>
                  ) : null}
                </div>
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-gray-300 bg-gray-100 flex items-center justify-center">
                  {item.senderLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.senderLogoUrl}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-[9px] text-gray-500">N/A</span>
                  )}
                </div>
                <button type="button" onClick={() => void toggleShow(item)} title="Toggle visibility">
                  {item.isShow ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-gray-400" />}
                </button>
                <button type="button" onClick={() => openEdit(item)} title="Edit" className="text-gray-800">
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              {expandedId === item.id ? (
                <div
                  className="border-t px-3 py-2 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: item.description }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">{total} total</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page * 10 >= total || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-8 w-full max-w-2xl rounded bg-white shadow-lg text-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 className="font-semibold text-gray-900">
                {editId ? 'Edit notification' : 'Send to the recipients'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 p-4 text-gray-900">
              {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">Displayed until</span>
                <input
                  type="date"
                  value={untilDate}
                  onChange={(e) => setUntilDate(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
                />
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Object"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white"
              />
              <input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="Path (optional)"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white"
              />
              <div>
                <p className="text-sm font-medium mb-1">Message (HTML)</p>
                <div className="border border-gray-300 rounded overflow-hidden bg-white">
                  <CKEditor
                    value={description}
                    onChange={setDescription}
                    instanceId="club-notify-body"
                    placeholder="Paste HTML, images, links…"
                    minHeightPx={160}
                  />
                </div>
              </div>
              <div className="text-sm space-y-2 text-gray-900">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={audienceKind === 'members'}
                    onChange={() => setAudienceKind('members')}
                  />
                  For Members
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={audienceKind === 'staff'}
                    onChange={() => setAudienceKind('staff')}
                  />
                  For Club Staff
                </label>
              </div>
              {!clubId ? (
                <div>
                  <p className="text-sm font-medium mb-1">Clubs that receive this notification</p>
                  <div className="max-h-36 overflow-auto border border-gray-200 rounded p-2 bg-gray-50 space-y-1">
                    {ownedClubs.length === 0 ? (
                      <p className="text-xs text-gray-500">No owned clubs.</p>
                    ) : (
                      ownedClubs.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedClubIds.includes(c.id)}
                            onChange={(e) => {
                              setSelectedClubIds((prev) =>
                                e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                              );
                            }}
                          />
                          <span>{c.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
              <label className="inline-flex items-center gap-2 text-sm text-gray-900">
                <input
                  type="checkbox"
                  checked={prioritary}
                  onChange={(e) => setPrioritary(e.target.checked)}
                />
                Put prioritary
              </label>
              <div className="flex justify-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Post'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {rangeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded bg-white p-4 shadow-lg text-gray-900 space-y-3">
            <h3 className="font-semibold">Multiple deletion (from..to..)</h3>
            <div className="flex gap-2 items-center text-sm">
              <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="border rounded px-2 py-1" />
              <span>to</span>
              <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="border rounded px-2 py-1" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRangeOpen(false)} className="rounded bg-gray-200 px-3 py-1.5 text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void deleteRange()}
                className="rounded bg-red-700 px-3 py-1.5 text-sm text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
