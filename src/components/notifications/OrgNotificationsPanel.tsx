'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { NotificationDto } from '@/lib/notifications/notificationService';
import type { OrgEntityKind } from '@/lib/notifications/notificationService';

const CKEditor = dynamic(() => import('@/components/news/CKEditor'), { ssr: false });

function userToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

const today = () => new Date().toISOString().slice(0, 10);

const KIND_LABEL: Record<OrgEntityKind, { title: string; entity: string; inboxHint: string }> = {
  coach: {
    title: 'Posted by Coach',
    entity: 'coaching groups',
    inboxHint: 'Athletes trained by you',
  },
  team: {
    title: 'Posted by Team',
    entity: 'teams',
    inboxHint: "Team's athletes",
  },
  group: {
    title: 'Posted by Group',
    entity: 'groups',
    inboxHint: 'Group members',
  },
};

type Props = {
  kind: OrgEntityKind;
  /** Pre-selected entity (optional). */
  entityId?: string | null;
};

export default function OrgNotificationsPanel({ kind, entityId }: Props) {
  const labels = KIND_LABEL[kind];
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [entities, setEntities] = useState<{ id: string; name: string }[]>([]);

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
      const qs = new URLSearchParams({ kind, page: String(page), pageSize: '10' });
      if (entityId) qs.set('entityId', entityId);
      const res = await fetch(`/api/notifications/org?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [kind, entityId, page]);

  const loadEntities = useCallback(async () => {
    const token = userToken();
    if (!token) return;
    const res = await fetch(`/api/notifications/org?kind=${kind}&entities=1`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return;
    const data = await res.json();
    setEntities(data.entities || []);
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadEntities();
  }, [loadEntities]);

  function resetForm() {
    setEditId(null);
    setTitle('');
    setDescription('');
    setPath('');
    setUntilDate(today());
    setPrioritary(false);
    setSelectedIds(entityId ? [entityId] : []);
    setFormError('');
  }

  function openCreate() {
    resetForm();
    setModalOpen(true);
  }

  function openEdit(item: NotificationDto) {
    setEditId(item.id);
    setTitle(item.title);
    setDescription(item.description);
    setPath(item.path || '');
    setUntilDate(item.untilDate);
    setPrioritary(item.prioritary);
    setSelectedIds(item.clubIds);
    setFormError('');
    setModalOpen(true);
  }

  async function save() {
    const token = userToken();
    if (!token) return;
    setSaving(true);
    setFormError('');
    try {
      const res = await fetch('/api/notifications/org', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind,
          title,
          description,
          path,
          untilDate,
          prioritary,
          editId: editId || undefined,
          entityIds: entityId ? [entityId] : selectedIds,
        }),
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
    await fetch('/api/notifications/org', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ kind, id: item.id, isShow: !item.isShow }),
    });
    await load();
  }

  async function remove(item: NotificationDto) {
    if (!confirm('Delete this notification?')) return;
    const token = userToken();
    if (!token) return;
    await fetch(
      `/api/notifications/org?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(item.id)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    );
    await load();
  }

  async function deleteRange() {
    const token = userToken();
    if (!token) return;
    if (!confirm(`Delete notifications from ${rangeFrom} to ${rangeTo}?`)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/notifications/org', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind,
          action: 'delete_range',
          fromDate: rangeFrom,
          toDate: rangeTo,
          entityId: entityId || undefined,
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

  return (
    <div className="w-full p-4 md:p-6 text-gray-900">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{labels.title}</h1>
          <p className="text-sm text-gray-600 mt-1">{labels.inboxHint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/users/notification/all/all/movesbook"
            className="rounded border border-gray-300 px-3 py-1.5 text-sm bg-white text-gray-900"
          >
            By Movesbook
          </Link>
          <button
            type="button"
            onClick={() => setRangeOpen(true)}
            className="rounded border border-gray-400 bg-white px-3 py-1.5 text-sm"
          >
            Delete from..to..
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

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No notifications sent yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded border border-gray-300 bg-white">
              <div className="flex items-start gap-2 p-3">
                <button type="button" className="text-red-700 mt-1" onClick={() => void remove(item)}>
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="flex-1 text-left"
                  onClick={() => setExpandedId((v) => (v === item.id ? null : item.id))}
                >
                  <div className="flex items-center gap-2">
                    {item.prioritary ? <MapPin className="h-4 w-4 text-red-600" /> : null}
                    <span className="font-semibold">{item.title}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.createdAt.slice(0, 10)} · until {item.untilDate} · {item.clubIds.length || 'all'}{' '}
                    {labels.entity}
                  </p>
                </button>
                <button type="button" onClick={() => void toggleShow(item)}>
                  {item.isShow ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-gray-400" />}
                </button>
                <button type="button" onClick={() => openEdit(item)} title="Edit">
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

      <p className="mt-3 text-xs text-gray-500">{total} total</p>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-8 w-full max-w-2xl rounded bg-white shadow-lg text-gray-900">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">{editId ? 'Edit notification' : 'Send to the recipients'}</h2>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Displayed until</span>
                <input
                  type="date"
                  value={untilDate}
                  onChange={(e) => setUntilDate(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                />
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Object"
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
              <input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="Path (optional)"
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
              <div>
                <p className="text-sm font-medium mb-1">Message (HTML)</p>
                <div className="border rounded overflow-hidden">
                  <CKEditor
                    value={description}
                    onChange={setDescription}
                    instanceId={`org-notify-${kind}`}
                    minHeightPx={160}
                  />
                </div>
              </div>
              {!entityId ? (
                <div>
                  <p className="text-sm font-medium mb-1">
                    Select {labels.entity} that receive this notification
                    {kind === 'coach' ? ' (empty = all trained athletes)' : ''}
                  </p>
                  <div className="max-h-36 overflow-auto border rounded p-2 bg-gray-50 space-y-1">
                    {entities.length === 0 ? (
                      <p className="text-xs text-gray-500">
                        {kind === 'coach'
                          ? 'No coaching groups — will notify all trained athletes.'
                          : `No ${labels.entity} found.`}
                      </p>
                    ) : (
                      entities.map((e) => (
                        <label key={e.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(e.id)}
                            onChange={(ev) => {
                              setSelectedIds((prev) =>
                                ev.target.checked ? [...prev, e.id] : prev.filter((id) => id !== e.id),
                              );
                            }}
                          />
                          <span>{e.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={prioritary} onChange={(e) => setPrioritary(e.target.checked)} />
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
                <button type="button" onClick={() => setModalOpen(false)} className="rounded bg-gray-200 px-4 py-2 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {rangeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded bg-white p-4 shadow-lg space-y-3">
            <h3 className="font-semibold">Delete from..to..</h3>
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
