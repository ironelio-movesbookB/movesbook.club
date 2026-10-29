'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useNewsData } from '@/hooks/useNewsData';
import NewsTopicBar, { type NewsTopic, ALL_TOPICS, ALL_SUPER_ADMIN } from '@/app/news/components/NewsTopicBar';
import NewTopicModal from '@/app/news/components/NewTopicModal';
import NewsTopicSortModal from '@/app/news/components/NewsTopicSortModal';
import OGPForm from '@/app/news/components/OGPForm';
import NewsArticlesList, { type ArticlePasted } from '@/app/news/components/NewsArticlesList';
import MusicOGPStatisticsModal from '@/components/music/MusicOGPStatisticsModal';
import { ADMIN_OGP_EXPAND_EVENT } from '@/lib/adminOgpExpand';
import { defaultSettings } from '@/app/news/components/NewsSettingModal';
import { resolveIsSuperAdminFromStorage } from '@/lib/panelSession';

/** Music has no built-in default topics; users add their own via "Add topic". */
const MUSIC_TOPICS = [] as const;

const MUSIC_API_BASE = '/api/music';

function buildTopicGenresFromArticles(
  articles: { topic?: string; genre?: string | null }[],
  topics: string[]
): Record<string, string[]> {
  const map: Record<string, Set<string>> = {};
  for (const topic of topics) map[topic] = new Set();
  for (const a of articles) {
    const g = typeof a.genre === 'string' ? a.genre.trim() : '';
    if (!g || !a.topic) continue;
    if (!map[a.topic]) map[a.topic] = new Set();
    map[a.topic].add(g);
  }
  const result: Record<string, string[]> = {};
  for (const [topic, set] of Object.entries(map)) {
    if (set.size > 0) result[topic] = Array.from(set);
  }
  return result;
}

function applySavedGenreOrderForTopics(
  topics: string[],
  topicGenres: Record<string, string[]>,
  savedOrder: Record<string, string[]>,
  hiddenTopics: string[] = [],
  hiddenGenres: Record<string, string[]> = {}
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const topic of topics) {
    if (hiddenTopics.includes(topic)) continue;
    const genres = topicGenres[topic] ?? [];
    if (genres.length === 0) continue;
    const saved = savedOrder[topic] ?? [];
    const ordered = saved.filter((g) => genres.includes(g));
    for (const g of genres) {
      if (!ordered.includes(g)) ordered.push(g);
    }
    const topicHiddenGenres = new Set(hiddenGenres[topic] ?? []);
    for (const g of ordered) {
      if (topicHiddenGenres.has(g)) continue;
      if (!seen.has(g)) {
        seen.add(g);
        result.push(g);
      }
    }
  }
  return result;
}

export interface AdminSuperAdminOGPMusicContentProps {
  /** Target for the header close (X) link — default returns to admin home without query params */
  closeHref?: string;
}

/**
 * Superadmin OGP / Music admin UI.
 * Embedded on /admin/dashboard when opened from Music → OG Music panel.
 */
export default function AdminSuperAdminOGPMusicContent({
  closeHref = '/admin/dashboard',
}: AdminSuperAdminOGPMusicContentProps) {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<{ id: string; name?: string } | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  /** Super admin: simulate normal user — show OGPs visible to this username (all topics). */
  const [viewAsUsername, setViewAsUsername] = useState<string | null>(null);
  const topicBeforeViewAsRef = useRef<NewsTopic | null>(null);
  const [activeTopic, setActiveTopic] = useState<NewsTopic | null>(null);
  const [activeMusicalGenre, setActiveMusicalGenre] = useState<string | null>(null);

  const {
    topics,
    customTopics,
    topicNamesCreatedByNormalUsers,
    userInsertedTopics,
    pastedArticles,
    ogpNewsGroups,
    typedArticles,
    viewAsUserId,
    viewAsUserCountry,
    loading,
    error,
    refresh,
    saveTopicOrder,
    topicGenreOrder,
    hiddenTopics,
    hiddenGenres,
    addTopic,
    updateTopic,
    deleteTopic,
    addPastedArticle,
    removePastedArticle,
    updatePastedArticleSettings,
    updatePastedArticleTopic,
    updatePastedArticle,
    saveOgpNewsGroup,
    removeOgpNewsGroup,
    updateOgpNewsGroup,
    updateOgpNewsGroupSettings,
    addTypedArticle,
    removeTypedArticle,
  } = useNewsData({
    adminContext: true,
    viewAsUsername,
    apiBase: MUSIC_API_BASE,
    defaultTopics: MUSIC_TOPICS,
  });

  const prevLoading = useRef(true);

  const getAuthHeaders = useCallback((): HeadersInit => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('adminToken');
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, []);

  const [musicalGenres, setMusicalGenres] = useState<string[]>([]);

  useEffect(() => {
    if (!adminUser?.id) {
      setMusicalGenres([]);
      return;
    }
    let cancelled = false;
    fetch(`${MUSIC_API_BASE}/genres`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : { genres: [] }))
      .then((data) => {
        if (!cancelled) setMusicalGenres(Array.isArray(data.genres) ? data.genres : []);
      })
      .catch(() => {
        if (!cancelled) setMusicalGenres([]);
      });
    return () => {
      cancelled = true;
    };
  }, [adminUser?.id, getAuthHeaders]);

  const rememberMusicalGenre = useCallback(
    async (genre: string | null | undefined) => {
      const name = typeof genre === 'string' ? genre.trim() : '';
      if (!name) return;
      try {
        const res = await fetch(`${MUSIC_API_BASE}/genres`, {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ genre: name }),
        });
        if (!res.ok) {
          setMusicalGenres((prev) => (prev.includes(name) ? prev : [...prev, name]));
          return;
        }
        const data = await res.json();
        if (Array.isArray(data.genres)) setMusicalGenres(data.genres);
        else setMusicalGenres((prev) => (prev.includes(name) ? prev : [...prev, name]));
      } catch (e) {
        console.error(e);
        setMusicalGenres((prev) => (prev.includes(name) ? prev : [...prev, name]));
      }
    },
    [getAuthHeaders]
  );

  /** In “see as user” mode, topic bar lists defaults + this user’s custom topics (no dropdown). */
  const topicsForTopicBar = useMemo(() => {
    const visible = topics.filter((t) => !hiddenTopics.includes(t));
    if (!viewAsUsername?.trim()) return visible;
    const v = viewAsUsername.trim().toLowerCase();
    const insertedByOthers = new Set(
      userInsertedTopics.filter((x) => (x.creatorUsername ?? '').toLowerCase() !== v).map((x) => x.name)
    );
    return visible.filter((t) => !insertedByOthers.has(t));
  }, [topics, hiddenTopics, userInsertedTopics, viewAsUsername]);

  const topicGenresFromArticles = buildTopicGenresFromArticles(pastedArticles, topics);

  const genresForActiveTopic = useMemo(() => {
    if (activeTopic && activeTopic !== ALL_TOPICS && activeTopic !== ALL_SUPER_ADMIN) {
      if (hiddenTopics.includes(activeTopic)) return [];
      const fromArticles = new Set(topicGenresFromArticles[activeTopic] ?? []);
      const saved = topicGenreOrder[activeTopic] ?? [];
      const ordered = saved.filter((g) => fromArticles.has(g));
      for (const g of fromArticles) {
        if (!ordered.includes(g)) ordered.push(g);
      }
      const topicHiddenGenres = new Set(hiddenGenres[activeTopic] ?? []);
      return ordered.filter((g) => !topicHiddenGenres.has(g));
    }

    return applySavedGenreOrderForTopics(
      topics,
      topicGenresFromArticles,
      topicGenreOrder,
      hiddenTopics,
      hiddenGenres
    );
  }, [activeTopic, hiddenTopics, topicGenresFromArticles, topicGenreOrder, hiddenGenres, topics]);

  useEffect(() => {
    if (prevLoading.current && !loading && topics.length > 0 && !viewAsUsername) {
      setActiveTopic(topics[0]);
    }
    prevLoading.current = loading;
  }, [loading, topics, viewAsUsername]);

  useEffect(() => {
    if (!activeMusicalGenre) return;
    if (!genresForActiveTopic.includes(activeMusicalGenre)) {
      setActiveMusicalGenre(null);
    }
  }, [activeMusicalGenre, genresForActiveTopic]);

  const handleSuperAdminViewAsUser = useCallback(
    (username: string) => {
      topicBeforeViewAsRef.current = activeTopic;
      setViewAsUsername(username.trim());
      setActiveTopic(ALL_TOPICS);
      setActiveMusicalGenre(null);
    },
    [activeTopic]
  );

  const handleBackFromViewAsUser = useCallback(() => {
    setViewAsUsername(null);
    const prev = topicBeforeViewAsRef.current;
    topicBeforeViewAsRef.current = null;
    setActiveTopic(prev ?? ALL_SUPER_ADMIN);
    setActiveMusicalGenre(null);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('adminUser');
    if (raw) {
      try {
        const u = JSON.parse(raw);
        setAdminUser(u?.id ? { id: u.id, name: u.name } : null);
        if (!u?.id) router.replace('/admin/dashboard');
        else {
          setIsSuperAdmin(resolveIsSuperAdminFromStorage(u));
        }
      } catch {
        router.replace('/admin/dashboard');
      }
    } else {
      const superRaw = localStorage.getItem('superAdminUser');
      if (superRaw) {
        try {
          const su = JSON.parse(superRaw);
          if (su?.id) {
            const u = { id: su.id, name: su.name ?? su.username };
            localStorage.setItem('adminUser', JSON.stringify(u));
            setAdminUser(u);
            setIsSuperAdmin(true);
          } else {
            router.replace('/admin/dashboard');
          }
        } catch {
          router.replace('/admin/dashboard');
        }
      } else {
        router.replace('/admin/dashboard');
      }
    }
    setAuthChecked(true);
  }, [router]);

  const [showOgpForm, setShowOgpForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<ArticlePasted | null>(null);
  const [showNewTopicModal, setShowNewTopicModal] = useState(false);
  const [showTopicSortModal, setShowTopicSortModal] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [topicModalEditing, setTopicModalEditing] = useState<string | null>(null);
  const [topicModalEditingId, setTopicModalEditingId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [putInFavourites, setPutInFavourites] = useState(false);

  const closeOgpForm = useCallback(() => {
    setShowOgpForm(false);
    setEditingArticle(null);
    setPutInFavourites(false);
  }, []);

  const handleEditPasted = useCallback((article: ArticlePasted) => {
    setEditingArticle(article);
    setPutInFavourites(article.isFavourite === true);
    setShowOgpForm(true);
  }, []);

  const handleTopicSelect = useCallback((topic: NewsTopic) => {
    setActiveTopic(topic);
    setActiveMusicalGenre(null);
  }, []);

  const handleMusicalGenreSelect = useCallback((genre: string | null) => {
    setActiveMusicalGenre(genre);
  }, []);

  const handleMusicalGenreChipSelect = useCallback((genre: string) => {
    setActiveMusicalGenre((prev) => (prev === genre ? null : genre));
  }, []);

  const handleOpenTopicModal = useCallback(() => {
    setTopicModalEditing(activeTopic ?? null);
    setTopicModalEditingId(customTopics.find((c) => c.name === (activeTopic ?? ''))?.id ?? null);
    setShowNewTopicModal(true);
  }, [activeTopic, customTopics]);

  const handleOpenAddTopicModal = useCallback(() => {
    setTopicModalEditing(null);
    setTopicModalEditingId(null);
    setShowNewTopicModal(true);
  }, []);

  const handleSaveTopic = useCallback(
    async (name: string) => {
      try {
        if (topicModalEditingId) {
          await updateTopic(topicModalEditingId, name);
          if (activeTopic === topicModalEditing) setActiveTopic(name);
        } else {
          await addTopic(name);
          setActiveTopic(name);
        }
        setTopicModalEditing(null);
        setTopicModalEditingId(null);
        setShowNewTopicModal(false);
      } catch (e) {
        console.error(e);
      }
    },
    [topicModalEditingId, topicModalEditing, activeTopic, updateTopic, addTopic]
  );

  const handleDeleteTopic = useCallback(async () => {
    if (!topicModalEditingId) return;
    try {
      await deleteTopic(topicModalEditingId);
      if (activeTopic === topicModalEditing) {
        const remaining = topics.filter((t) => t !== topicModalEditing);
        setActiveTopic(remaining[0] ?? null);
      }
      setTopicModalEditing(null);
      setTopicModalEditingId(null);
      setShowNewTopicModal(false);
    } catch (e) {
      console.error(e);
    }
  }, [topicModalEditingId, topicModalEditing, activeTopic, topics, deleteTopic]);

  const handleRemovePasted = useCallback(
    async (id: string) => {
      try {
        await removePastedArticle(id);
      } catch (e) {
        console.error(e);
      }
    },
    [removePastedArticle]
  );

  const handleRemoveTyped = useCallback(
    async (id: string) => {
      try {
        await removeTypedArticle(id);
      } catch (e) {
        console.error(e);
      }
    },
    [removeTypedArticle]
  );

  const handleUpdatePastedSettings = useCallback(
    async (
      id: string,
      settings: {
        userTypes: string[];
        countries: string[];
        languages: string[];
        sports: string[];
        expiresAt: string | null;
      }
    ) => {
      try {
        await updatePastedArticleSettings(id, settings);
      } catch (e) {
        console.error(e);
      }
    },
    [updatePastedArticleSettings]
  );

  const handleUpdatePastedTopic = useCallback(
    async (id: string, topic: string, customDescription?: string) => {
      try {
        await updatePastedArticleTopic(id, topic, customDescription);
      } catch (e) {
        console.error(e);
      }
    },
    [updatePastedArticleTopic]
  );

  const handlePastedArticle = useCallback(
    async (data: Parameters<Parameters<typeof OGPForm>[0]['onPastedArticle']>[0]) => {
      try {
        const payload = { ...data, isFavourite: putInFavourites };
        if (editingArticle) {
          await updatePastedArticle(editingArticle.id, payload);
        } else {
          if (
            !activeTopic ||
            activeTopic === ALL_TOPICS ||
            activeTopic === ALL_SUPER_ADMIN
          ) {
            throw new Error('Select a topic before adding music');
          }
          await addPastedArticle(payload, activeTopic);
        }
        await rememberMusicalGenre(data.musicalGenre);
        closeOgpForm();
      } catch (e) {
        console.error(e);
      }
    },
    [
      activeTopic,
      addPastedArticle,
      updatePastedArticle,
      editingArticle,
      rememberMusicalGenre,
      putInFavourites,
      closeOgpForm,
    ]
  );

  const handleSaveTyped = useCallback(
    async (
      description: string,
      musicalGenre?: string | null,
      meta?: { artist?: string | null; musicTitle?: string | null; registrationType?: string | null; isFavourite?: boolean }
    ) => {
      try {
        await addTypedArticle(description, { ...meta, isFavourite: putInFavourites });
        await rememberMusicalGenre(musicalGenre);
        closeOgpForm();
      } catch (e) {
        console.error(e);
      }
    },
    [addTypedArticle, rememberMusicalGenre, putInFavourites, closeOgpForm]
  );

  if (!authChecked || !adminUser) {
    return null;
  }

  return (
    <div className="p-4 md:p-6 w-full min-w-0 max-w-full box-border">
      <div className="bg-white rounded-xl shadow-md border border-gray-200 w-full min-w-0 overflow-x-auto">
        <div
          className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 gap-2 flex-wrap ${
            viewAsUsername ? 'bg-[#EFE4B0]' : 'bg-gray-50'
          }`}
        >
          {viewAsUsername ? (
            <>
              <h1 className="text-lg font-semibold text-gray-900 flex-1 min-w-0">
                Music visible by user <span className="text-pink-600">{viewAsUsername}</span>
              </h1>
              <button
                type="button"
                onClick={handleBackFromViewAsUser}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors shrink-0"
              >
                Back to Super Admin page
              </button>
            </>
          ) : (
            <h1 className="text-lg font-semibold text-gray-900">Music</h1>
          )}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {isSuperAdmin && !viewAsUsername ? (
              <button
                type="button"
                onClick={() => setShowStatistics(true)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-[#1a2744] border border-[#1a2744]/40 hover:bg-[#1a2744] hover:text-white transition-colors"
              >
                Statistic
              </button>
            ) : null}
            <a
              href={closeHref}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </a>
          </div>
        </div>

        <div className="p-4">
          {loading && <p className="text-sm text-gray-500 mb-2">Loading music...</p>}
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

          <NewsTopicBar
            topics={topicsForTopicBar}
            activeTopic={activeTopic}
            onTopicSelect={handleTopicSelect}
            onAddNewTopic={handleOpenTopicModal}
            onAddTopic={handleOpenAddTopicModal}
            isExpanded={isExpanded}
            onExpandReduce={() => {
              setIsExpanded((e) => {
                const next = !e;
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(
                    new CustomEvent(ADMIN_OGP_EXPAND_EVENT, { detail: { expanded: next } })
                  );
                }
                return next;
              });
            }}
            onOpenTopicSort={() => setShowTopicSortModal(true)}
            topicNamesCreatedByNormalUsers={topicNamesCreatedByNormalUsers}
            userInsertedTopics={userInsertedTopics}
            allTopicLabel={viewAsUsername ? 'All' : 'All defaults'}
            showSuperAdminAllButton={isSuperAdmin && !viewAsUsername}
            hideUserInsertedDropdown={!!viewAsUsername}
            disableTopicManagement={!!viewAsUsername}
            defaultTopicNames={MUSIC_TOPICS}
            musicalGenres={genresForActiveTopic}
            activeMusicalGenre={activeMusicalGenre}
            onMusicalGenreSelect={handleMusicalGenreChipSelect}
          />

          <NewTopicModal
            isOpen={showNewTopicModal}
            onClose={() => {
              setShowNewTopicModal(false);
              setTopicModalEditing(null);
              setTopicModalEditingId(null);
            }}
            onSave={handleSaveTopic}
            editingTopic={topicModalEditing}
            onDelete={topicModalEditingId ? handleDeleteTopic : undefined}
            existingTopics={topics}
          />

          <NewsTopicSortModal
            isOpen={showTopicSortModal}
            onClose={() => setShowTopicSortModal(false)}
            topics={
              isSuperAdmin && topicNamesCreatedByNormalUsers.length > 0
                ? topics.filter((t) => !topicNamesCreatedByNormalUsers.includes(t))
                : topics
            }
            topicGenres={topicGenresFromArticles}
            savedGenreOrder={topicGenreOrder}
            savedHiddenTopics={hiddenTopics}
            savedHiddenGenres={hiddenGenres}
            onSave={async (ordered, genreOrder, hidden) => {
              await saveTopicOrder(ordered, genreOrder, hidden);
            }}
            isSuperAdmin={isSuperAdmin}
            onAfterDeleteOgNews={refresh}
            apiBase={MUSIC_API_BASE}
          />

          {showOgpForm && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={closeOgpForm}
              role="dialog"
              aria-modal="true"
              aria-labelledby="music-ogp-modal-title"
            >
              <div
                className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.key === 'Escape' && closeOgpForm()}
              >
                <div className="flex justify-between items-center p-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl gap-3">
                  <h2 id="music-ogp-modal-title" className="text-lg font-semibold text-gray-900">
                    Add Music
                  </h2>
                  <label className="ml-auto inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={putInFavourites}
                      onChange={(e) => setPutInFavourites(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      aria-label="Put in my favourites"
                    />
                    <span>Put in my favourites</span>
                  </label>
                  <button
                    type="button"
                    onClick={closeOgpForm}
                    className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6">
                  <OGPForm
                    key={editingArticle?.id ?? 'new-music'}
                    variant="music"
                    isFavourite={putInFavourites}
                    initialValues={
                      editingArticle
                        ? {
                            url: editingArticle.url,
                            description: editingArticle.customDescription ?? '',
                            languageCode: editingArticle.languageCode ?? '',
                            artist: editingArticle.artist ?? '',
                            musicTitle: editingArticle.title ?? '',
                            musicalGenre: editingArticle.genre ?? '',
                            registrationType: editingArticle.registrationType ?? '',
                            visibility: editingArticle.visibility ?? defaultSettings,
                            og: {
                              title: editingArticle.title,
                              image: editingArticle.image,
                              description: editingArticle.description,
                              url: editingArticle.url,
                              siteName: editingArticle.siteName,
                              type: editingArticle.type,
                            },
                          }
                        : null
                    }
                    onPastedArticle={handlePastedArticle}
                    onSaveTyped={editingArticle ? undefined : handleSaveTyped}
                    onCancel={closeOgpForm}
                  />
                </div>
              </div>
            </div>
          )}

          <NewsArticlesList
            pasted={pastedArticles}
            typed={typedArticles}
            activeTopic={activeTopic}
            topics={topics}
            onRemovePasted={handleRemovePasted}
            onRemoveTyped={handleRemoveTyped}
            canDeleteOgp={true}
            currentUserId={viewAsUsername && viewAsUserId ? viewAsUserId : adminUser.id}
            currentUserCountry={viewAsUsername ? viewAsUserCountry : null}
            onUpdatePastedSettings={handleUpdatePastedSettings}
            onUpdatePastedTopic={handleUpdatePastedTopic}
            onEditPasted={viewAsUsername ? undefined : handleEditPasted}
            onAddClick={
              viewAsUsername
                ? undefined
                : () => {
                    setEditingArticle(null);
                    setPutInFavourites(false);
                    setShowOgpForm((prev) => !prev);
                  }
            }
            addButtonDisabled={
              !activeTopic ||
              activeTopic === ALL_TOPICS ||
              activeTopic === ALL_SUPER_ADMIN
            }
            adminContext={true}
            isSuperAdmin={isSuperAdmin}
            topicNamesCreatedByNormalUsers={topicNamesCreatedByNormalUsers}
            userInsertedTopics={userInsertedTopics}
            onSuperAdminViewAsUser={viewAsUsername ? undefined : handleSuperAdminViewAsUser}
            hideCreatorUsernameInHeading={!!viewAsUsername}
            showOnlyMyOgNewsLabelUsername={viewAsUsername}
            viewerScopedOgpList={!!viewAsUsername}
            apiBase={MUSIC_API_BASE}
            musicalGenresForFilter={genresForActiveTopic}
            activeMusicalGenre={activeMusicalGenre}
            onMusicalGenreSelect={handleMusicalGenreSelect}
            ogpNewsGroups={ogpNewsGroups}
            onSaveOgpNewsGroup={viewAsUsername ? undefined : saveOgpNewsGroup}
            onCreateTopic={viewAsUsername ? undefined : addTopic}
            onRemoveOgpNewsGroup={viewAsUsername ? undefined : removeOgpNewsGroup}
            onUpdateOgpNewsGroup={viewAsUsername ? undefined : updateOgpNewsGroup}
            onUpdateOgpNewsGroupSettings={viewAsUsername ? undefined : updateOgpNewsGroupSettings}
          />
        </div>
      </div>

      <MusicOGPStatisticsModal
        open={showStatistics}
        onClose={() => setShowStatistics(false)}
        getAuthHeaders={getAuthHeaders}
      />
    </div>
  );
}
