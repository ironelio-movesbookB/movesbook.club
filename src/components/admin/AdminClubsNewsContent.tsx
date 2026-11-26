'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Eye, Globe, Loader2, Newspaper } from 'lucide-react';
import {
  NetworkSearchListClient,
  type LegendKey,
  type ListRow,
} from '@/components/search/NetworkSearchListClient';

type EntityType = 'coach' | 'team' | 'club';
type FeedType = 'global' | 'news' | 'ogp';

const ENTITY_OPTIONS: { value: EntityType; label: string }[] = [
  { value: 'coach', label: 'Coach' },
  { value: 'team', label: 'Team' },
  { value: 'club', label: 'Club' },
];

const FEED_TABS: { value: FeedType; label: string }[] = [
  { value: 'global', label: 'Global News' },
  { value: 'news', label: 'News' },
  { value: 'ogp', label: 'OGP News' },
];

/** Legend kinds that can be searched from "News from clubs". */
const SEARCH_LEGEND_KEYS: LegendKey[] = ['coach', 'team', 'club'];

/** Super admin session token first; fall back to a normal user token. */
const ADMIN_TOKEN_KEYS = ['adminToken', 'token'];

type EntityNewsItem =
  | {
      kind: 'news';
      id: string;
      title: string | null;
      date: string;
      image: string | null;
      author: string | null;
      categoryName: string | null;
      method: string | null;
      briefDesc: string | null;
      internetLink: string | null;
    }
  | {
      kind: 'ogp' | 'ogp-group';
      id: string;
      title: string | null;
      date: string;
      image: string | null;
      topic: string;
      creatorUsername: string | null;
      url: string;
      description: string | null;
      customDescription: string | null;
      memberCount?: number;
      expiresAt: string | null;
    };

function isEntityType(v: string | null): v is EntityType {
  return v === 'coach' || v === 'team' || v === 'club';
}

function isFeedType(v: string | null): v is FeedType {
  return v === 'global' || v === 'news' || v === 'ogp';
}

/** Map a network search result to the entity type used by /api/admin/news/entity. */
function rowEntityType(row: ListRow): EntityType {
  if (row.resultType === 'club') return 'club';
  if (row.resultType === 'team') return 'team';
  // Users (coaches) — news are the ones they created.
  return 'coach';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function newsImageSrc(item: EntityNewsItem): string | null {
  if (!item.image) return null;
  if (item.kind === 'news' && !item.image.startsWith('/') && !item.image.startsWith('http')) {
    return `/img/news/${item.image}`;
  }
  return item.image;
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Super admin → News and articles → News from clubs.
 * Search a coach / team / club (same search as the main page navbar),
 * then browse its Global News / News / OGP News.
 */
export default function AdminClubsNewsContent() {
  const router = useRouter();
  const pathname = usePathname() ?? '/admin/news/clubs';
  const searchParams = useSearchParams();

  const typeParam = searchParams?.get('type') ?? null;
  const entityType: EntityType = isEntityType(typeParam) ? typeParam : 'club';
  const query = searchParams?.get('q')?.trim() ?? '';
  const entityId = searchParams?.get('id')?.trim() ?? '';
  const feedParam = searchParams?.get('feed') ?? null;
  const feed: FeedType = isFeedType(feedParam) ? feedParam : 'global';

  const [selectType, setSelectType] = useState<EntityType>(entityType);
  const [searchText, setSearchText] = useState(query);
  const [entityName, setEntityName] = useState<string | null>(null);

  useEffect(() => {
    setEntityName(null);
  }, [entityType, entityId]);

  useEffect(() => {
    setSelectType(entityType);
  }, [entityType]);

  useEffect(() => {
    setSearchText(query);
  }, [query]);

  const pushParams = useCallback(
    (params: Record<string, string | undefined>) => {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v) sp.set(k, v);
      }
      const qs = sp.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router]
  );

  const handleSearch = (e?: FormEvent) => {
    e?.preventDefault();
    const q = searchText.trim();
    if (!q) return;
    pushParams({ type: selectType, q });
  };

  const handleSelectRow = (row: ListRow) => {
    pushParams({ type: rowEntityType(row), id: row.id, q: query || undefined, feed: 'global' });
  };

  const handleFeedChange = (next: FeedType) => {
    pushParams({ type: entityType, id: entityId, q: query || undefined, feed: next });
  };

  const handleBackToResults = () => {
    pushParams({ type: entityType, q: query || undefined });
  };

  return (
    <div className="w-full min-w-0 p-4 md:p-6">
      <form
        onSubmit={handleSearch}
        className="mb-4 flex flex-wrap items-center gap-3"
        role="search"
        aria-label="Search coach, team or club"
      >
        <h1 className="text-2xl font-bold text-gray-900">
          News of
          {entityId && entityName ? (
            <span className="ml-2 italic text-sky-500">{entityName}</span>
          ) : null}
        </h1>
        <label htmlFor="clubs-news-entity-type" className="sr-only">
          Type
        </label>
        <select
          id="clubs-news-entity-type"
          value={selectType}
          onChange={(e) => setSelectType(e.target.value as EntityType)}
          className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          {ENTITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label htmlFor="clubs-news-query" className="sr-only">
          Name
        </label>
        <input
          id="clubs-news-query"
          type="search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search name…"
          autoComplete="off"
          className="h-9 w-56 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
        <button
          type="submit"
          disabled={!searchText.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Search"
          title="Search"
        >
          <Eye className="h-4 w-4" />
        </button>
      </form>

      {entityId ? (
        <EntityNewsView
          key={`${entityType}-${entityId}`}
          entityType={entityType}
          entityId={entityId}
          feed={feed}
          onFeedChange={handleFeedChange}
          onBack={query ? handleBackToResults : undefined}
          onEntityLoaded={setEntityName}
        />
      ) : query ? (
        <div className="-mx-3 sm:-mx-4 lg:-mx-6">
          <NetworkSearchListClient
            key={`${entityType}-${query}`}
            initialQuery={query}
            initialSource="mypage"
            legendKeys={SEARCH_LEGEND_KEYS}
            initialEnabledKinds={[entityType]}
            hideRequestFriendship
            hideSourceTag
            tokenStorageKeys={ADMIN_TOKEN_KEYS}
            onSelectRow={handleSelectRow}
            title="Search results"
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <Newspaper className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="font-medium text-gray-600">Select a coach, team or club</p>
          <p className="mt-1 text-sm text-gray-500">
            Choose the type, type a name and press the eye icon to search. Then click a result to see
            its Global News, News and OGP News.
          </p>
        </div>
      )}
    </div>
  );
}

function EntityNewsView({
  entityType,
  entityId,
  feed,
  onFeedChange,
  onBack,
  onEntityLoaded,
}: {
  entityType: EntityType;
  entityId: string;
  feed: FeedType;
  onFeedChange: (feed: FeedType) => void;
  onBack?: () => void;
  onEntityLoaded?: (name: string) => void;
}) {
  const [items, setItems] = useState<EntityNewsItem[]>([]);
  const [ownerUsername, setOwnerUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setError('Super admin session not found. Please log in again.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/admin/news/entity?type=${entityType}&id=${encodeURIComponent(entityId)}&feed=${feed}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(typeof data?.error === 'string' ? data.error : 'Failed to load news');
          setItems([]);
          return;
        }
        setItems(Array.isArray(data.items) ? data.items : []);
        setOwnerUsername(data.entity?.ownerUsername ?? null);
        if (data.entity?.name) onEntityLoaded?.(String(data.entity.name));
      } catch {
        if (!cancelled) {
          setError('Failed to load news');
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onEntityLoaded is a stable state setter
  }, [entityType, entityId, feed]);

  const feedLabel = FEED_TABS.find((f) => f.value === feed)?.label ?? 'News';

  return (
    <div className="min-w-0">
      <nav
        className="flex flex-wrap items-center justify-center gap-x-16 gap-y-2 rounded-t-lg bg-[#1f2937] px-4 py-2.5"
        aria-label="News type"
      >
        {FEED_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onFeedChange(tab.value)}
            aria-pressed={feed === tab.value}
            className={`text-lg font-bold transition-colors ${
              feed === tab.value ? 'text-orange-400' : 'text-white hover:text-orange-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="rounded-b-lg border border-t-0 border-gray-200 bg-gray-50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
          <span>
            {entityType === 'club'
              ? `${feedLabel} shared in this club`
              : entityType === 'coach'
                ? `${feedLabel} created by this coach`
                : `${feedLabel} created by the ${entityType} admin${
                    ownerUsername ? ` (${ownerUsername})` : ''
                  }`}
          </span>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 font-medium text-teal-700 hover:text-teal-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to search results
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading {feedLabel}…
          </div>
        ) : error ? (
          <p className="py-8 text-sm text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <Globe className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-medium text-gray-600">No {feedLabel} yet</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <EntityNewsCard key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EntityNewsCard({ item }: { item: EntityNewsItem }) {
  const src = newsImageSrc(item);
  const title = item.title?.trim() || (item.kind === 'news' ? 'Untitled news' : item.url || 'OGP News');
  const summary =
    item.kind === 'news'
      ? stripHtml(item.briefDesc)
      : stripHtml(item.customDescription) || stripHtml(item.description);
  const viewHref =
    item.kind === 'news'
      ? `/news-by-movesbook/${item.id}`
      : item.kind === 'ogp-group'
        ? `/news/group/${item.id}`
        : item.url;
  const external = item.kind === 'ogp';

  return (
    <li className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            {item.kind === 'news' ? <Newspaper className="h-8 w-8" /> : <Globe className="h-8 w-8" />}
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
            {item.kind === 'news' ? 'News' : item.kind === 'ogp-group' ? 'OGP Group' : 'OGP News'}
          </span>
          <span className="text-xs text-gray-500">{formatDate(item.date)}</span>
          {item.kind !== 'news' && item.topic ? (
            <span className="text-xs text-gray-500">· {item.topic}</span>
          ) : null}
          {item.kind === 'news' && item.categoryName ? (
            <span className="text-xs text-gray-500">· {item.categoryName}</span>
          ) : null}
          {item.kind === 'ogp-group' && typeof item.memberCount === 'number' ? (
            <span className="text-xs text-gray-500">· {item.memberCount} OGP News</span>
          ) : null}
          {item.kind !== 'news' && item.expiresAt && new Date(item.expiresAt) < new Date() ? (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Expired
            </span>
          ) : null}
        </div>

        <h2 className="line-clamp-2 text-base font-semibold text-gray-900">{title}</h2>
        {summary ? <p className="mt-1 line-clamp-2 text-sm text-gray-600">{summary}</p> : null}
        <p className="mt-1 text-xs text-gray-500">
          Posted by {(item.kind === 'news' ? item.author : item.creatorUsername) || '—'}
        </p>

        {viewHref ? (
          <div className="mt-3">
            <Link
              href={viewHref}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
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
          </div>
        ) : null}
      </div>
    </li>
  );
}
