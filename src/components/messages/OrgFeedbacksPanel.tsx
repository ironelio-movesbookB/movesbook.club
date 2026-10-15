'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, MessageSquarePlus, Trash2 } from 'lucide-react';
import { getAuthToken } from '@/utils/auth.utils';

type Scope = 'mine' | 'manage';

type FeedbackOrg = { kind: 'club' | 'team'; id: string; name: string; role: string };

type FeedbackItem = {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: string;
  createdAt: string;
  replyCount: number;
  orgKind: 'club' | 'team' | null;
  orgName: string;
  author: { id: string; name: string } | null;
  awaitingReply: boolean;
};

type ThreadDetail = {
  thread: { id: string; subject: string; createdAt: string; authorName: string };
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    isStaff: boolean;
    sender: { id: string; name: string } | null;
  }>;
  orgKind: 'club' | 'team';
  role: 'creator' | 'manager';
};

type Props = {
  scope: Scope;
  onClose?: () => void;
};

const PAGE_SIZE = 10;

function orgKey(org: Pick<FeedbackOrg, 'kind' | 'id'>): string {
  return `${org.kind}:${org.id}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Request failed');
  return data as T;
}

/** Feedbacks between club/team members and their club/team (members: own threads, staff: all threads). */
export default function OrgFeedbacksPanel({ scope, onClose }: Props) {
  const isManage = scope === 'manage';
  const [orgs, setOrgs] = useState<FeedbackOrg[]>([]);
  const [filterOrg, setFilterOrg] = useState('');
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [reply, setReply] = useState('');
  const [composing, setComposing] = useState(false);
  const [newOrg, setNewOrg] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ scope, page: String(page), pageSize: String(PAGE_SIZE) });
      if (filterOrg) qs.set('org', filterOrg);
      const data = await api<{ items: FeedbackItem[]; total: number; orgs: FeedbackOrg[] }>(
        `/api/messages/org-feedbacks?${qs}`,
      );
      setItems(data.items);
      setTotal(data.total);
      setOrgs(data.orgs);
      setNewOrg((prev) => prev || (data.orgs[0] ? orgKey(data.orgs[0]) : ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [scope, page, filterOrg]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openThread = useCallback(async (id: string) => {
    setOpenId(id);
    setDetail(null);
    setReply('');
    try {
      setDetail(await api<ThreadDetail>(`/api/messages/threads/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open the feedback');
      setOpenId(null);
    }
  }, []);

  const sendReply = async () => {
    if (!openId || !reply.trim()) return;
    setBusy(true);
    try {
      setDetail(
        await api<ThreadDetail>(`/api/messages/threads/${openId}`, {
          method: 'POST',
          body: JSON.stringify({ body: reply.trim() }),
        }),
      );
      setReply('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reply');
    } finally {
      setBusy(false);
    }
  };

  const deleteThread = async (id: string) => {
    if (!window.confirm('Delete this feedback and all its replies?')) return;
    setBusy(true);
    try {
      await api(`/api/messages/threads/${id}`, { method: 'DELETE' });
      setOpenId(null);
      setDetail(null);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setBusy(false);
    }
  };

  const sendNew = async () => {
    const org = orgs.find((o) => orgKey(o) === newOrg);
    if (!org || !newBody.trim()) {
      setError('Choose the club/team and write your feedback.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/api/messages/org-feedbacks', {
        method: 'POST',
        body: JSON.stringify({ orgKind: org.kind, orgId: org.id, subject: newSubject, body: newBody }),
      });
      setComposing(false);
      setNewSubject('');
      setNewBody('');
      setPage(1);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setBusy(false);
    }
  };

  const title = isManage ? 'Messages-Feedbacks with Members' : 'Messages-Feedbacks with Club\\Team';
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex w-full flex-1 min-h-0 flex-col rounded border border-gray-300 bg-white">
      <div className="flex items-center justify-between gap-2 bg-[#7a1f2e] px-4 py-2 text-white">
        <h2 className="text-sm font-bold uppercase tracking-wide">{title}</h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/60 px-2 py-0.5 text-xs font-semibold hover:bg-white/10"
          >
            Close
          </button>
        ) : null}
      </div>

      {error ? <p className="px-4 pt-3 text-sm text-red-700">{error}</p> : null}

      {openId ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setOpenId(null);
                void loadList();
              }}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#7a1f2e] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Back to the list
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void deleteThread(openId)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
          {!detail ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <>
              <h3 className="text-base font-bold text-gray-900">{detail.thread.subject || 'Feedback'}</h3>
              <p className="mb-4 text-xs text-gray-500">
                {detail.thread.authorName} · {formatDate(detail.thread.createdAt)}
              </p>
              <ul className="space-y-3">
                {detail.messages.map((m) => (
                  <li
                    key={m.id}
                    className={`rounded border px-3 py-2 ${
                      m.isStaff ? 'border-sky-200 bg-sky-50' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                      <span className="font-semibold text-gray-800">{m.sender?.name || 'Member'}</span>
                      {m.isStaff ? (
                        <span className="rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                          {detail.orgKind === 'team' ? 'Team staff' : 'Club staff'}
                        </span>
                      ) : null}
                      <span>{formatDate(m.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-gray-800">{m.body}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={4}
                  placeholder="Write a reply…"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={busy || !reply.trim()}
                    onClick={() => void sendReply()}
                    className="rounded bg-[#7a1f2e] px-4 py-1.5 text-sm font-bold text-white hover:bg-[#5c1824] disabled:opacity-50"
                  >
                    Reply
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {orgs.length > 1 ? (
              <select
                value={filterOrg}
                onChange={(e) => {
                  setFilterOrg(e.target.value);
                  setPage(1);
                }}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="">All clubs and teams</option>
                {orgs.map((o) => (
                  <option key={orgKey(o)} value={orgKey(o)}>
                    {o.kind === 'team' ? 'Team' : 'Club'} — {o.name}
                  </option>
                ))}
              </select>
            ) : null}
            {!isManage && orgs.length > 0 ? (
              <button
                type="button"
                onClick={() => setComposing((v) => !v)}
                className="ml-auto inline-flex items-center gap-1 rounded bg-[#7a1f2e] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#5c1824]"
              >
                <MessageSquarePlus className="h-4 w-4" /> New feedback
              </button>
            ) : null}
          </div>

          {composing ? (
            <div className="mb-4 space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
              <select
                value={newOrg}
                onChange={(e) => setNewOrg(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                {orgs.map((o) => (
                  <option key={orgKey(o)} value={orgKey(o)}>
                    {o.kind === 'team' ? 'Team' : 'Club'} — {o.name}
                  </option>
                ))}
              </select>
              <input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                maxLength={200}
                placeholder="Subject"
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
              />
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={5}
                placeholder="Write your feedback for the club/team admins and staff…"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setComposing(false)}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void sendNew()}
                  className="rounded bg-[#7a1f2e] px-4 py-1.5 text-sm font-bold text-white hover:bg-[#5c1824] disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          ) : null}

          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : orgs.length === 0 ? (
            <p className="text-sm text-gray-600">
              {isManage
                ? 'You are not the admin or staff of any club or team.'
                : 'You are not a member of any club or team yet.'}
            </p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-600">No feedbacks yet.</p>
          ) : (
            <ul className="divide-y divide-gray-200 rounded border border-gray-200">
              {items.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => void openThread(it.id)}
                    className="block w-full px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{it.title}</span>
                      {isManage && it.awaitingReply ? (
                        <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                          To answer
                        </span>
                      ) : null}
                      <span className="ml-auto text-xs text-gray-500">{formatDate(it.updatedAt)}</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      {it.orgKind === 'team' ? 'Team' : 'Club'} {it.orgName}
                      {isManage && it.author ? ` · from ${it.author.name}` : ''} · {it.replyCount}{' '}
                      {it.replyCount === 1 ? 'reply' : 'replies'}
                    </p>
                    {it.excerpt ? <p className="mt-0.5 text-sm text-gray-700">{it.excerpt}</p> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {pages > 1 ? (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-gray-300 px-2 py-0.5 disabled:opacity-40"
              >
                Prev
              </button>
              <span>
                {page} / {pages}
              </span>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-gray-300 px-2 py-0.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
