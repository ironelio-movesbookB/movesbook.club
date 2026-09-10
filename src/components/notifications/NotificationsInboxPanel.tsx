'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import type { NotificationDto } from '@/lib/notifications/notificationService';

function userToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

type Props = {
  source: 'movesbook' | 'clubs';
};

export default function NotificationsInboxPanel({ source }: Props) {
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        source,
        page: String(page),
        pageSize: String(pageSize),
        q: search,
      });
      const res = await fetch(`/api/notifications?${qs}`, {
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
  }, [source, page, pageSize, search]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openItem(item: NotificationDto) {
    setExpandedId((v) => (v === item.id ? null : item.id));
    if (item.visited) return;
    const token = userToken();
    if (!token) return;
    await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'visit', id: item.id }),
    });
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, visited: true } : i)));
  }

  async function clearSection() {
    if (
      !confirm(
        'Clear section will hide all notifications older than 3 days. Notifications from the last 3 days stay and must be removed manually. Continue?',
      )
    ) {
      return;
    }
    const token = userToken();
    if (!token) return;
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'clear_section', source }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || 'Clear failed');
      return;
    }
    setPage(1);
    await load();
    alert(`Cleared ${data.cleared ?? 0} older notification(s).`);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const title =
    source === 'movesbook' ? 'Notifications by Movesbook' : 'Notifications by Club Staff';

  return (
    <div className="w-full p-4 md:p-6 text-gray-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/users/notification/all/all/movesbook"
            className={`rounded border px-3 py-1.5 ${
              source === 'movesbook'
                ? 'bg-teal-800 text-white border-teal-900'
                : 'bg-white text-gray-900 border-gray-300'
            }`}
          >
            By Movesbook
          </Link>
          <Link
            href="/users/notification/all/all/clubs"
            className={`rounded border px-3 py-1.5 ${
              source === 'clubs'
                ? 'bg-teal-800 text-white border-teal-900'
                : 'bg-white text-gray-900 border-gray-300'
            }`}
          >
            By Club Staff
          </Link>
          <button
            type="button"
            onClick={() => void clearSection()}
            className="rounded border border-gray-400 bg-white px-3 py-1.5 text-gray-900 hover:bg-gray-50"
            title="Hide notifications older than 3 days (keep last 3 days for manual review)"
          >
            Clear section
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title"
          className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white placeholder:text-gray-500"
        />
        <button
          type="button"
          onClick={() => {
            setPage(1);
            void load();
          }}
          className="rounded bg-neutral-800 px-3 py-1 text-sm text-white"
        >
          Proceed
        </button>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
        >
          {[5, 10, 20, 50].map((n) => (
            <option key={n} value={n} className="text-gray-900">
              {n}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No notifications.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={`rounded border bg-white ${item.visited ? 'border-gray-200' : 'border-teal-600'}`}
            >
              <button
                type="button"
                className="w-full text-left p-3"
                onClick={() => void openItem(item)}
              >
                <div className="flex items-center gap-2">
                  {item.prioritary ? <MapPin className="h-4 w-4 text-red-600" /> : null}
                  <span className="font-semibold text-gray-900">{item.title}</span>
                  {!item.visited ? (
                    <span className="text-[10px] uppercase tracking-wide bg-teal-700 text-white px-1.5 py-0.5 rounded">
                      new
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {item.submittedByName || item.submittedByUsername || 'Staff'} ·{' '}
                  {item.createdAt.slice(0, 10)} · until {item.untilDate}
                </p>
              </button>
              {expandedId === item.id ? (
                <div className="border-t px-3 py-2 text-sm">
                  {item.path ? (
                    <p className="mb-2">
                      <a href={item.path} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                        Open link
                      </a>
                    </p>
                  ) : null}
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: item.description }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center gap-2 text-sm text-gray-900">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 disabled:opacity-40"
        >
          prev
        </button>
        <span className="text-gray-900">
          {page} / {totalPages} ({total})
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 disabled:opacity-40"
        >
          next
        </button>
      </div>
    </div>
  );
}
