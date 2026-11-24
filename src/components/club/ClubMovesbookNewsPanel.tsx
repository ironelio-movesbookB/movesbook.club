'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownAZ,
  BookOpen,
  Clock,
  ExternalLink,
  Globe,
  Loader2,
  Newspaper,
  Search,
  X,
} from 'lucide-react';
import type { GlobalNewsFeedItem } from '@/lib/globalNewsAuth';
import SharedNewsItemPreviewModal, {
  previewPayloadFromFeedItem,
  type SharedNewsPreviewPayload,
} from '@/components/news/SharedNewsItemPreviewModal';
import NewsFeedMetaLine from '@/components/news/NewsFeedMetaLine';
import { ShareInMyClubsButtonIfClub } from '@/components/club/ShareInMyClubsButton';
import ClubGlobalNewsToggleButton from '@/components/club/ClubGlobalNewsToggleButton';
import ShareInMyClubsModal from '@/components/club/ShareInMyClubsModal';
import { useAuth } from '@/hooks/useAuth';
import { isClubAccountUserType } from '@/utils/dashboardRouting';

type ClubMovesbookNewsPanelProps = {
  onClose?: () => void;
  title?: string;
  /** Active club — enables Club Global News globe for that club. */
  clubId?: string | null;
};

type ShareFlags = {
  sharedClubIds: string[];
  inClubGlobalNews: boolean;
};

type GlobalKindFilter = 'all' | 'news' | 'ogp' | 'ogp-group';
type SortMode = 'date-desc' | 'date-asc' | 'alpha-asc' | 'alpha-desc';
/** Posted-by radio filter (empty = show all). */
type PostedByFilter = '' | 'me' | 'admin-staff' | 'members' | 'movesbook' | 'my-country';

const POSTED_BY_OPTIONS: { value: Exclude<PostedByFilter, ''>; label: string }[] = [
  { value: 'me', label: 'posted by me' },
  { value: 'admin-staff', label: 'posted by admin & staff' },
  { value: 'members', label: 'posted by members' },
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

function itemKey(item: GlobalNewsFeedItem) {
  return `${item.kind}:${item.id}`;
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

/** No Duration (= null/empty) means unlimited — not expired. */
function isNotExpired(item: GlobalNewsFeedItem): boolean {
  const expMs = getExpiresAtMs(item);
  if (expMs == null) return true;
  return expMs >= Date.now();
}

function hasExpirationDateSet(item: GlobalNewsFeedItem): boolean {
  return getExpiresAtMs(item) != null;
}

/** True only when an expiration date is set and that date is in the past. */
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

/**
 * Club → Movesbook Global News: read-only view of superadmin Global News
 * (News + OGP News with inGlobalNews, sorted by date), with club share actions.
 * Toolbar mirrors Club News & OGP News (search, highlight, filters, sort).
 */
export default function ClubMovesbookNewsPanel({
  onClose,
  title = 'Movesbook Global News',
  clubId = null,
}: ClubMovesbookNewsPanelProps) {
  const router = useRouter();
  const { user } = useAuth();
  const isClubAdmin = Boolean(user?.userType && isClubAccountUserType(user.userType));

  const [items, setItems] = useState<GlobalNewsFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SharedNewsPreviewPayload | null>(null);
  const [shareFlags, setShareFlags] = useState<Record<string, ShareFlags>>({});
  const [globalShareItem, setGlobalShareItem] = useState<GlobalNewsFeedItem | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [adminStaffUserIds, setAdminStaffUserIds] = useState<string[]>([]);
  const [memberUserIds, setMemberUserIds] = useState<string[]>([]);
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

  const adminStaffIdSet = useMemo(() => new Set(adminStaffUserIds), [adminStaffUserIds]);
  const memberIdSet = useMemo(() => new Set(memberUserIds), [memberUserIds]);
  const movesbookIdSet = useMemo(() => new Set(movesbookUserIds), [movesbookUserIds]);
  const currentUserCountry = (user?.country ?? '').trim().toLowerCase();

  const loadItems = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('includeDeleted', '1');
      if (clubId) params.set('clubId', clubId);
      const res = await fetch(`/api/news/global?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load Movesbook News');
      const data = (await res.json()) as {
        items?: GlobalNewsFeedItem[];
        currentUserId?: string;
        adminStaffUserIds?: string[];
        memberUserIds?: string[];
        movesbookUserIds?: string[];
      };
      setItems(Array.isArray(data.items) ? data.items : []);
      setCurrentUserId(data.currentUserId ?? null);
      setAdminStaffUserIds(data.adminStaffUserIds ?? []);
      setMemberUserIds(data.memberUserIds ?? []);
      setMovesbookUserIds(data.movesbookUserIds ?? []);
    } catch {
      setError('Could not load Movesbook News.');
      setItems([]);
      setCurrentUserId(null);
      setAdminStaffUserIds([]);
      setMemberUserIds([]);
      setMovesbookUserIds([]);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const loadShareFlags = useCallback(async () => {
    if (!isClubAdmin || items.length === 0) {
      setShareFlags({});
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) return;

    const newsIds = items.filter((i) => i.kind === 'news').map((i) => i.id);
    const ogpIds = items.filter((i) => i.kind === 'ogp').map((i) => i.id);
    const ogpGroupIds = items.filter((i) => i.kind === 'ogp-group').map((i) => i.id);
    const clubParam = clubId ? `&clubId=${encodeURIComponent(clubId)}` : '';

    try {
      const [newsRes, ogpRes, ogpGroupRes] = await Promise.all([
        newsIds.length
          ? fetch(
              `/api/clubs/shared-news/status?kind=news&ids=${encodeURIComponent(newsIds.join(','))}${clubParam}`,
              { headers: { Authorization: `Bearer ${token}` } },
            )
          : null,
        ogpIds.length
          ? fetch(
              `/api/clubs/shared-news/status?kind=ogp&ids=${encodeURIComponent(ogpIds.join(','))}${clubParam}`,
              { headers: { Authorization: `Bearer ${token}` } },
            )
          : null,
        ogpGroupIds.length
          ? fetch(
              `/api/clubs/shared-news/status?kind=ogp-group&ids=${encodeURIComponent(ogpGroupIds.join(','))}${clubParam}`,
              { headers: { Authorization: `Bearer ${token}` } },
            )
          : null,
      ]);

      const next: Record<string, ShareFlags> = {};
      const apply = (
        kind: 'news' | 'ogp' | 'ogp-group',
        data: {
          sharedByItem?: Record<string, string[]>;
          inClubGlobalByItem?: Record<string, boolean>;
        },
      ) => {
        const sharedByItem = data.sharedByItem ?? {};
        const globalByItem = data.inClubGlobalByItem ?? {};
        for (const id of Object.keys(sharedByItem)) {
          next[`${kind}:${id}`] = {
            sharedClubIds: sharedByItem[id] ?? [],
            inClubGlobalNews: globalByItem[id] === true,
          };
        }
        // Also mark items that only appear in global map
        for (const id of Object.keys(globalByItem)) {
          const key = `${kind}:${id}`;
          if (!next[key]) {
            next[key] = {
              sharedClubIds: clubId ? [clubId] : [],
              inClubGlobalNews: globalByItem[id] === true,
            };
          }
        }
      };

      if (newsRes?.ok) {
        apply('news', (await newsRes.json()) as {
          sharedByItem?: Record<string, string[]>;
          inClubGlobalByItem?: Record<string, boolean>;
        });
      }
      if (ogpRes?.ok) {
        apply('ogp', (await ogpRes.json()) as {
          sharedByItem?: Record<string, string[]>;
          inClubGlobalByItem?: Record<string, boolean>;
        });
      }
      if (ogpGroupRes?.ok) {
        apply('ogp-group', (await ogpGroupRes.json()) as {
          sharedByItem?: Record<string, string[]>;
          inClubGlobalByItem?: Record<string, boolean>;
        });
      }
      setShareFlags(next);
    } catch {
      // ignore status errors; share buttons still work via their own fetch
    }
  }, [items, isClubAdmin, clubId]);

  useEffect(() => {
    void loadShareFlags();
  }, [loadShareFlags]);

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
    } else if (postedByFilter === 'my-country') {
      result = result.filter((item) => {
        const creatorCountry = (item.creatorCountry ?? '').trim().toLowerCase();
        return Boolean(currentUserCountry && creatorCountry && creatorCountry === currentUserCountry);
      });
    }

    // Mirror Global News (NewsArticlesList) expired/deleted filter behavior.
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
    currentUserId,
    currentUserCountry,
    adminStaffIdSet,
    memberIdSet,
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

  const openPreview = useCallback(
    (item: GlobalNewsFeedItem) => {
      if (item.kind === 'ogp-group') {
        router.push(`/news/group/${encodeURIComponent(item.id)}`);
        return;
      }
      setPreview(previewPayloadFromFeedItem(item));
    },
    [router],
  );

  const updateSharedClubIds = useCallback((item: GlobalNewsFeedItem, clubIds: string[]) => {
    const key = itemKey(item);
    setShareFlags((prev) => ({
      ...prev,
      [key]: {
        sharedClubIds: clubIds,
        inClubGlobalNews:
          clubId && clubIds.includes(clubId)
            ? (prev[key]?.inClubGlobalNews ?? false)
            : false,
      },
    }));
  }, [clubId]);

  const handleGlobalShared = useCallback(
    (item: GlobalNewsFeedItem, sharedClubId: string) => {
      const key = itemKey(item);
      setShareFlags((prev) => {
        const existing = prev[key]?.sharedClubIds ?? [];
        const sharedClubIds = existing.includes(sharedClubId)
          ? existing
          : [...existing, sharedClubId];
        return {
          ...prev,
          [key]: {
            sharedClubIds,
            inClubGlobalNews:
              clubId && sharedClubId === clubId
                ? true
                : (prev[key]?.inClubGlobalNews ?? false),
          },
        };
      });
      setGlobalShareItem(null);
    },
    [clubId],
  );

  const showShareActions = isClubAdmin;
  const globalShareDestinations = useMemo(
    () => ({ clubFeed: false as const, global: true as const }),
    [],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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

      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex flex-wrap items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500">
              News and OGP News shared by Movesbook, sorted by date
            </p>
          </div>
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

      {/* Filter bar — mirrors Global News: exclude / posted-by / show expired / show deleted */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-700 bg-gray-800 px-4 py-2.5 text-sm">
        <label className="inline-flex cursor-pointer items-center gap-1.5 select-none">
          <input
            type="radio"
            name="movesbook-global-exclude-expired-deleted"
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
                name="movesbook-global-posted-by"
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
            <p className="font-medium text-gray-600">No Movesbook News yet</p>
            <p className="mt-1 text-sm text-gray-500">
              When Movesbook shares News or OGP News globally, they will appear here.
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
        ) : (
          <ul className="mx-auto max-w-5xl space-y-3">
            {pageItems.map((item) => {
              const titleText = itemTitle(item);
              const key = itemKey(item);
              const flags = shareFlags[key];
              const sharedClubIds = flags?.sharedClubIds ?? [];
              const inClubGlobalNews = flags?.inClubGlobalNews === true;
              const sharedToActiveClub = Boolean(clubId && sharedClubIds.includes(clubId));
              const shareKind =
                item.kind === 'news'
                  ? 'news'
                  : item.kind === 'ogp-group'
                    ? 'ogp-group'
                    : 'ogp';
              const showHighlight = highlightMatches && Boolean(searchQuery.trim());

              return (
                <li key={key}>
                  <div className="relative flex w-full gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md">
                    <button
                      type="button"
                      onClick={() => openPreview(item)}
                      className="absolute inset-0 z-0 rounded-xl"
                      aria-label={`Preview ${titleText}`}
                    />

                    <div className="relative z-10 h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 pointer-events-none">
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

                    <div className="relative z-10 min-w-0 flex-1 pointer-events-none">
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
                        sector={item.kind === 'news' ? item.categoryName : item.topic}
                        mode={item.kind === 'news' ? item.method : null}
                        postedBy={item.kind === 'news' ? item.author : item.creatorUsername}
                      />

                      <div className="mt-3 flex flex-wrap items-center gap-3 pointer-events-auto">
                        <button
                          type="button"
                          onClick={() => openPreview(item)}
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
                        </button>

                        {showShareActions ? (
                          <div
                            className="ml-auto flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/*
                              Share in My Clubs:
                              - OGP → Club OGP News
                              - News → Club News
                            */}
                            <ShareInMyClubsButtonIfClub
                              userType={user?.userType ?? null}
                              kind={shareKind}
                              itemId={item.id}
                              itemTitle={titleText}
                              adminUsername={user?.username ?? undefined}
                              sharedClubIds={sharedClubIds}
                              onSharedChange={(clubIds) => updateSharedClubIds(item, clubIds)}
                            />

                            {/*
                              Share in Club Global News:
                              - both OGP and News → Club News & OGP News
                            */}
                            {clubId ? (
                              sharedToActiveClub ? (
                                <ClubGlobalNewsToggleButton
                                  kind={shareKind}
                                  itemId={item.id}
                                  clubId={clubId}
                                  inClubGlobalNews={inClubGlobalNews}
                                  onToggled={(next) => {
                                    setShareFlags((prev) => ({
                                      ...prev,
                                      [key]: {
                                        sharedClubIds: prev[key]?.sharedClubIds ?? [clubId],
                                        inClubGlobalNews: next,
                                      },
                                    }));
                                  }}
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setGlobalShareItem(item);
                                  }}
                                  className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-100"
                                  title="Share in Club Global News"
                                  aria-label="Share in Club Global News"
                                >
                                  <Globe className="h-3.5 w-3.5" />
                                </button>
                              )
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <SharedNewsItemPreviewModal item={preview} onClose={() => setPreview(null)} />

      {globalShareItem ? (
        <ShareInMyClubsModal
          isOpen
          onClose={() => setGlobalShareItem(null)}
          kind={
            globalShareItem.kind === 'news'
              ? 'news'
              : globalShareItem.kind === 'ogp-group'
                ? 'ogp-group'
                : 'ogp'
          }
          itemId={globalShareItem.id}
          itemTitle={itemTitle(globalShareItem)}
          adminUsername={user?.username ?? undefined}
          sharedClubIds={shareFlags[itemKey(globalShareItem)]?.sharedClubIds ?? []}
          preferredClubId={clubId}
          initialDestinations={globalShareDestinations}
          onShared={(sharedClubId) => handleGlobalShared(globalShareItem, sharedClubId)}
          onUnshared={(unsharedClubId) => {
            const key = itemKey(globalShareItem);
            setShareFlags((prev) => ({
              ...prev,
              [key]: {
                sharedClubIds: (prev[key]?.sharedClubIds ?? []).filter((id) => id !== unsharedClubId),
                inClubGlobalNews:
                  clubId && unsharedClubId === clubId
                    ? false
                    : (prev[key]?.inClubGlobalNews ?? false),
              },
            }));
          }}
        />
      ) : null}
    </div>
  );
}
