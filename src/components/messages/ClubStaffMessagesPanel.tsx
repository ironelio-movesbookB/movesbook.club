'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getAuthToken } from '@/utils/auth.utils';

type ClubRole = 'admin' | 'staff' | 'member';
type PartyType = 'staff' | 'member';

type ClubOption = { id: string; name: string; role: ClubRole };

type Person = { id: string; name: string; username: string | null; image: string | null };

type MessageItem = {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: string;
  replyCount: number;
  clubId: string | null;
  clubName: string;
  author: Person | null;
  recipient: Person | null;
  recipientType: PartyType | null;
  isCreator: boolean;
  deletedByRecipient: boolean;
};

type ThreadDetail = {
  thread: { id: string; subject: string; authorName?: string };
  messages: Array<{
    id: string;
    body: string;
    isStaff: boolean;
    createdAt: string;
    sender?: { id: string; name: string; username: string } | null;
  }>;
  viewerId: string;
  role: 'creator' | 'recipient';
  recipient: Person | null;
  recipientType: PartyType | null;
  deletedByRecipient: boolean;
  firstMessageId: string | null;
  canReply: boolean;
};

type Props = {
  initialClubId?: string | null;
};

const LIST_BG = 'rgb(251,255,237)';
const LIST_BG_SELECTED = 'rgb(254,255,203)';
const PAGE_SIZE = 10;

function typeLabel(type: PartyType): string {
  return type === 'staff' ? 'Club Staff' : 'Members';
}

function typesForRole(role: ClubRole | undefined): PartyType[] {
  if (!role) return [];
  return role === 'member' ? ['staff'] : ['staff', 'member'];
}

async function fetchRecipients(clubId: string, type: PartyType): Promise<Person[]> {
  const t = getAuthToken();
  if (!t || !clubId) return [];
  const qs = new URLSearchParams({ recipients: '1', clubId, type });
  const res = await fetch(`/api/club/messages?${qs}`, {
    headers: { Authorization: `Bearer ${t}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.recipients || [];
}

const selectClass =
  'mt-1 block w-full min-w-[180px] border border-gray-300 rounded px-2 py-1.5 text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400';

export default function ClubStaffMessagesPanel({ initialClubId = null }: Props) {
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [viewerId, setViewerId] = useState('');
  const [error, setError] = useState('');

  const [cClubId, setCClubId] = useState(initialClubId || '');
  const [cType, setCType] = useState<PartyType | ''>('');
  const [cRecipients, setCRecipients] = useState<Person[]>([]);
  const [cRecipientId, setCRecipientId] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const [fClubId, setFClubId] = useState(initialClubId || '');
  const [fType, setFType] = useState<PartyType | ''>('');
  const [fRecipients, setFRecipients] = useState<Person[]>([]);
  const [fRecipientId, setFRecipientId] = useState('');

  const [items, setItems] = useState<MessageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const composeClub = clubs.find((c) => c.id === cClubId);
  const composeTypes = typesForRole(composeClub?.role);
  const composeRecipient = cRecipients.find((r) => r.id === cRecipientId) || null;

  const filterTypes = useMemo<PartyType[]>(() => {
    if (fClubId) return typesForRole(clubs.find((c) => c.id === fClubId)?.role);
    return clubs.some((c) => c.role !== 'member') ? ['staff', 'member'] : ['staff'];
  }, [clubs, fClubId]);

  useEffect(() => {
    const t = getAuthToken();
    if (!t) return;
    void (async () => {
      const res = await fetch('/api/club/messages?clubs=1', {
        headers: { Authorization: `Bearer ${t}` },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      const list: ClubOption[] = data.clubs || [];
      setClubs(list);
      if (data.viewerId) setViewerId(String(data.viewerId));
      const preferred =
        initialClubId && list.some((c) => c.id === initialClubId) ? initialClubId : list[0]?.id || '';
      setCClubId(preferred);
      setFClubId((prev) => (prev && list.some((c) => c.id === prev) ? prev : initialClubId ? preferred : ''));
    })();
  }, [initialClubId]);

  useEffect(() => {
    const types = typesForRole(composeClub?.role);
    setCType((prev) => (prev && types.includes(prev) ? prev : types.length === 1 ? types[0] : ''));
  }, [composeClub?.role]);

  useEffect(() => {
    setCRecipientId('');
    if (!cClubId || !cType) {
      setCRecipients([]);
      return;
    }
    let cancelled = false;
    void fetchRecipients(cClubId, cType).then((list) => {
      if (!cancelled) setCRecipients(list);
    });
    return () => {
      cancelled = true;
    };
  }, [cClubId, cType]);

  useEffect(() => {
    setFRecipientId('');
    if (!fClubId || !fType) {
      setFRecipients([]);
      return;
    }
    let cancelled = false;
    void fetchRecipients(fClubId, fType).then((list) => {
      if (!cancelled) setFRecipients(list);
    });
    return () => {
      cancelled = true;
    };
  }, [fClubId, fType]);

  useEffect(() => {
    if (fType && !filterTypes.includes(fType)) setFType('');
  }, [filterTypes, fType]);

  const loadList = useCallback(async () => {
    const t = getAuthToken();
    if (!t) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (fClubId) qs.set('clubId', fClubId);
      if (fType) qs.set('type', fType);
      if (fRecipientId) qs.set('recipientId', fRecipientId);
      const res = await fetch(`/api/club/messages?${qs}`, {
        headers: { Authorization: `Bearer ${t}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setItems(data.items || []);
      setTotal(data.total || 0);
      if (data.viewerId) setViewerId(String(data.viewerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [page, fClubId, fType, fRecipientId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function openThread(id: string) {
    const t = getAuthToken();
    if (!t) return;
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    setReply('');
    try {
      const res = await fetch(`/api/club/messages?threadId=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${t}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open');
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeCompose() {
    setComposeOpen(false);
    setSubject('');
    setBody('');
  }

  async function submitCompose() {
    const t = getAuthToken();
    if (!t || !cClubId || !cType || !cRecipientId || !body.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/club/messages', {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId: cClubId,
          recipientType: cType,
          recipientUserId: cRecipientId,
          subject,
          body,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post');
      closeCompose();
      setPage(1);
      await loadList();
      if (data.id) void openThread(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post');
    } finally {
      setSaving(false);
    }
  }

  async function submitReply() {
    const t = getAuthToken();
    if (!t || !selectedId || !reply.trim()) return;
    setReplying(true);
    try {
      const res = await fetch(`/api/messages/threads/${selectedId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reply');
      setReply('');
      setDetail(data);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reply');
    } finally {
      setReplying(false);
    }
  }

  async function removeThread(item: MessageItem) {
    const prompt = item.isCreator
      ? 'Delete this message? The message and all its replies will be removed for both sides.'
      : 'Delete this message? All replies will be removed; the sender keeps only the original message.';
    if (!window.confirm(prompt)) return;
    const t = getAuthToken();
    if (!t) return;
    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/club/messages?id=${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete');
      }
      if (selectedId === item.id) {
        setSelectedId(null);
        setDetail(null);
      }
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  }

  async function removeReply(messageId: string) {
    if (!window.confirm('Delete this reply?')) return;
    const t = getAuthToken();
    if (!t || !selectedId) return;
    try {
      const res = await fetch(`/api/club/messages?replyId=${encodeURIComponent(messageId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete reply');
      }
      await openThread(selectedId);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete reply');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const resetSelection = () => {
    setPage(1);
    setSelectedId(null);
    setDetail(null);
  };

  return (
    <div className="w-full p-4 md:p-6 text-gray-900">
      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}

      <div className="mb-4 rounded border border-gray-300 bg-white p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="text-gray-600 text-xs font-medium">Club</span>
            <select
              value={cClubId}
              onChange={(e) => {
                setCClubId(e.target.value);
                closeCompose();
              }}
              className={selectClass}
            >
              {clubs.length === 0 ? <option value="">No clubs</option> : null}
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.role === 'admin' || c.role === 'staff' ? ` (${c.role})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray-600 text-xs font-medium">Type of recipient</span>
            <select
              value={cType}
              disabled={!cClubId}
              onChange={(e) => {
                setCType(e.target.value as PartyType | '');
                closeCompose();
              }}
              className={selectClass}
            >
              <option value="">Select…</option>
              {composeTypes.map((type) => (
                <option key={type} value={type}>
                  {typeLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray-600 text-xs font-medium">Recipient</span>
            <select
              value={cRecipientId}
              disabled={!cType}
              onChange={(e) => setCRecipientId(e.target.value)}
              className={selectClass}
            >
              <option value="">{cType && cRecipients.length === 0 ? 'No recipients' : 'Select…'}</option>
              {cRecipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.username ? ` (@${r.username})` : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!cRecipientId}
            onClick={() => setComposeOpen(true)}
            className="rounded border border-red-700 text-red-700 px-3 py-1.5 text-sm font-medium hover:bg-red-50 disabled:opacity-40"
          >
            Post message
          </button>
        </div>

        {composeOpen && composeRecipient ? (
          <div className="mt-3 rounded border border-gray-300 p-3 space-y-3">
            <h2 className="font-semibold text-gray-900">New message for {composeRecipient.name}</h2>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={5}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={closeCompose}
                className="px-3 py-1.5 text-sm rounded border border-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !body.trim()}
                onClick={() => void submitCompose()}
                className="px-3 py-1.5 text-sm rounded bg-teal-800 text-white disabled:opacity-40"
              >
                {saving ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded border border-gray-300 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200 text-sm font-semibold">Messages ({total})</div>
          <div className="px-3 py-2 border-b border-gray-200 flex flex-wrap items-end gap-2">
            <label className="block text-sm">
              <span className="text-gray-600 text-xs font-medium">Club</span>
              <select
                value={fClubId}
                onChange={(e) => {
                  setFClubId(e.target.value);
                  resetSelection();
                }}
                className={selectClass}
              >
                <option value="">All</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 text-xs font-medium">Type of recipient</span>
              <select
                value={fType}
                onChange={(e) => {
                  setFType(e.target.value as PartyType | '');
                  resetSelection();
                }}
                className={selectClass}
              >
                <option value="">All</option>
                {filterTypes.map((type) => (
                  <option key={type} value={type}>
                    {typeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 text-xs font-medium">Recipient</span>
              <select
                value={fRecipientId}
                disabled={!fClubId || !fType}
                onChange={(e) => {
                  setFRecipientId(e.target.value);
                  resetSelection();
                }}
                className={selectClass}
              >
                <option value="">All</option>
                {fRecipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="p-3 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : clubs.length === 0 ? (
              <p className="text-sm text-gray-500">Join a club to use messages among staff and members.</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">No messages yet.</p>
            ) : (
              <ul className="space-y-3">
                {items.map((item) => {
                  const other = item.isCreator ? item.recipient : item.author;
                  const greyed = item.isCreator && item.deletedByRecipient;
                  return (
                    <li key={item.id}>
                      <div
                        className="rounded border border-gray-200 overflow-hidden"
                        style={{ backgroundColor: selectedId === item.id ? LIST_BG_SELECTED : LIST_BG }}
                      >
                        <button
                          type="button"
                          onClick={() => void openThread(item.id)}
                          className={`w-full text-left p-3 flex gap-2 ${greyed ? 'opacity-50' : ''}`}
                        >
                          {other?.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={other.image}
                              alt=""
                              className="h-11 w-11 rounded object-cover shrink-0 bg-gray-200"
                            />
                          ) : (
                            <div className="h-11 w-11 rounded bg-gray-200 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div
                              className={`font-semibold text-sm ${greyed ? 'text-gray-500' : 'text-gray-900'}`}
                            >
                              {item.title}
                            </div>
                            {item.excerpt ? (
                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.excerpt}</p>
                            ) : null}
                            <p className="text-[11px] text-gray-500 mt-1">
                              {item.isCreator ? 'To' : 'From'}: {other?.name || 'Club staff'}
                              {other?.username ? ` (@${other.username})` : ''}
                              {item.clubName ? ` · ${item.clubName}` : ''} —{' '}
                              {new Date(item.updatedAt).toLocaleString()}
                            </p>
                            {greyed ? (
                              <p className="text-[11px] text-gray-500 mt-1 italic">Deleted by the recipient</p>
                            ) : (
                              <p className="text-[11px] text-teal-800 mt-1 font-medium">
                                Reply: {item.replyCount}
                              </p>
                            )}
                          </div>
                        </button>
                        <div className="px-3 pb-2 flex justify-end">
                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={() => void removeThread(item)}
                            className="text-[11px] font-medium text-red-700 hover:underline disabled:opacity-40"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {totalPages > 1 ? (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border px-2 py-1 disabled:opacity-40"
                >
                  prev
                </button>
                <span>
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border px-2 py-1 disabled:opacity-40"
                >
                  next
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded border border-gray-300 bg-white overflow-hidden min-h-[320px]">
          <div className="px-3 py-2 border-b border-gray-200 text-sm font-semibold">Conversation</div>
          <div className="p-3">
            {!selectedId ? (
              <p className="text-sm text-gray-500">Select a message title to read the conversation.</p>
            ) : detailLoading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : detail ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null);
                    setDetail(null);
                  }}
                  className="inline-flex items-center gap-1 text-sm text-teal-800 font-medium lg:hidden"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <h3 className={`font-semibold ${detail.deletedByRecipient ? 'text-gray-500' : 'text-gray-900'}`}>
                  {detail.thread.subject}
                </h3>
                {detail.deletedByRecipient ? (
                  <p className="text-xs italic text-gray-500">
                    The recipient deleted this message; replies are no longer available.
                  </p>
                ) : null}
                <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {detail.messages.map((m) => {
                    const mine = Boolean(viewerId && m.sender?.id === viewerId);
                    const isFirst = m.id === detail.firstMessageId;
                    return (
                      <li
                        key={m.id}
                        className={`rounded border p-2 text-sm ${
                          mine ? 'border-teal-200 bg-teal-50' : 'border-gray-200 bg-gray-50'
                        } ${detail.deletedByRecipient ? 'opacity-50' : ''}`}
                      >
                        <div className="text-[11px] text-gray-500 mb-1">
                          {mine ? 'You' : m.sender?.name || detail.thread.authorName || 'Member'} ·{' '}
                          {new Date(m.createdAt).toLocaleString()}
                        </div>
                        <div className="whitespace-pre-wrap text-gray-900">{m.body}</div>
                        {mine && !isFirst ? (
                          <div className="flex justify-end mt-1">
                            <button
                              type="button"
                              onClick={() => void removeReply(m.id)}
                              className="text-[11px] font-medium text-red-700 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {detail.canReply ? (
                  <div className="space-y-2 pt-2 border-t">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={3}
                      placeholder="Write a reply…"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      disabled={replying || !reply.trim()}
                      onClick={() => void submitReply()}
                      className="rounded bg-teal-800 text-white px-3 py-1.5 text-sm disabled:opacity-40"
                    >
                      {replying ? 'Sending…' : 'Reply'}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Thread not found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
