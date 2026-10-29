'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, X } from 'lucide-react';
import NewsList from '@/components/news/NewsList';
import GetSocialBlock from '@/components/news/GetSocialBlock';
import NewsToolbox from '@/components/news/NewsToolbox';
import ShareInMyClubsModal from '@/components/club/ShareInMyClubsModal';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { isClubAccountUserType } from '@/utils/dashboardRouting';

/** Posted-by radio filter (empty = show all). */
type PostedByFilter = '' | 'me' | 'admin-staff' | 'members' | 'movesbook';

const POSTED_BY_OPTIONS: { value: Exclude<PostedByFilter, ''>; label: string }[] = [
  { value: 'me', label: 'posted by me' },
  { value: 'admin-staff', label: 'posted by admin & staff' },
  { value: 'members', label: 'posted by members' },
  { value: 'movesbook', label: 'posted by movesbook' },
];

interface Category {
  id: string;
  categoryName: string;
}

interface Sport {
  id: string;
  name: string;
}

interface Language {
  id: string;
  code: string;
  name: string;
}

interface NewsArticle {
  id: string;
  title: string;
  content?: string | Record<string, string>;
  image?: string | null;
  createdAt: string;
  mode?: string;
  internetLinkEditor?: string;
  inLastNews?: string;
  feturedNews?: string;
  author?: string;
  originalAuthor?: string;
  searchingKeywords?: string;
  briefDesc?: string | null;
  inClubGlobalNews?: boolean;
  inGlobalNews?: boolean;
  category?: {
    id: string;
    categoryName: string;
  } | null;
  languageTitles?: Array<{
    title: string;
    language: {
      code: string;
      name: string;
    };
  }>;
  settings?: Array<{
    sports?: Array<{
      sport: string;
    }>;
  }>;
  user?: {
    id: string;
    username: string;
    image: string | null;
    firstname?: string | null;
    lastname?: string | null;
  } | null;
}

type ClubNewsArchivePanelProps = {
  onClose?: () => void;
  title?: string;
  /**
   * When set, list only News articles shared into this club.
   * When omitted, uses the same public News archive feed as /news-by-movesbook.
   */
  clubId?: string | null;
  sharedWithClubOnly?: boolean;
  /**
   * Show "Share in Movesbook Global News" on cards (Movesbook News archive).
   * Also enables Club Global News globe when clubId is set (not only shared feed).
   */
  enableMovesbookGlobalShare?: boolean;
};

/**
 * Club News → News / Movesbook News: same archive UI/logic as /news-by-movesbook.
 */
export default function ClubNewsArchivePanel({
  onClose,
  title = 'News',
  clubId = null,
  sharedWithClubOnly = false,
  enableMovesbookGlobalShare = false,
}: ClubNewsArchivePanelProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideShowStatus, setHideShowStatus] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const hasFetchedDropdownDataRef = useRef(false);
  const [fetchKey, setFetchKey] = useState(0);
  const [postedByFilter, setPostedByFilter] = useState<PostedByFilter>('');
  /** Role id sets for posted-by filters (club shared feed + public movesbook). */
  const roleIdsRef = useRef<{
    adminStaff: string[];
    members: string[];
    movesbook: string[];
  }>({ adminStaff: [], members: [], movesbook: [] });

  useEffect(() => {
    if (hasFetchedDropdownDataRef.current) return;
    hasFetchedDropdownDataRef.current = true;

    const fetchData = async () => {
      try {
        const [categoriesRes, sportsRes, languagesRes] = await Promise.all([
          fetch('/api/public/news/categories'),
          fetch('/api/public/news/sports'),
          fetch('/api/public/news/languages'),
        ]);
        if (categoriesRes.ok) setCategories(await categoriesRes.json());
        if (sportsRes.ok) setSports(await sportsRes.json());
        if (languagesRes.ok) setLanguages(await languagesRes.json());
      } catch (e) {
        console.error('Error fetching news filter data:', e);
      }
    };

    void fetchData();
  }, []);

  const loadNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');

      if (sharedWithClubOnly && clubId) {
        if (!token) throw new Error('Unauthorized');
        const res = await fetch(
          `/api/clubs/${encodeURIComponent(clubId)}/shared-news?type=news&detail=full`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) throw new Error('Failed to load shared news');
        const data = (await res.json()) as {
          news?: NewsArticle[];
          adminStaffUserIds?: string[];
          memberUserIds?: string[];
          movesbookUserIds?: string[];
        };
        roleIdsRef.current = {
          adminStaff: data.adminStaffUserIds ?? [],
          members: data.memberUserIds ?? [],
          movesbook: data.movesbookUserIds ?? [],
        };

        let items = data.news ?? [];

        const q = searchQuery.trim().toLowerCase();
        if (selectedCategory) {
          items = items.filter((item) => item.category?.id === selectedCategory);
        }
        if (selectedSport) {
          const sportName = sports.find((s) => s.id === selectedSport)?.name;
          if (sportName) {
            items = items.filter((item) => {
              const articleSports = item.settings?.[0]?.sports?.map((s) => s.sport) ?? [];
              return articleSports.length === 0 || articleSports.includes(sportName);
            });
          }
        }
        if (selectedLanguage) {
          const langCode = languages.find((l) => l.id === selectedLanguage)?.code;
          if (langCode) {
            items = items.filter(
              (item) =>
                !item.languageTitles?.length ||
                item.languageTitles.some((lt) => lt.language.code === langCode),
            );
          }
        }
        if (q) {
          items = items.filter((item) => {
            const hay = [
              item.title,
              item.author,
              item.originalAuthor,
              item.searchingKeywords,
              item.briefDesc,
              item.category?.categoryName,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return hay.includes(q);
          });
        }

        if (postedByFilter === 'me') {
          items = items.filter((item) => Boolean(user?.id && item.user?.id === user.id));
        } else if (postedByFilter === 'admin-staff') {
          const ids = new Set(roleIdsRef.current.adminStaff);
          items = items.filter((item) => Boolean(item.user?.id && ids.has(item.user.id)));
        } else if (postedByFilter === 'members') {
          const ids = new Set(roleIdsRef.current.members);
          items = items.filter((item) => Boolean(item.user?.id && ids.has(item.user.id)));
        } else if (postedByFilter === 'movesbook') {
          const ids = new Set(roleIdsRef.current.movesbook);
          items = items.filter((item) => Boolean(item.user?.id && ids.has(item.user.id)));
        }

        const total = items.length;
        const totalPages = Math.max(1, Math.ceil(total / pagination.limit));
        const page = Math.min(pagination.page, totalPages);
        const start = (page - 1) * pagination.limit;
        setNews(items.slice(start, start + pagination.limit));
        setPagination((prev) => ({
          ...prev,
          page,
          total,
          totalPages,
        }));
        return;
      }

      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

      // Bootstrap Movesbook (superadmin) poster ids when needed for the public archive.
      if (
        postedByFilter === 'movesbook' &&
        roleIdsRef.current.movesbook.length === 0 &&
        token
      ) {
        const bootRes = await fetch('/api/public/news?page=1&limit=1', {
          headers: authHeaders,
        });
        if (bootRes.ok) {
          const bootData = (await bootRes.json()) as { movesbookUserIds?: string[] };
          roleIdsRef.current.movesbook = bootData.movesbookUserIds ?? [];
        }
      }

      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (selectedSport) params.append('sportId', selectedSport);
      if (selectedLanguage) params.append('languageId', selectedLanguage);

      if (postedByFilter === 'me' && user?.id) {
        params.append('userId', user.id);
      } else if (postedByFilter === 'movesbook') {
        const ids = roleIdsRef.current.movesbook;
        if (ids.length === 0) {
          setNews([]);
          setPagination((prev) => ({ ...prev, page: 1, total: 0, totalPages: 1 }));
          return;
        }
        params.append('userIds', ids.join(','));
      } else if (postedByFilter === 'admin-staff') {
        const ids = roleIdsRef.current.adminStaff;
        if (ids.length === 0) {
          setNews([]);
          setPagination((prev) => ({ ...prev, page: 1, total: 0, totalPages: 1 }));
          return;
        }
        params.append('userIds', ids.join(','));
      } else if (postedByFilter === 'members') {
        const ids = roleIdsRef.current.members;
        if (ids.length === 0) {
          setNews([]);
          setPagination((prev) => ({ ...prev, page: 1, total: 0, totalPages: 1 }));
          return;
        }
        params.append('userIds', ids.join(','));
      }

      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());

      const res = await fetch(`/api/public/news?${params.toString()}`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error('Failed to load news');
      const data = await res.json();
      let loaded: NewsArticle[] = data.news || [];

      // Enrich with Club Global share flags for the active club (public archive).
      if (clubId && token && loaded.length > 0) {
        try {
          const ids = loaded.map((n) => n.id).join(',');
          const statusRes = await fetch(
            `/api/clubs/shared-news/status?kind=news&ids=${encodeURIComponent(ids)}&clubId=${encodeURIComponent(clubId)}`,
            { headers: authHeaders },
          );
          if (statusRes.ok) {
            const status = (await statusRes.json()) as {
              sharedByItem?: Record<string, string[]>;
              inClubGlobalByItem?: Record<string, boolean>;
            };
            const globalByItem = status.inClubGlobalByItem ?? {};
            loaded = loaded.map((item) => ({
              ...item,
              inClubGlobalNews: globalByItem[item.id] === true,
            }));
          }
        } catch {
          // ignore enrichment errors
        }
      }

      setNews(loaded);
      setPagination((prev) => data.pagination || prev);
      if (Array.isArray(data.movesbookUserIds) && data.movesbookUserIds.length > 0) {
        roleIdsRef.current.movesbook = data.movesbookUserIds;
      }
    } catch {
      setError(
        sharedWithClubOnly
          ? 'Could not load shared News for this club.'
          : 'Could not load News.',
      );
      setNews([]);
    } finally {
      setLoading(false);
    }
    void fetchKey; // bump from Show forces refetch even when filters unchanged
  }, [
    sharedWithClubOnly,
    clubId,
    searchQuery,
    selectedCategory,
    selectedSport,
    selectedLanguage,
    pagination.page,
    pagination.limit,
    sports,
    languages,
    fetchKey,
    postedByFilter,
    user?.id,
  ]);

  useEffect(() => {
    void loadNews();
  }, [loadNews]);

  const handleShow = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFetchKey((k) => k + 1);
  };

  const handleToggleClubGlobalNews = useCallback(
    (id: string, inClubGlobalNews: boolean) => {
      setNews((prev) =>
        prev.map((item) => (item.id === id ? { ...item, inClubGlobalNews } : item)),
      );
    },
    [],
  );

  const handleToggleMovesbookGlobalNews = useCallback(
    (id: string, inGlobalNews: boolean) => {
      setNews((prev) =>
        prev.map((item) => (item.id === id ? { ...item, inGlobalNews } : item)),
      );
    },
    [],
  );

  const handleDeleteOwnedNews = useCallback(
    async (id: string) => {
      if (!confirm('Are you sure you want to delete this news article?')) return;
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
        if (!token) {
          alert('Please log in to delete news articles');
          return;
        }
        const res = await fetch(`/api/news/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || 'Failed to delete news');
        }
        setNews((prev) => prev.filter((item) => item.id !== id));
        setPagination((prev) => ({
          ...prev,
          total: Math.max(0, prev.total - 1),
        }));
      } catch (error) {
        console.error('Error deleting news:', error);
        alert(error instanceof Error ? error.message : 'Failed to delete news article');
      }
    },
    [],
  );

  const [clubGlobalShareTarget, setClubGlobalShareTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const clubGlobalShareDestinations = useMemo(
    () => ({ clubFeed: false as const, global: true as const }),
    [],
  );

  const isClubAdmin = Boolean(user?.userType && isClubAccountUserType(user.userType));
  const showClubGlobalActions = Boolean(isClubAdmin && clubId);
  const ownerEditQuery = useMemo(() => {
    const params = new URLSearchParams({ from: 'club' });
    if (clubId) params.set('clubId', clubId);
    return params.toString();
  }, [clubId]);
  const currentLanguageCode =
    languages.find((l) => l.id === selectedLanguage)?.code || 'en';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
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

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
        {isClubAdmin && (
          <div className="mb-4 flex justify-end">
            <Link
              href={
                clubId
                  ? `/news-by-movesbook/add?clubId=${encodeURIComponent(clubId)}&from=club`
                  : '/news-by-movesbook/add'
              }
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700 sm:px-4 sm:text-base"
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>{t('news_add_article')}</span>
            </Link>
          </div>
        )}

        <NewsToolbox
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedSport={selectedSport}
          setSelectedSport={setSelectedSport}
          selectedLanguage={selectedLanguage}
          setSelectedLanguage={setSelectedLanguage}
          onShow={handleShow}
          categories={categories}
          sports={sports}
          languages={languages}
        />

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('news_loading')}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
            {error}
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <label className="flex items-center gap-1">
                <span>Rows</span>
                <select
                  value={pagination.limit}
                  onChange={(e) => {
                    setPagination((prev) => ({
                      ...prev,
                      limit: Number(e.target.value) || 10,
                      page: 1,
                    }));
                  }}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  {[5, 10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                }
                className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40"
              >
                prev
              </button>
              <span className="rounded border border-gray-300 px-2 py-1">{pagination.page}</span>
              <button
                type="button"
                disabled={pagination.page >= (pagination.totalPages || 1)}
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    page: Math.min(prev.totalPages || 1, prev.page + 1),
                  }))
                }
                className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40"
              >
                next
              </button>

              <fieldset className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-800">
                <legend className="sr-only">Filter by poster</legend>
                {POSTED_BY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="inline-flex cursor-pointer items-center gap-1.5 select-none"
                  >
                    <input
                      type="radio"
                      name="my-news-posted-by"
                      value={opt.value}
                      checked={postedByFilter === opt.value}
                      onChange={() => {
                        setPostedByFilter(opt.value);
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                      onClick={() => {
                        if (postedByFilter === opt.value) {
                          setPostedByFilter('');
                          setPagination((prev) => ({ ...prev, page: 1 }));
                        }
                      }}
                      className="h-3.5 w-3.5 border-gray-400 text-red-600 focus:ring-red-500"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </fieldset>
            </div>

            <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
              <div className={hideShowStatus ? 'lg:col-span-3' : 'lg:col-span-2'}>
                {news.length > 0 ? (
                  <NewsList
                    news={news}
                    mode="default"
                    currentLanguage={currentLanguageCode}
                    hideShowStatus={hideShowStatus}
                    onHideShowChange={setHideShowStatus}
                    showShareInMyClubs={isClubAdmin}
                    clubUserType={user?.userType ?? null}
                    clubAdminUsername={user?.username ?? null}
                    showClubGlobalNews={showClubGlobalActions}
                    clubGlobalNewsClubId={showClubGlobalActions ? clubId : null}
                    onToggleClubGlobalNews={handleToggleClubGlobalNews}
                    onRequestClubGlobalShare={(id, articleTitle) =>
                      setClubGlobalShareTarget({ id, title: articleTitle })
                    }
                    showMovesbookGlobalNews={Boolean(
                      isClubAdmin && enableMovesbookGlobalShare,
                    )}
                    onToggleMovesbookGlobalNews={handleToggleMovesbookGlobalNews}
                    showOwnerEditDelete={isClubAdmin}
                    currentUserId={user?.id ?? null}
                    ownerEditQuery={ownerEditQuery}
                    onDeleteOwnedNews={handleDeleteOwnedNews}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                    <p className="text-sm text-gray-600">{t('news_no_news_found')}</p>
                    {sharedWithClubOnly ? (
                      <p className="mt-2 text-xs text-gray-500">
                        Use &quot;Share in My Clubs&quot; on News articles to add items here.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              {!hideShowStatus && (
                <div className="lg:col-span-1">
                  <GetSocialBlock />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {clubGlobalShareTarget && clubId ? (
        <ShareInMyClubsModal
          isOpen
          onClose={() => setClubGlobalShareTarget(null)}
          kind="news"
          itemId={clubGlobalShareTarget.id}
          itemTitle={clubGlobalShareTarget.title}
          adminUsername={user?.username ?? undefined}
          preferredClubId={clubId}
          initialDestinations={clubGlobalShareDestinations}
          onShared={(sharedClubId) => {
            if (sharedClubId === clubId) {
              handleToggleClubGlobalNews(clubGlobalShareTarget.id, true);
            }
            setClubGlobalShareTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}
