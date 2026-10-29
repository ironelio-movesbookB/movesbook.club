'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, ExternalLink, Globe, Loader2, Newspaper, X } from 'lucide-react';
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

/**
 * Club → Movesbook Global News: read-only view of superadmin Global News
 * (News + OGP News with inGlobalNews, sorted by date), with club share actions.
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
      const res = await fetch('/api/news/global', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load Movesbook News');
      const data = (await res.json()) as { items?: GlobalNewsFeedItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError('Could not load Movesbook News.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
      <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <BookOpen className="h-5 w-5 shrink-0 text-teal-700" />
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
        ) : (
          <ul className="mx-auto max-w-5xl space-y-3">
            {items.map((item) => {
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
                        {titleText}
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
