'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import type { ClubSharedFeedItem } from '@/lib/clubNewsShareAuth';
import SharedNewsItemPreviewModal, {
  previewPayloadFromFeedItem,
  type SharedNewsPreviewPayload,
} from '@/components/news/SharedNewsItemPreviewModal';
import NewsFeedMetaLine from '@/components/news/NewsFeedMetaLine';

type ClubSharedNewsPanelProps = {
  clubId: string;
  type: 'news' | 'ogp' | 'all';
  title?: string;
  onClose?: () => void;
};

type GlobalKindFilter = 'all' | 'news' | 'ogp' | 'ogp-group';
type SortMode = 'date-desc' | 'date-asc' | 'alpha-asc' | 'alpha-desc';
/** Posted-by radio filter (empty = show all). */
type PostedByFilter = '' | 'me' | 'admin-staff' | 'members' | 'movesbook';

const POSTED_BY_OPTIONS: { value: Exclude<PostedByFilter, ''>; label: string }[] = [
  { value: 'me', label: 'posted by me' },
  { value: 'admin-staff', label: 'posted by admin & staff' },
  { value: 'members', label: 'posted by members' },
  { value: 'movesbook', label: 'posted by movesbook' },
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

function itemTitle(item: ClubSharedFeedItem) {
  if (item.title?.trim()) return item.title.trim();
  if (item.kind === 'ogp' || item.kind === 'ogp-group') {
    return item.customDescription?.trim() || item.description?.trim() || item.url;
  }
  return 'Untitled';
}

function itemSearchText(item: ClubSharedFeedItem): string {
  const parts: string[] = [itemTitle(item)];
  if (item.kind === 'news') {
    parts.push(item.author ?? '', item.categoryName ?? '', item.method ?? '');
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

function itemPosterUserId(item: ClubSharedFeedItem): string | null {
  return item.posterUserId?.trim() || null;
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

/**
 * Club Global News — merged News + OGP News promoted into this club,
 * sorted chronologically (mirrors admin Global News).
 */
export default function ClubSharedNewsPanel({
  clubId,
  type,
  title,
  onClose,
}: ClubSharedNewsPanelProps) {
  const router = useRouter();
  const [items, setItems] = useState<ClubSharedFeedItem[]>([]);
  const [isClubAdmin, setIsClubAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [adminStaffUserIds, setAdminStaffUserIds] = useState<string[]>([]);
  const [memberUserIds, setMemberUserIds] = useState<string[]>([]);
  const [movesbookUserIds, setMovesbookUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<GlobalKindFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightMatches, setHighlightMatches] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortMode, setSortMode] = useState<SortMode>('date-desc');
  const [postedByFilter, setPostedByFilter] = useState<PostedByFilter>('');
  const [preview, setPreview] = useState<SharedNewsPreviewPayload | null>(null);

  const isGlobalFeed = type === 'all';

  const adminStaffIdSet = useMemo(() => new Set(adminStaffUserIds), [adminStaffUserIds]);
  const memberIdSet = useMemo(() => new Set(memberUserIds), [memberUserIds]);
  const movesbookIdSet = useMemo(() => new Set(movesbookUserIds), [movesbookUserIds]);

  /** OGP groups open the member list page; news/OGP open the preview modal. */
  const openPreview = useCallback(
    (item: ClubSharedFeedItem) => {
      if (item.kind === 'ogp-group') {
        router.push(`/news/group/${encodeURIComponent(item.id)}`);
        return;
      }
      setPreview(previewPayloadFromFeedItem(item));
    },
    [router],
  );

  const filteredItems = useMemo(() => {
    let result = items;

    if (kindFilter !== 'all') {
      result = result.filter((item) => item.kind === kindFilter);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((item) => itemSearchText(item).includes(q));
    }

    if (postedByFilter === 'me' && currentUserId) {
      result = result.filter((item) => itemPosterUserId(item) === currentUserId);
    } else if (postedByFilter === 'admin-staff') {
      result = result.filter((item) => {
        const id = itemPosterUserId(item);
        return Boolean(id && adminStaffIdSet.has(id));
      });
    } else if (postedByFilter === 'members') {
      result = result.filter((item) => {
        const id = itemPosterUserId(item);
        return Boolean(id && memberIdSet.has(id));
      });
    } else if (postedByFilter === 'movesbook') {
      result = result.filter((item) => {
        const id = itemPosterUserId(item);
        return Boolean(id && movesbookIdSet.has(id));
      });
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
    currentUserId,
    adminStaffIdSet,
    memberIdSet,
    movesbookIdSet,
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

  const loadItems = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !clubId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/clubs/${encodeURIComponent(clubId)}/shared-news?type=${encodeURIComponent(type)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error('Failed to load shared news');
      const data = (await res.json()) as {
        items?: ClubSharedFeedItem[];
        isClubAdmin?: boolean;
        currentUserId?: string;
        adminStaffUserIds?: string[];
        memberUserIds?: string[];
        movesbookUserIds?: string[];
      };
      setItems(data.items ?? []);
      setIsClubAdmin(data.isClubAdmin === true);
      setCurrentUserId(data.currentUserId ?? null);
      setAdminStaffUserIds(data.adminStaffUserIds ?? []);
      setMemberUserIds(data.memberUserIds ?? []);
      setMovesbookUserIds(data.movesbookUserIds ?? []);
    } catch {
      setError('Could not load shared news for this club.');
      setIsClubAdmin(false);
      setCurrentUserId(null);
      setAdminStaffUserIds([]);
      setMemberUserIds([]);
      setMovesbookUserIds([]);
    } finally {
      setLoading(false);
    }
  }, [clubId, type]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleRemoveFromGlobal = useCallback(
    async (item: ClubSharedFeedItem) => {
      const token = localStorage.getItem('token');
      if (!token || !clubId) return;
      const key = `${item.kind}-${item.id}`;
      setRemovingKey(key);
      try {
        const path =
          item.kind === 'news'
            ? `/api/clubs/shared-news/news/${encodeURIComponent(item.id)}`
            : item.kind === 'ogp-group'
              ? `/api/clubs/shared-news/ogp-group/${encodeURIComponent(item.id)}`
              : `/api/clubs/shared-news/ogp/${encodeURIComponent(item.id)}`;
        const res = await fetch(path, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ clubId, inClubGlobalNews: false }),
        });
        if (!res.ok) throw new Error('Failed to remove');
        setItems((prev) => prev.filter((x) => !(x.kind === item.kind && x.id === item.id)));
      } catch {
        setError('Could not remove from Club Global News');
      } finally {
        setRemovingKey(null);
      }
    },
    [clubId],
  );

  const panelTitle =
    title ??
    (type === 'ogp'
      ? 'OGP News'
      : type === 'news'
        ? 'News'
        : 'Club News & OGP News');

  const searchToolbar = isGlobalFeed ? (
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
  ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {searchToolbar}

      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex flex-wrap items-start gap-3">
          <Globe className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900">{panelTitle}</h2>
            {isGlobalFeed ? (
              <p className="text-sm text-gray-500">
                News, OGP News, and OGP News groups shared here, sorted by date
              </p>
            ) : null}
          </div>
          {isGlobalFeed ? (
            <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-800">
              <legend className="sr-only">Filter by poster</legend>
              {POSTED_BY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="inline-flex cursor-pointer items-center gap-1.5 select-none"
                >
                  <input
                    type="radio"
                    name="club-global-posted-by"
                    value={opt.value}
                    checked={postedByFilter === opt.value}
                    onChange={() => {
                      setPostedByFilter(opt.value);
                      setCurrentPage(1);
                    }}
                    onClick={() => {
                      // Allow clearing the filter by clicking the active radio again.
                      if (postedByFilter === opt.value) {
                        setPostedByFilter('');
                        setCurrentPage(1);
                      }
                    }}
                    className="h-3.5 w-3.5 border-gray-400 text-red-600 focus:ring-red-500"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <p className="py-12 text-center text-sm text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
            <Globe className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-medium text-gray-600">
              {isGlobalFeed
                ? 'No items in Club Global News yet'
                : `No shared ${type === 'ogp' ? 'OGP News' : 'News'} yet.`}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {isGlobalFeed
                ? 'Use the globe icon on Club News or Club OGP News cards to share items here.'
                : 'Use "Share in My Clubs" on OGP News or News articles to add items here.'}
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
            <Globe className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-medium text-gray-600">No matching items</p>
            <p className="mt-1 text-sm text-gray-500">
              Try a different filter or search term.
            </p>
          </div>
        ) : isGlobalFeed ? (
          <ul className="mx-auto max-w-5xl space-y-3">
            {pageItems.map((item) => {
              const titleText = itemTitle(item);
              const rowKey = `${item.kind}-${item.id}`;
              const showHighlight = highlightMatches && Boolean(searchQuery.trim());

              return (
                <li
                  key={rowKey}
                  className="flex cursor-pointer gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                  onClick={() => openPreview(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openPreview(item);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={
                          item.kind === 'news' && item.image && !item.image.startsWith('/')
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
                    </div>

                    <h3 className="line-clamp-2 text-base font-semibold text-gray-900">
                      {showHighlight ? highlightText(titleText, searchQuery) : titleText}
                    </h3>

                    <NewsFeedMetaLine
                      kind={item.kind}
                      sector={
                        item.kind === 'news' ? item.categoryName : item.topic
                      }
                      mode={item.kind === 'news' ? item.method : null}
                      postedBy={
                        item.kind === 'news' ? item.author : item.creatorUsername
                      }
                    />

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700">
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
                      </span>
                      {isClubAdmin ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleRemoveFromGlobal(item);
                          }}
                          disabled={removingKey === rowKey}
                          className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          Remove from Club Global News
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) =>
              item.kind === 'ogp' ? (
                <button
                  key={item.shareId}
                  type="button"
                  onClick={() => openPreview(item)}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md"
                >
                  {item.image ? (
                    <div className="relative h-40 w-full bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image}
                        alt={item.title ?? 'OGP'}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="space-y-2 p-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-800">
                        {item.topic}
                      </span>
                      {item.creatorUsername ? <span>by {item.creatorUsername}</span> : null}
                    </div>
                    <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">
                      {item.title || item.customDescription || item.description || 'Untitled'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Shared {new Date(item.sharedAt).toLocaleDateString()}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                      Open link
                      <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>
              ) : item.kind === 'news' ? (
                <button
                  key={item.shareId}
                  type="button"
                  onClick={() => openPreview(item)}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md"
                >
                  {item.image ? (
                    <div className="relative h-40 w-full bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          item.image.startsWith('/')
                            ? item.image
                            : `/img/news/${item.image}`
                        }
                        alt={item.title ?? 'News'}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-24 items-center justify-center bg-gray-100">
                      <Newspaper className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <div className="space-y-2 p-4">
                    {item.categoryName ? (
                      <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {item.categoryName}
                      </span>
                    ) : null}
                    <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">
                      {item.title || 'Untitled'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {item.author ? `${item.author} · ` : ''}
                      Shared {new Date(item.sharedAt).toLocaleDateString()}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                      Read article
                      <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>
              ) : null,
            )}
          </div>
        )}
      </div>

      <SharedNewsItemPreviewModal item={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
