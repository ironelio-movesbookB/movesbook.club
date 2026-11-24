'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDownAZ,
  Clock,
  ExternalLink,
  Globe,
  Loader2,
  Newspaper,
  Search,
  X,
} from 'lucide-react';
import type { GlobalNewsFeedItem } from '@/lib/globalNewsAuth';
import { resolveIsSuperAdminFromStorage } from '@/lib/panelSession';
import NewsFeedMetaLine from '@/components/news/NewsFeedMetaLine';

type GlobalKindFilter = 'all' | 'news' | 'ogp' | 'ogp-group';
type SortMode = 'date-desc' | 'date-asc' | 'alpha-asc' | 'alpha-desc';
/** Posted-by radio filter (empty = show all). Superadmin Global News uses users/movesbook/country. */
type PostedByFilter = '' | 'users' | 'movesbook' | 'my-country';

const POSTED_BY_OPTIONS: { value: Exclude<PostedByFilter, ''>; label: string }[] = [
  { value: 'users', label: 'posted by users' },
  { value: 'movesbook', label: 'posted by movesbook' },
  { value: 'my-country', label: 'posted by my country' },
];

const KIND_FILTER_OPTIONS: { value: GlobalKindFilter; label: string }[] = [
  { value: 'all', label: 'Select' },
  { value: 'news', label: 'News' },
  { value: 'ogp', label: 'OGP News' },
  { value: 'ogp-group', label: 'OGP Group' },
];

const ROWS_PER_PAGE = 10;

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function itemTitle(item: GlobalNewsFeedItem) {
  if (item.title?.trim()) return item.title.trim();
  if (item.kind === 'ogp' || item.kind === 'ogp-group') {
    return item.customDescription?.trim() || item.description?.trim() || item.url;
  }
  return 'Untitled';
}

function itemSearchText(item: GlobalNewsFeedItem): string {
  const parts: string[] = [itemTitle(item)];
  if (item.kind === 'news') {
    parts.push(item.author ?? '', item.categoryName ?? '', item.method ?? '', item.briefDesc ?? '');
  } else if (item.kind === 'ogp') {
    parts.push(
      item.topic,
      item.creatorUsername ?? '',
      item.description ?? '',
      item.customDescription ?? '',
      item.url ?? '',
    );
  } else {
    parts.push(
      item.topic,
      item.creatorUsername ?? '',
      item.description ?? '',
      item.customDescription ?? '',
      String(item.memberCount ?? ''),
    );
  }
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function itemPosterUserId(item: GlobalNewsFeedItem): string | null {
  return item.posterUserId?.trim() || null;
}

function getExpiresAtMs(item: GlobalNewsFeedItem): number | null {
  if (!item.expiresAt) return null;
  const ms = new Date(item.expiresAt).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isNotExpired(item: GlobalNewsFeedItem): boolean {
  const expMs = getExpiresAtMs(item);
  if (expMs == null) return true;
  return expMs >= Date.now();
}

function hasExpirationDateSet(item: GlobalNewsFeedItem): boolean {
  return getExpiresAtMs(item) != null;
}

function isPastExpired(item: GlobalNewsFeedItem): boolean {
  return hasExpirationDateSet(item) && !isNotExpired(item);
}

function highlightText(text: string, query: string): ReactNode {
  if (!text) return '';
  if (!query || !query.trim()) return text;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(re);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded bg-amber-200 px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export default function AdminGlobalNewsContent({
  closeHref = '/admin/dashboard',
}: {
  closeHref?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<GlobalNewsFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [currentUserCountry, setCurrentUserCountry] = useState('');
  const [movesbookUserIds, setMovesbookUserIds] = useState<string[]>([]);
  const [kindFilter, setKindFilter] = useState<GlobalKindFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightMatches, setHighlightMatches] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortMode, setSortMode] = useState<SortMode>('date-desc');
  const [postedByFilter, setPostedByFilter] = useState<PostedByFilter>('');
  const [excludeExpiredAndDeleted, setExcludeExpiredAndDeleted] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const movesbookIdSet = useMemo(() => new Set(movesbookUserIds), [movesbookUserIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('superAdminUser') && !resolveIsSuperAdminFromStorage()) {
      router.replace('/admin/dashboard');
      return;
    }
    setAuthChecked(true);
  }, [router]);

  const loadItems = useCallback(async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/global-news?includeDeleted=1', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load global news');
      const data = (await res.json()) as {
        items?: GlobalNewsFeedItem[];
        currentUserCountry?: string | null;
        movesbookUserIds?: string[];
      };
      setItems(Array.isArray(data.items) ? data.items : []);
      setCurrentUserCountry((data.currentUserCountry ?? '').trim().toLowerCase());
      setMovesbookUserIds(data.movesbookUserIds ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setItems([]);
      setCurrentUserCountry('');
      setMovesbookUserIds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authChecked) void loadItems();
  }, [authChecked, loadItems]);

  const filteredItems = useMemo(() => {
    let result = items;

    if (kindFilter !== 'all') {
      result = result.filter((item) => item.kind === kindFilter);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((item) => itemSearchText(item).includes(q));
    }

    if (postedByFilter === 'users') {
      // Non-Movesbook creators (mirrors Global OGP “users” audience scope).
      result = result.filter((item) => {
        const id = itemPosterUserId(item);
        return !id || !movesbookIdSet.has(id);
      });
    } else if (postedByFilter === 'movesbook') {
      result = result.filter((item) => {
        const id = itemPosterUserId(item);
        return Boolean(id && movesbookIdSet.has(id));
      });
    } else if (postedByFilter === 'my-country') {
      result = result.filter((item) => {
        const creatorCountry = (item.creatorCountry ?? '').trim().toLowerCase();
        return Boolean(currentUserCountry && creatorCountry && creatorCountry === currentUserCountry);
      });
    }

    if (excludeExpiredAndDeleted) {
      result = result.filter((item) => !item.deletedAt && isNotExpired(item));
    } else {
      if (showExpired) {
        result = result.filter(isPastExpired);
        if (!showDeleted) {
          result = result.filter((item) => !item.deletedAt);
        }
      }
      if (showDeleted) {
        result = result.filter((item) => Boolean(item.deletedAt));
      }
    }

    const sorted = [...result];
    sorted.sort((a, b) => {
      if (sortMode === 'alpha-asc' || sortMode === 'alpha-desc') {
        const cmp = itemTitle(a).localeCompare(itemTitle(b), undefined, {
          sensitivity: 'base',
        });
        return sortMode === 'alpha-asc' ? cmp : -cmp;
      }
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortMode === 'date-asc' ? diff : -diff;
    });

    return sorted;
  }, [
    items,
    kindFilter,
    searchQuery,
    postedByFilter,
    currentUserCountry,
    movesbookIdSet,
    excludeExpiredAndDeleted,
    showExpired,
    showDeleted,
    sortMode,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ROWS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredItems.slice(start, start + ROWS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const applyShow = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const handleRemove = useCallback(async (item: GlobalNewsFeedItem) => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;
    const path =
      item.kind === 'news'
        ? `/api/admin/global-news/news/${item.id}`
        : item.kind === 'ogp-group'
          ? `/api/admin/global-news/ogp-group/${item.id}`
          : `/api/admin/global-news/ogp/${item.id}`;
    try {
      const res = await fetch(path, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inGlobalNews: false }),
      });
      if (!res.ok) throw new Error('Failed to remove');
      setItems((prev) => prev.filter((x) => !(x.kind === item.kind && x.id === item.id)));
    } catch {
      setError('Could not remove from Global News');
    }
  }, []);

  if (!authChecked) return null;

  return (
    <div className="flex min-h-[70vh] flex-col bg-gray-50">
      <div className="flex flex-wrap items-center gap-2 bg-red-800 p-3">
        <div className="flex min-w-[140px] max-w-[220px] flex-1 items-center rounded border border-gray-600 bg-gray-700">
          <Search className="ml-2 h-4 w-4 flex-shrink-0 text-gray-400" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyShow();
            }}
            className="w-full bg-transparent px-2 py-1.5 text-sm text-white outline-none placeholder:text-gray-400"
            aria-label="Search news"
          />
        </div>
        <button
          type="button"
          onClick={() => setHighlightMatches((m) => !m)}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            highlightMatches
              ? 'bg-amber-400 text-amber-900 hover:bg-amber-500'
              : 'bg-white text-gray-800 hover:bg-gray-100'
          }`}
          title={highlightMatches ? 'Hide highlights' : 'Highlight search matches in results'}
          aria-pressed={highlightMatches}
        >
          Highlight
        </button>
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage >= totalPages}
          className="rounded bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          next
        </button>
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          className="rounded bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          prev
        </button>
        <select
          value={kindFilter}
          onChange={(e) => {
            setKindFilter(e.target.value as GlobalKindFilter);
            setCurrentPage(1);
          }}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800"
          aria-label="Filter by type"
        >
          {KIND_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={applyShow}
          className="rounded bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          title="Show"
        >
          Show
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              setSortMode((s) => (s === 'alpha-asc' ? 'alpha-desc' : 'alpha-asc'))
            }
            className={`rounded-full p-2 transition-colors ${
              sortMode === 'alpha-asc' || sortMode === 'alpha-desc'
                ? 'bg-amber-500 text-amber-900'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Sort alphabetically"
            aria-label="Sort alphabetically"
          >
            <ArrowDownAZ className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() =>
              setSortMode((s) => (s === 'date-desc' ? 'date-asc' : 'date-desc'))
            }
            className={`rounded-full p-2 transition-colors ${
              sortMode === 'date-desc' || sortMode === 'date-asc'
                ? 'bg-amber-500 text-amber-900'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Sort by date"
            aria-label="Sort by date"
          >
            <Clock className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <Globe className="h-5 w-5 shrink-0 text-teal-700" />
        <h1 className="text-lg font-semibold text-gray-900">Global News</h1>
        <p className="hidden text-sm text-gray-500 sm:block">
          News and OGP News shared here, sorted by date
        </p>
        <Link
          href={closeHref}
          className="ml-auto shrink-0 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-700 bg-gray-800 px-4 py-2.5 text-sm">
        <label className="inline-flex cursor-pointer items-center gap-1.5 select-none">
          <input
            type="radio"
            name="admin-global-exclude-expired-deleted"
            checked={excludeExpiredAndDeleted}
            onChange={() => {
              setExcludeExpiredAndDeleted(true);
              setShowExpired(false);
              setShowDeleted(false);
              setCurrentPage(1);
            }}
            onClick={() => {
              if (excludeExpiredAndDeleted) {
                setExcludeExpiredAndDeleted(false);
                setCurrentPage(1);
              }
            }}
            className="h-3.5 w-3.5 border-gray-400 text-cyan-600 focus:ring-cyan-500"
            aria-label="Exclude expired & deleted"
          />
          <span className="whitespace-nowrap text-white">Exclude expired & deleted</span>
        </label>

        <fieldset className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
          <legend className="sr-only">Filter by poster and status</legend>
          {POSTED_BY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="inline-flex cursor-pointer items-center gap-1.5 select-none"
            >
              <input
                type="radio"
                name="admin-global-posted-by"
                value={opt.value}
                checked={postedByFilter === opt.value}
                onChange={() => {
                  setPostedByFilter(opt.value);
                  setCurrentPage(1);
                }}
                onClick={() => {
                  if (postedByFilter === opt.value) {
                    setPostedByFilter('');
                    setCurrentPage(1);
                  }
                }}
                className="h-3.5 w-3.5 border-gray-400 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="whitespace-nowrap text-white">{opt.label}</span>
            </label>
          ))}
          <label className="inline-flex cursor-pointer items-center gap-1.5 select-none">
            <input
              type="checkbox"
              checked={showExpired}
              onChange={(e) => {
                setShowExpired(e.target.checked);
                if (e.target.checked) setExcludeExpiredAndDeleted(false);
                setCurrentPage(1);
              }}
              className="h-3.5 w-3.5 rounded border-gray-400 text-cyan-600 focus:ring-cyan-500"
              aria-label="Show expired"
            />
            <span className="whitespace-nowrap text-yellow-300">Show expired</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 select-none">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => {
                setShowDeleted(e.target.checked);
                if (e.target.checked) setExcludeExpiredAndDeleted(false);
                setCurrentPage(1);
              }}
              className="h-3.5 w-3.5 rounded border-gray-400 text-cyan-600 focus:ring-cyan-500"
              aria-label="Show deleted"
            />
            <span className="whitespace-nowrap text-yellow-300">Show deleted</span>
          </label>
        </fieldset>
      </div>

      <div className="mx-auto w-full max-w-5xl flex-1 p-4">
        {loading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading global news…
          </div>
        ) : error ? (
          <p className="mb-4 text-sm text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <Globe className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-medium text-gray-600">No items in Global News yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Use &quot;Share in Global News&quot; on News, OGP News, or OGP groups to add items here.
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <Globe className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-medium text-gray-600">No matching items</p>
            <p className="mt-1 text-sm text-gray-500">
              Try a different filter or search term.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {pageItems.map((item) => {
              const title = itemTitle(item);
              const showHighlight = highlightMatches && Boolean(searchQuery.trim());
              const viewHref =
                item.kind === 'news'
                  ? `/news-by-movesbook/${item.id}`
                  : item.kind === 'ogp-group'
                    ? `/news/group/${item.id}`
                    : item.url || `/admin/news/links`;

              return (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={
                          item.kind === 'news' &&
                          item.image &&
                          !item.image.startsWith('/') &&
                          !item.image.startsWith('http')
                            ? `/img/news/${item.image}`
                            : item.image
                        }
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-400">
                        {item.kind === 'news' ? (
                          <Newspaper className="h-8 w-8" />
                        ) : (
                          <Globe className="h-8 w-8" />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                          item.kind === 'news'
                            ? 'bg-blue-100 text-blue-800'
                            : item.kind === 'ogp-group'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-teal-100 text-teal-800'
                        }`}
                      >
                        {item.kind === 'news'
                          ? 'News'
                          : item.kind === 'ogp-group'
                            ? 'OGP Group'
                            : 'OGP News'}
                      </span>
                      <span className="text-xs text-gray-500">{formatDate(item.date)}</span>
                      {item.deletedAt ? (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Deleted
                        </span>
                      ) : null}
                      {!item.deletedAt && isPastExpired(item) ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Expired
                        </span>
                      ) : null}
                    </div>

                    <h2 className="line-clamp-2 text-base font-semibold text-gray-900">
                      {showHighlight ? highlightText(title, searchQuery) : title}
                    </h2>

                    <NewsFeedMetaLine
                      kind={item.kind}
                      sector={item.kind === 'news' ? item.categoryName : item.topic}
                      mode={item.kind === 'news' ? item.method : null}
                      postedBy={item.kind === 'news' ? item.author : item.creatorUsername}
                    />

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Link
                        href={viewHref}
                        target={item.kind === 'ogp' ? '_blank' : undefined}
                        rel={item.kind === 'ogp' ? 'noopener noreferrer' : undefined}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-900"
                      >
                        {item.kind === 'ogp' ? (
                          <>
                            Open link
                            <ExternalLink className="h-3.5 w-3.5" />
                          </>
                        ) : item.kind === 'ogp-group' ? (
                          'View group'
                        ) : (
                          'View article'
                        )}
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleRemove(item)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Remove from Global News
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
