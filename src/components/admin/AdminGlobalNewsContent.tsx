'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Globe, Newspaper, ExternalLink, X } from 'lucide-react';
import type { GlobalNewsFeedItem } from '@/lib/globalNewsAuth';
import { resolveIsSuperAdminFromStorage } from '@/lib/panelSession';
import NewsFeedMetaLine from '@/components/news/NewsFeedMetaLine';

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
      const res = await fetch('/api/admin/global-news', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load global news');
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authChecked) void loadItems();
  }, [authChecked, loadItems]);

  const handleRemove = useCallback(
    async (item: GlobalNewsFeedItem) => {
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
    },
    [],
  );

  if (!authChecked) return null;

  return (
    <div className="min-h-[70vh] bg-gray-50">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
        <Globe className="w-5 h-5 text-teal-700 shrink-0" />
        <h1 className="text-lg font-semibold text-gray-900">Global News</h1>
        <p className="text-sm text-gray-500 hidden sm:block">
          News and OGP News shared here, sorted by date
        </p>
        <Link
          href={closeHref}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors shrink-0 ml-auto"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </Link>
      </div>

      <div className="p-4 max-w-5xl mx-auto">
        {loading && <p className="text-sm text-gray-500">Loading global news...</p>}
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {!loading && items.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <Globe className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No items in Global News yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Use &quot;Share in Global News&quot; on News, OGP News, or OGP groups to add items here.
            </p>
          </div>
        )}

        <ul className="space-y-3">
          {items.map((item) => {
            const title = itemTitle(item);
            const viewHref =
              item.kind === 'news'
                ? `/news-by-movesbook/${item.id}`
                : item.kind === 'ogp-group'
                  ? `/news/group/${item.id}`
                  : item.url || `/admin/news/links`;

            return (
              <li
                key={`${item.kind}-${item.id}`}
                className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      {item.kind === 'news' ? (
                        <Newspaper className="w-8 h-8" />
                      ) : (
                        <Globe className="w-8 h-8" />
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${
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

                  <h2 className="text-base font-semibold text-gray-900 line-clamp-2">{title}</h2>

                  <NewsFeedMetaLine
                    kind={item.kind}
                    sector={item.kind === 'news' ? item.categoryName : item.topic}
                    mode={item.kind === 'news' ? item.method : null}
                    postedBy={item.kind === 'news' ? item.author : item.creatorUsername}
                  />

                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <Link
                      href={viewHref}
                      target={item.kind === 'ogp' ? '_blank' : undefined}
                      rel={item.kind === 'ogp' ? 'noopener noreferrer' : undefined}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-900"
                    >
                      {item.kind === 'ogp' ? (
                        <>
                          Open link
                          <ExternalLink className="w-3.5 h-3.5" />
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
      </div>
    </div>
  );
}
