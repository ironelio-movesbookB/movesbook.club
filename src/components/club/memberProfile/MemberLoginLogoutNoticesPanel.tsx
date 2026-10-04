'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, Loader2, LogOut } from 'lucide-react';

export type MemberNoticeMoment = 'login' | 'logout';

type NoticeItem = {
  id: string;
  kind?: 'coach' | 'staff';
  title: string;
  body: string;
  bodyIsHtml: boolean;
  clubName: string;
  enableFrom: string;
  enableTo: string;
};

type Props = {
  moment: MemberNoticeMoment;
};

function stripHtmlPreview(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Grid of active (not expired) login/logout notices for the signed-in member.
 * Uses the same source/rules as the login/logout popup host.
 */
export default function MemberLoginLogoutNoticesPanel({ moment }: Props) {
  const [items, setItems] = useState<NoticeItem[]>([]);
  const [today, setToday] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isLogin = moment === 'login';
  const title = isLogin ? 'Alerts and notices at login' : 'Message at logout';
  const blurb = isLogin
    ? 'Club and team alerts scheduled to show when you sign in. Expired notices are hidden.'
    : 'Club and team messages scheduled to show when you sign out. Expired messages are hidden.';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please sign in to view these messages.');
        setItems([]);
        return;
      }
      const res = await fetch(`/api/user/member-note-popups?moment=${moment}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === 'string' ? json.error : 'Failed to load messages',
        );
      }
      const list = Array.isArray(json.items) ? (json.items as NoticeItem[]) : [];
      setItems(list);
      setToday(typeof json.today === 'string' ? json.today : '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load messages');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [moment]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="w-full p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            {isLogin ? (
              <Bell className="h-5 w-5 text-sky-700" aria-hidden />
            ) : (
              <LogOut className="h-5 w-5 text-sky-700" aria-hidden />
            )}
            {title}
          </h1>
          <p className="mt-1 text-sm text-gray-600">{blurb}</p>
          {today ? (
            <p className="mt-1 text-xs text-gray-500">Active as of {today}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading messages…
        </div>
      ) : error ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-600">
          No active {isLogin ? 'login notices' : 'logout messages'} right now.
          <span className="mt-1 block text-xs text-gray-500">
            Expired items are not listed here.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const open = expandedId === item.id;
            const preview = item.bodyIsHtml
              ? stripHtmlPreview(item.body)
              : item.body.trim();
            return (
              <article
                key={item.id}
                className="flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm"
              >
                <div className="border-b border-sky-100 bg-sky-50 px-3 py-2">
                  {item.kind === 'coach' ? (
                    <p className="mb-0.5 text-sm font-bold text-red-600">Message by the Coach</p>
                  ) : null}
                  <h2 className="text-sm font-semibold text-gray-900">
                    {item.title || (isLogin ? 'Notice' : 'Message')}
                  </h2>
                  <p className="text-xs text-gray-600">{item.clubName}</p>
                  {(item.enableFrom || item.enableTo) && (
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      Valid {item.enableFrom || '…'} → {item.enableTo || '…'}
                    </p>
                  )}
                </div>
                <div className="flex flex-1 flex-col px-3 py-3">
                  {open ? (
                    item.bodyIsHtml ? (
                      <div
                        className="prose prose-sm max-w-none text-gray-800"
                        dangerouslySetInnerHTML={{ __html: item.body }}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm text-gray-800">
                        {item.body}
                      </p>
                    )
                  ) : (
                    <p className="line-clamp-4 text-sm text-gray-700">
                      {preview || '—'}
                    </p>
                  )}
                  <button
                    type="button"
                    className="mt-3 self-start text-xs font-semibold text-sky-800 hover:underline"
                    onClick={() =>
                      setExpandedId((id) => (id === item.id ? null : item.id))
                    }
                  >
                    {open ? 'Show less' : 'Read full message'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
