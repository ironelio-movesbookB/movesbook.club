'use client';

import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getAuthToken } from '@/utils/auth.utils';
import { sponsorWorkspaceId } from '@/lib/club/sponsors/sponsorClient';

type MemberOption = { id: string; userId: string; name: string; username?: string };

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  bodyHtml: string;
  /** Optional absolute or site path for the invite link (appended to body). */
  inviteUrl?: string;
  /** Pre-check every member and ask for confirmation before posting (shown at their login). */
  allMembers?: boolean;
};

/** Post an invite into selected members' "Alert posted" section (staff note). */
export default function PostInviteToMovesbookModal({
  open,
  onClose,
  title,
  bodyHtml,
  inviteUrl,
  allMembers = false,
}: Props) {
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const clubId = sponsorWorkspaceId();
    if (!clubId) {
      setMessage('Select a club or team first');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/clubs/${encodeURIComponent(clubId)}/members`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load members');
      const list = (data.members || []) as Array<Record<string, unknown>>;
      const mapped = list
        .map((m) => {
          const member = (m.member || {}) as Record<string, unknown>;
          return {
            id: String(m.id || ''),
            userId: String(member.id || m.memberId || ''),
            name: String(member.name || member.username || 'Member'),
            username: member.username ? String(member.username) : undefined,
          };
        })
        .filter((m) => m.id);
      setMembers(mapped);
      if (allMembers) setSelected(new Set(mapped.map((m) => m.id)));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not load members');
    } finally {
      setLoading(false);
    }
  }, [allMembers]);

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      void load();
    }
  }, [open, load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const post = async () => {
    const clubId = sponsorWorkspaceId();
    if (!clubId || !selected.size) return;
    if (
      allMembers &&
      !window.confirm(
        `Post this as a message shown at login to ${
          selected.size === members.length ? 'all' : selected.size
        } member(s) of the club/team?`,
      )
    ) {
      return;
    }
    setPosting(true);
    setMessage('');
    const token = getAuthToken();
    const linkBlock = inviteUrl
      ? `<p><a href="${inviteUrl}" target="_blank" rel="noopener noreferrer">${inviteUrl}</a></p>`
      : '';
    const body = `${bodyHtml}${linkBlock}`;
    let ok = 0;
    let fail = 0;
    for (const membershipId of selected) {
      try {
        const res = await fetch(
          `/api/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(membershipId)}/notes`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              kind: 'staff',
              title: title.slice(0, 191),
              body,
              visibleToMember: true,
              commentsEnabled: false,
              showAtLogin: true,
            }),
          },
        );
        if (res.ok) ok += 1;
        else fail += 1;
      } catch {
        fail += 1;
      }
    }
    setPosting(false);
    setMessage(`Posted to ${ok} member(s)${fail ? `, ${fail} failed` : ''}.`);
    if (ok && !fail) window.setTimeout(onClose, 900);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Post on Movesbook</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
          <p className="text-sm text-gray-600">
            Send this invite into the selected members&apos; <strong>Alert posted</strong> section (same as Member Profile).
          </p>
          <p className="rounded bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">{title}</p>
          {loading ? <p className="text-sm text-gray-500">Loading members…</p> : null}
          {members.length ? (
            <label className="flex items-center gap-2 px-2 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                checked={selected.size === members.length}
                onChange={(e) => setSelected(e.target.checked ? new Set(members.map((m) => m.id)) : new Set())}
              />
              Select all ({members.length})
            </label>
          ) : null}
          <ul className="max-h-64 space-y-1 overflow-y-auto rounded border border-gray-200 p-2">
            {members.map((m) => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                  <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                  <span>
                    {m.name}
                    {m.username ? <span className="text-gray-500"> (@{m.username})</span> : null}
                  </span>
                </label>
              </li>
            ))}
            {!loading && !members.length ? (
              <li className="px-2 py-4 text-center text-sm text-gray-500">No members found</li>
            ) : null}
          </ul>
          {message ? <p className="text-sm text-blue-700">{message}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected.size || posting}
            onClick={() => void post()}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {posting ? 'Posting…' : `Post to ${selected.size || 0}`}
          </button>
        </div>
      </div>
    </div>
  );
}
