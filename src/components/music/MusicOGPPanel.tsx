'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import NewsTopicBar, { type NewsTopic, ALL_TOPICS } from '@/app/news/components/NewsTopicBar';
import NewTopicModal from '@/app/news/components/NewTopicModal';
import NewsTopicSortModal from '@/app/news/components/NewsTopicSortModal';
import OGPForm from '@/app/news/components/OGPForm';
import NewsArticlesList, { type ArticlePasted } from '@/app/news/components/NewsArticlesList';
import MusicOGPStatisticsModal from '@/components/music/MusicOGPStatisticsModal';
import { useAuth } from '@/hooks/useAuth';
import { useNewsData } from '@/hooks/useNewsData';
import { defaultSettings } from '@/app/news/components/NewsSettingModal';

/** Music has no built-in default topics; users add their own via "Add topic". */
export const MUSIC_TOPICS = [] as const;

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

interface MusicOGPPanelProps {
  onClose: () => void;
  embedded?: boolean;
  isExpanded?: boolean;
  onExpandReduce?: () => void;
  /** When true, use adminToken / adminUser (superadmin admin panel). */
  adminContext?: boolean;
}

export default function MusicOGPPanel({
  onClose,
  embedded = true,
  isExpanded = false,
  onExpandReduce,
  adminContext = false,
}: MusicOGPPanelProps) {
  const {
    topics,
    customTopics,
    topicNamesCreatedBySuperAdmin,
    pastedArticles,
    ogpNewsGroups,
    typedArticles,
    loading,
    error,
    addTopic,
    updateTopic,
    deleteTopic,
    saveTopicOrder,
    topicGenreOrder,
    hiddenTopics,
    hiddenGenres,
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
    apiBase: MUSIC_API_BASE,
    defaultTopics: MUSIC_TOPICS,
    adminContext,
  });
  const { user } = useAuth();
  const adminUser = adminContext
    ? (() => {
        if (typeof window === 'undefined') return null;
        try {
          const raw = localStorage.getItem('adminUser');
          if (!raw) return null;
          return JSON.parse(raw) as { id: string; name?: string; userType?: string };
        } catch {
          return null;
        }
      })()
    : null;

  const effectiveUserId = adminContext ? (adminUser?.id ?? null) : (user?.id ?? null);
  const canDeleteOgp = adminContext || user?.userType === 'ADMIN';

  const [activeTopic, setActiveTopic] = useState<NewsTopic | null>(ALL_TOPICS);
  const prevLoading = useRef(true);
  const [showNewTopicModal, setShowNewTopicModal] = useState(false);
  const [showTopicSortModal, setShowTopicSortModal] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [topicModalEditing, setTopicModalEditing] = useState<string | null>(null);
  const [topicModalEditingId, setTopicModalEditingId] = useState<string | null>(null);
  const [showOgpForm, setShowOgpForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<ArticlePasted | null>(null);
  const [putInFavourites, setPutInFavourites] = useState(false);
  const [musicalGenres, setMusicalGenres] = useState<string[]>([]);
  const [activeMusicalGenre, setActiveMusicalGenre] = useState<string | null>(null);

  const getAuthHeaders = useCallback((): HeadersInit => {
    if (typeof window === 'undefined') return {};
    const token = adminContext
      ? localStorage.getItem('adminToken')
      : localStorage.getItem('token');
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [adminContext]);

  useEffect(() => {
    if (!effectiveUserId) {
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
  }, [effectiveUserId, getAuthHeaders]);

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

  useEffect(() => {
    if (prevLoading.current && !loading) {
      setActiveTopic(topics.length > 0 ? topics[0] : ALL_TOPICS);
    }
    prevLoading.current = loading;
  }, [loading, topics]);

  /** Topics shown in the topic bar (excludes hidden topics). */
  const visibleTopics = topics.filter((t) => !hiddenTopics.includes(t));

  /** Genres used by music under the selected topic (from OGP articles). When "All" is selected, show every topic's genres. */
  const topicGenresFromArticles = buildTopicGenresFromArticles(pastedArticles, topics);

  const genresForActiveTopic = (() => {
    if (activeTopic && activeTopic !== ALL_TOPICS) {
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
  })();

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

  useEffect(() => {
    if (!activeMusicalGenre) return;
    if (!genresForActiveTopic.includes(activeMusicalGenre)) {
      setActiveMusicalGenre(null);
    }
  }, [activeMusicalGenre, genresForActiveTopic]);

  useEffect(() => {
    if (!activeTopic || activeTopic === ALL_TOPICS) return;
    if (hiddenTopics.includes(activeTopic)) {
      setActiveTopic(visibleTopics[0] ?? ALL_TOPICS);
      setActiveMusicalGenre(null);
    }
  }, [activeTopic, hiddenTopics, visibleTopics]);

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
        throw e;
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
      throw e;
    }
  }, [topicModalEditingId, topicModalEditing, activeTopic, topics, deleteTopic]);

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

  const handlePastedArticle = useCallback(
    async (data: Parameters<Parameters<typeof OGPForm>[0]['onPastedArticle']>[0]) => {
      try {
        const payload = { ...data, isFavourite: putInFavourites };
        if (editingArticle) {
          await updatePastedArticle(editingArticle.id, payload);
        } else {
          if (!activeTopic || activeTopic === ALL_TOPICS) {
            throw new Error('Select a topic before adding music');
          }
          await addPastedArticle(payload, activeTopic);
        }
        await rememberMusicalGenre(data.musicalGenre);
        closeOgpForm();
      } catch (e) {
        console.error(e);
        throw e;
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

  const handleUpdatePastedSettings = useCallback(
    async (id: string, settings: { userTypes: string[]; countries: string[]; languages: string[]; sports: string[]; expiresAt: string | null }) => {
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
        throw e;
      }
    },
    [addTypedArticle, rememberMusicalGenre, putInFavourites, closeOgpForm]
  );

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

  return (
    <div
      className={`flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${
        embedded ? 'h-full min-h-0 flex-1' : ''
      }`}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">Music</h2>
        <div className="flex items-center gap-2">
          {adminContext ? (
            <button
              type="button"
              onClick={() => setShowStatistics(true)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-[#1a2744] border border-[#1a2744]/40 hover:bg-[#1a2744] hover:text-white transition-colors"
            >
              Statistic
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {loading && (
          <p className="text-sm text-gray-500 mb-4">Loading music...</p>
        )}
        {error && (
          <p className="text-sm text-red-600 mb-4">{error}</p>
        )}
        <NewsTopicBar
          topics={visibleTopics}
          activeTopic={activeTopic}
          onTopicSelect={handleTopicSelect}
          onAddNewTopic={handleOpenTopicModal}
          onAddTopic={handleOpenAddTopicModal}
          isExpanded={isExpanded}
          onExpandReduce={onExpandReduce ?? (() => {})}
          onOpenTopicSort={() => setShowTopicSortModal(true)}
          topicNamesCreatedBySuperAdmin={topicNamesCreatedBySuperAdmin}
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
          topics={topics}
          topicGenres={topicGenresFromArticles}
          savedGenreOrder={topicGenreOrder}
          savedHiddenTopics={hiddenTopics}
          savedHiddenGenres={hiddenGenres}
          onSave={async (ordered, genreOrder, hidden) => {
            await saveTopicOrder(ordered, genreOrder, hidden);
          }}
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
              className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.key === 'Escape' && closeOgpForm()}
            >
              <div className="flex items-center gap-3 mb-4">
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
        )}

        <NewsArticlesList
          pasted={pastedArticles}
          typed={typedArticles}
          activeTopic={activeTopic}
          topics={topics}
          onRemovePasted={handleRemovePasted}
          onRemoveTyped={handleRemoveTyped}
          canDeleteOgp={canDeleteOgp}
          currentUserId={effectiveUserId}
          currentUserCountry={user?.country ?? null}
          onUpdatePastedSettings={handleUpdatePastedSettings}
          onUpdatePastedTopic={handleUpdatePastedTopic}
          onEditPasted={handleEditPasted}
          onAddClick={() => {
            setEditingArticle(null);
            setPutInFavourites(false);
            setShowOgpForm((prev) => !prev);
          }}
          addButtonDisabled={!activeTopic || activeTopic === ALL_TOPICS}
          apiBase={MUSIC_API_BASE}
          musicalGenresForFilter={genresForActiveTopic}
          activeMusicalGenre={activeMusicalGenre}
          onMusicalGenreSelect={handleMusicalGenreSelect}
          ogpNewsGroups={ogpNewsGroups}
          onSaveOgpNewsGroup={saveOgpNewsGroup}
          onCreateTopic={addTopic}
          onRemoveOgpNewsGroup={removeOgpNewsGroup}
          onUpdateOgpNewsGroup={updateOgpNewsGroup}
          onUpdateOgpNewsGroupSettings={updateOgpNewsGroupSettings}
        />
      </div>

      {adminContext ? (
        <MusicOGPStatisticsModal
          open={showStatistics}
          onClose={() => setShowStatistics(false)}
          getAuthHeaders={getAuthHeaders}
        />
      ) : null}
    </div>
  );
}
