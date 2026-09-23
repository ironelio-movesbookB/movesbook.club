'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getAuthToken } from '@/utils/auth.utils';

type ClubOption = { id: string; name: string; role: 'admin' | 'staff' | 'member' };

type MessageItem = {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: string;
  messageCount: number;
  replyCount: number;
  author: string;
  authorUsername: string | null;
  authorImage: string | null;
  isOwner: boolean;
};

type ThreadDetail = {
  thread: {
    id: string;
    subject: string;
    authorName?: string;
  };
  messages: Array<{
    id: string;
    body: string;
    isStaff: boolean;
    createdAt: string;
    sender?: { id: string; name: string; username: string } | null;
  }>;
};

type Props = {
  /** Club admin inbox mode */
  receivedView?: boolean;
  initialClubId?: string | null;
};

export default function ClubStaffMessagesPanel({
  receivedView = false,
  initialClubId = null,
}: Props) {
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [clubId, setClubId] = useState(initialClubId || '');
  const [items, setItems] = useState<MessageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isClubAdmin, setIsClubAdmin] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const token = () => getAuthToken();

  const loadClubs = useCallback(async () => {
    const t = token();
    if (!t) return;
    const res = await fetch('/api/club/messages?clubs=1', {
      headers: { Authorization: `Bearer ${t}` },
      cache: 'no-store',
    });
    if (!res.ok) return;
    const data = await res.json();
    const list: ClubOption[] = data.clubs || [];
    setClubs(list);
    setClubId((prev) => {
      if (prev && list.some((c) => c.id === prev)) return prev;
      if (initialClubId && list.some((c) => c.id === initialClubId)) return initialClubId;
      return list[0]?.id || '';
    });
  }, [initialClubId]);

  const loadList = useCallback(async () => {
    const t = token();
    if (!t || !clubId) {
      setLoading(false);
      setItems([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({
        clubId,
        page: String(page),
        pageSize: '10',
      });
      if (receivedView) qs.set('received', '1');
      else qs.set('mine', '1');
      const res = await fetch(`/api/club/messages?${qs}`, {
        headers: { Authorization: `Bearer ${t}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setItems(data.items || []);
      setTotal(data.total || 0);
      setIsClubAdmin(Boolean(data.access?.isClubAdmin));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [clubId, page, receivedView]);

  useEffect(() => {
    void loadClubs();
  }, [loadClubs]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function openThread(id: string) {
    const t = token();
    if (!t) return;
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
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

  async function submitCompose() {
    const t = token();
    if (!t || !clubId || !body.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/club/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${t}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clubId, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post');
      setComposeOpen(false);
      setSubject('');
      setBody('');
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
    const t = token();
    if (!t || !selectedId || !reply.trim()) return;
    setReplying(true);
    try {
      const res = await fetch(`/api/messages/threads/${selectedId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${t}`,
          'Content-Type': 'application/json',
        },
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

  async function removeThread(id: string) {
    if (!window.confirm('Delete this message? This cannot be undone.')) return;
    const t = token();
    if (!t) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/club/messages?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete');
      }
      if (selectedId === id) {
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

  const totalPages = Math.max(1, Math.ceil(total / 10));
  const showReceived = receivedView || isClubAdmin;

  return (
    <div className="w-full p-4 md:p-6 text-gray-900">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {clubs.length > 1 ? (
            <label className="block text-sm">
              <span className="text-gray-600 text-xs font-medium">Club</span>
              <select
                value={clubId}
                onChange={(e) => {
                  setClubId(e.target.value);
                  setPage(1);
                  setSelectedId(null);
                  setDetail(null);
                }}
                className="mt-1 block w-full min-w-[200px] border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
              >
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.role === 'admin' || c.role === 'staff' ? ` (${c.role})` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : clubs[0] ? (
            <p className="text-sm text-gray-600">{clubs[0].name}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setComposeOpen(true)}
          className="rounded border border-red-700 text-red-700 px-3 py-1.5 text-sm font-medium hover:bg-red-50"
        >
          {showReceived ? 'Post messages for the Club Staff' : 'Leave a message for club staff'}
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}

      {composeOpen ? (
        <div className="mb-4 rounded border border-gray-300 bg-white p-4 space-y-3">
          <h2 className="font-semibold text-gray-900">New message for club staff</h2>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (optional)"
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
              onClick={() => setComposeOpen(false)}
              className="px-3 py-1.5 text-sm rounded border border-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !body.trim() || !clubId}
              onClick={() => void submitCompose()}
              className="px-3 py-1.5 text-sm rounded bg-teal-800 text-white disabled:opacity-40"
            >
              {saving ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded border border-gray-300 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200 text-sm font-semibold">
            {showReceived ? 'Messages received by the members' : 'Your messages to club staff'} ({total})
          </div>
          <div className="p-3 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : !clubId ? (
              <p className="text-sm text-gray-500">Join or select a club to use club staff messages.</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">No messages yet.</p>
            ) : (
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.id}>
                    <div
                      className={`rounded border overflow-hidden ${
                        selectedId === item.id ? 'border-teal-600 bg-teal-50/40' : 'border-gray-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void openThread(item.id)}
                        className="w-full text-left p-3 flex gap-2"
                      >
                        {item.authorImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.authorImage}
                            alt=""
                            className="h-11 w-11 rounded object-cover shrink-0 bg-gray-200"
                          />
                        ) : (
                          <div className="h-11 w-11 rounded bg-gray-200 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm text-gray-900">{item.title}</div>
                          {item.excerpt ? (
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.excerpt}</p>
                          ) : null}
                          <p className="text-[11px] text-gray-500 mt-1">
                            {item.author}
                            {item.authorUsername ? ` (@${item.authorUsername})` : ''} —{' '}
                            {new Date(item.updatedAt).toLocaleString()}
                          </p>
                          <p className="text-[11px] text-teal-800 mt-1 font-medium">
                            Reply: {item.replyCount}
                          </p>
                        </div>
                      </button>
                      <div className="px-3 pb-2 flex justify-end">
                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => void removeThread(item.id)}
                          className="text-[11px] font-medium text-red-700 hover:underline disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
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
              <p className="text-sm text-gray-500">Select a message to read and reply.</p>
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
                  className="inline-flex items-center gap-1 text-sm text-teal-800 font-medium"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <h3 className="font-semibold text-gray-900">{detail.thread.subject}</h3>
                <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {detail.messages.map((m) => (
                    <li
                      key={m.id}
                      className={`rounded border p-2 text-sm ${
                        m.isStaff ? 'border-teal-200 bg-teal-50' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="text-[11px] text-gray-500 mb-1">
                        {m.isStaff
                          ? m.sender?.name || 'Club staff'
                          : m.sender?.name || detail.thread.authorName || 'Member'}{' '}
                        · {new Date(m.createdAt).toLocaleString()}
                      </div>
                      <div className="whitespace-pre-wrap text-gray-900">{m.body}</div>
                    </li>
                  ))}
                </ul>
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
