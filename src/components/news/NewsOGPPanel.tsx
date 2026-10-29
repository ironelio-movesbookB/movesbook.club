'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import NewsTopicBar, { type NewsTopic, ALL_TOPICS } from '@/app/news/components/NewsTopicBar';
import NewTopicModal from '@/app/news/components/NewTopicModal';
import NewsTopicSortModal from '@/app/news/components/NewsTopicSortModal';
import OGPForm from '@/app/news/components/OGPForm';
import NewsArticlesList, {
  type ArticlePasted,
  type OgpNewsGroupCard,
} from '@/app/news/components/NewsArticlesList';
import { useAuth } from '@/hooks/useAuth';
import { useNewsData } from '@/hooks/useNewsData';
import { isClubAccountUserType } from '@/utils/dashboardRouting';
import { canViewerSeeClubSharedOgp } from '@/lib/clubOgpAudience';

interface NewsOGPPanelProps {
  onClose: () => void;
  embedded?: boolean;
  isExpanded?: boolean;
  onExpandReduce?: () => void;
  /** Panel header title (default "News"). */
  title?: string;
  /** When set with sharedWithClubOnly, only show OGP articles shared to this club. */
  clubId?: string | null;
  sharedWithClubOnly?: boolean;
}

export default function NewsOGPPanel({
  onClose,
  embedded = true,
  isExpanded = false,
  onExpandReduce,
  title = 'News',
  clubId = null,
  sharedWithClubOnly = false,
}: NewsOGPPanelProps) {
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
    hiddenTopics,
    addPastedArticle,
    removePastedArticle,
    updatePastedArticleSettings,
    updatePastedArticleTopic,
    saveOgpNewsGroup,
    removeOgpNewsGroup,
    updateOgpNewsGroup,
    updateOgpNewsGroupSettings,
    addTypedArticle,
    removeTypedArticle,
  } = useNewsData();
  const { user } = useAuth();
  const isClubAdmin = user?.userType ? isClubAccountUserType(user.userType) : false;

  const [articleSharedClubIds, setArticleSharedClubIds] = useState<Record<string, string[]>>({});
  const [clubSharedArticles, setClubSharedArticles] = useState<ArticlePasted[] | null>(null);
  const [clubSharedGroups, setClubSharedGroups] = useState<OgpNewsGroupCard[] | null>(null);
  const [clubSharedLoading, setClubSharedLoading] = useState(false);

  const [activeTopic, setActiveTopic] = useState<NewsTopic | null>(null);
  const prevLoading = useRef(true);
  const [showNewTopicModal, setShowNewTopicModal] = useState(false);
  const [showTopicSortModal, setShowTopicSortModal] = useState(false);
  const [topicModalEditing, setTopicModalEditing] = useState<string | null>(null);
  const [topicModalEditingId, setTopicModalEditingId] = useState<string | null>(null);
  const [showOgpForm, setShowOgpForm] = useState(false);

  // On reload: select the first topic from the user's sorted list so the OGP area shows its OGPs.
  // Club shared view defaults to All so every shared article is visible regardless of topic.
  useEffect(() => {
    if (prevLoading.current && !loading && topics.length > 0) {
      setActiveTopic(sharedWithClubOnly ? ALL_TOPICS : topics[0]);
    }
    prevLoading.current = loading;
  }, [loading, topics, sharedWithClubOnly]);

  const reloadClubSharedArticles = useCallback(async () => {
    if (!sharedWithClubOnly || !clubId) {
      setClubSharedArticles(null);
      setClubSharedGroups(null);
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) return;
    setClubSharedLoading(true);
    try {
      const res = await fetch(
        `/api/clubs/${encodeURIComponent(clubId)}/shared-news?type=ogp&detail=full${
          isClubAdmin ? '&includeOtherClubs=1' : ''
        }`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error('Failed to load shared OGP News');
      const data = (await res.json()) as { articles?: any[]; groups?: any[] };
      const mapped: ArticlePasted[] = (data.articles ?? []).map((a) => ({
        id: a.id,
        userId: a.userId,
        creatorUsername: a.creatorUsername ?? null,
        creatorCountry: a.creatorCountry ?? null,
        createdByCurrentUser: a.createdByCurrentUser === true,
        createdBySuperAdmin: a.createdBySuperAdmin === true,
        title: a.title,
        image: a.image,
        description: a.description,
        url: a.url,
        siteName: a.siteName,
        type: a.type,
        customDescription: a.customDescription,
        topic: a.topic,
        languageCode: a.languageCode ?? undefined,
        savedAt: a.savedAt,
        inGlobalNews: a.inGlobalNews === true,
        inClubGlobalNews: a.inClubGlobalNews === true,
        clubAudienceMode: a.clubAudienceMode ?? 'me-and-club-members',
        deletedAt: a.deletedAt,
        deletedByUserId: a.deletedByUserId,
        sharedClubIds: a.sharedClubIds ?? [clubId],
        sharedClubId: a.sharedClubId ?? clubId,
        sharedClubUsername: a.sharedClubUsername ?? null,
        isFromOtherClub: a.isFromOtherClub === true,
        visibility: {
          userTypes: a.visibilityUserTypes ?? [],
          countries: a.visibilityCountries ?? [],
          languages: a.visibilityLanguages ?? [],
          sports: a.visibilitySports ?? [],
          expiresAt: a.expiresAt ?? null,
        },
      }));
      const mappedGroups: OgpNewsGroupCard[] = (data.groups ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        topic: g.topic,
        savedAt: g.savedAt,
        memberCount: g.memberCount ?? (g.memberIds?.length ?? 0),
        memberIds: Array.isArray(g.memberIds) ? g.memberIds : [],
        userId: g.userId,
        creatorUsername: g.creatorUsername ?? null,
        creatorName: g.creatorName ?? g.creatorUsername ?? null,
        creatorCountry: g.creatorCountry ?? null,
        createdByCurrentUser: g.createdByCurrentUser === true,
        title: g.title,
        image: g.image,
        coverImage: g.coverImage ?? null,
        description: g.description,
        url: g.url ?? '',
        siteName: g.siteName,
        type: g.type,
        customDescription: g.customDescription,
        deletedAt: g.deletedAt ?? null,
        clubAudienceMode: g.clubAudienceMode ?? g.audienceMode ?? 'me-and-club-members',
        inClubGlobalNews: g.inClubGlobalNews === true,
        sharedClubIds: g.sharedClubIds ?? [clubId],
        sharedClubId: g.sharedClubId ?? clubId,
        sharedClubUsername: g.sharedClubUsername ?? null,
        isFromOtherClub: g.isFromOtherClub === true,
        visibility: {
          userTypes: g.visibilityUserTypes ?? [],
          countries: g.visibilityCountries ?? [],
          languages: g.visibilityLanguages ?? [],
          sports: g.visibilitySports ?? [],
          expiresAt: g.expiresAt ?? null,
        },
        previewTopic: g.previewTopic ?? g.topic,
        previewCreatorUsername: g.previewCreatorUsername ?? g.creatorUsername ?? null,
      }));
      setClubSharedArticles(mapped);
      setClubSharedGroups(mappedGroups);
      setArticleSharedClubIds((prev) => {
        const next = { ...prev };
        for (const article of mapped) {
          const existing = next[article.id] ?? [];
          if (!existing.includes(clubId)) next[article.id] = [...existing, clubId];
        }
        for (const group of mappedGroups) {
          const existing = next[group.id] ?? [];
          if (!existing.includes(clubId)) next[group.id] = [...existing, clubId];
        }
        return next;
      });
    } catch {
      setClubSharedArticles([]);
      setClubSharedGroups([]);
    } finally {
      setClubSharedLoading(false);
    }
  }, [sharedWithClubOnly, clubId, isClubAdmin]);

  useEffect(() => {
    if (!sharedWithClubOnly || !clubId) {
      setClubSharedArticles(null);
      setClubSharedGroups(null);
      return;
    }
    void reloadClubSharedArticles();
  }, [sharedWithClubOnly, clubId, reloadClubSharedArticles]);

  const handleArticleSharedClubIdsChange = useCallback(
    (articleId: string, clubIds: string[]) => {
      setArticleSharedClubIds((prev) => ({ ...prev, [articleId]: clubIds }));
      if (sharedWithClubOnly && clubId && !clubIds.includes(clubId)) {
        setClubSharedArticles((prev) =>
          prev ? prev.filter((a) => a.id !== articleId) : prev,
        );
        setClubSharedGroups((prev) =>
          prev ? prev.filter((g) => g.id !== articleId) : prev,
        );
      }
    },
    [sharedWithClubOnly, clubId],
  );

  const handleToggleClubGlobalNews = useCallback(
    (itemId: string, inClubGlobalNews: boolean) => {
      setClubSharedArticles((prev) =>
        prev
          ? prev.map((a) => (a.id === itemId ? { ...a, inClubGlobalNews } : a))
          : prev,
      );
      setClubSharedGroups((prev) =>
        prev
          ? prev.map((g) => (g.id === itemId ? { ...g, inClubGlobalNews } : g))
          : prev,
      );
      if (inClubGlobalNews && clubId) {
        setArticleSharedClubIds((prev) => {
          const existing = prev[itemId] ?? [];
          if (existing.includes(clubId)) return prev;
          return { ...prev, [itemId]: [...existing, clubId] };
        });
      }
    },
    [clubId],
  );

  const handleArticleClubAudienceModeChange = useCallback(
    (articleId: string, mode: NonNullable<ArticlePasted['clubAudienceMode']>) => {
      setClubSharedArticles((prev) =>
        prev
          ? prev.map((a) => (a.id === articleId ? { ...a, clubAudienceMode: mode } : a))
          : prev,
      );
    },
    [],
  );

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

  const handlePastedArticle = useCallback(
    async (data: Parameters<Parameters<typeof OGPForm>[0]['onPastedArticle']>[0]) => {
      try {
        const topicForSave =
          activeTopic && activeTopic !== ALL_TOPICS
            ? activeTopic
            : topics.find((t) => t !== ALL_TOPICS) ?? 'News';
        const shareToClubId =
          sharedWithClubOnly && clubId && isClubAdmin ? clubId : null;
        await addPastedArticle(data, topicForSave, { shareToClubId });
        setShowOgpForm(false);
        if (shareToClubId) {
          await reloadClubSharedArticles();
        }
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
    [
      activeTopic,
      topics,
      addPastedArticle,
      sharedWithClubOnly,
      clubId,
      isClubAdmin,
      reloadClubSharedArticles,
    ]
  );

  const handleSaveOgpNewsGroup = useCallback(
    async (payload: {
      name: string;
      topic: string;
      articleIds: string[];
      confirmExisting?: boolean;
      coverImage?: string | null;
    }) => {
      const result = await saveOgpNewsGroup(payload);
      // Groups appear when all members are already club-shared; refresh so UI stays in sync.
      if (sharedWithClubOnly && clubId) {
        await reloadClubSharedArticles();
      }
      return result;
    },
    [saveOgpNewsGroup, sharedWithClubOnly, clubId, reloadClubSharedArticles]
  );

  const handleUpdatePastedSettings = useCallback(
    async (id: string, settings: {
      userTypes: string[];
      countries: string[];
      languages: string[];
      sports: string[];
      expiresAt: string | null;
    }) => {
      try {
        await updatePastedArticleSettings(id, settings);
        if (sharedWithClubOnly) {
          setClubSharedArticles((prev) =>
            prev
              ? prev.map((a) =>
                  a.id === id
                    ? {
                        ...a,
                        visibility: {
                          userTypes: settings.userTypes ?? [],
                          countries: settings.countries ?? [],
                          languages: settings.languages ?? [],
                          sports: settings.sports ?? [],
                          expiresAt: settings.expiresAt ?? null,
                        },
                      }
                    : a,
                )
              : prev,
          );
        }
      } catch (e) {
        console.error(e);
      }
    },
    [updatePastedArticleSettings, sharedWithClubOnly]
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
    async (description: string) => {
      try {
        await addTypedArticle(description);
        setShowOgpForm(false);
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
    [addTypedArticle]
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

  const pastedWithClubShares = pastedArticles.map((a) => ({
    ...a,
    sharedClubIds: articleSharedClubIds[a.id] ?? a.sharedClubIds,
  }));

  const filterToClubShared = Boolean(sharedWithClubOnly && clubId);
  const clubSharedIdSet = new Set((clubSharedArticles ?? []).map((a) => a.id));
  const visiblePasted = filterToClubShared
    ? (clubSharedArticles ?? []).map((a) => ({
        ...a,
        sharedClubIds: articleSharedClubIds[a.id] ?? a.sharedClubIds ?? [clubId],
        isOgpGroup: false,
      }))
    : pastedWithClubShares;
  /**
   * Club OGP News feed = shared singles plus groups shared directly to the club.
   * Groups whose members are all individually shared still appear (legacy behavior).
   * When includeOtherClubs is on, clubSharedGroups already contains other-club shares.
   */
  const visibleGroups = filterToClubShared
    ? (() => {
        const fromApi = (clubSharedGroups ?? []).map((g) => ({
          ...g,
          sharedClubIds: articleSharedClubIds[g.id] ?? g.sharedClubIds ?? [clubId!],
        }));
        const fromApiIds = new Set(fromApi.map((g) => g.id));
        const legacy = ogpNewsGroups
          .filter((g) => {
            if (fromApiIds.has(g.id)) return false;
            if ((g.memberIds?.length ?? 0) === 0) return false;
            if (!(g.memberIds ?? []).every((id) => clubSharedIdSet.has(id))) return false;
            if (isClubAdmin) return true;
            return canViewerSeeClubSharedOgp({
              audienceMode: g.clubAudienceMode,
              isClubAdmin: false,
              isClubMember: true,
              viewer: {
                userType: user?.userType ?? '',
                country: user?.country ?? null,
                languageCode: 'en',
                sports: [],
              },
              visibility: {
                userTypes: g.visibility?.userTypes ?? [],
                countries: g.visibility?.countries ?? [],
                languages: g.visibility?.languages ?? [],
                sports: g.visibility?.sports ?? [],
                expiresAt: g.visibility?.expiresAt ?? null,
              },
            });
          })
          .map((g) => ({
            ...g,
            sharedClubIds:
              articleSharedClubIds[g.id] ?? g.sharedClubIds ?? (clubId ? [clubId] : undefined),
          }));
        return [...fromApi, ...legacy];
      })()
    : ogpNewsGroups.map((g) => ({
        ...g,
        sharedClubIds: articleSharedClubIds[g.id] ?? g.sharedClubIds,
      }));

  return (
    <div
      className={`flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${
        embedded ? 'flex-1 min-h-0 max-h-[158vh]' : ''
      }`}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 p-4">
        {(loading || clubSharedLoading) && (
          <p className="text-sm text-gray-500 mb-4">Loading news...</p>
        )}
        {error && (
          <p className="text-sm text-red-600 mb-4">{error}</p>
        )}
        <NewsTopicBar
          topics={topics.filter((t) => !hiddenTopics.includes(t))}
          activeTopic={activeTopic}
          onTopicSelect={setActiveTopic}
          onAddNewTopic={handleOpenTopicModal}
          onAddTopic={handleOpenAddTopicModal}
          isExpanded={isExpanded}
          onExpandReduce={onExpandReduce ?? (() => {})}
          onOpenTopicSort={() => setShowTopicSortModal(true)}
          topicNamesCreatedBySuperAdmin={topicNamesCreatedBySuperAdmin}
          disableTopicManagement={filterToClubShared && !isClubAdmin}
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
          savedHiddenTopics={hiddenTopics}
          onSave={async (ordered, _genreOrder, hidden) => {
            await saveTopicOrder(ordered, undefined, hidden);
          }}
        />

        {showOgpForm && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowOgpForm(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ogp-modal-title"
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.key === 'Escape' && setShowOgpForm(false)}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 id="ogp-modal-title" className="text-lg font-semibold text-gray-900">
                  Add article
                </h2>
                <button
                  type="button"
                  onClick={() => setShowOgpForm(false)}
                  className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <OGPForm
                onPastedArticle={handlePastedArticle}
                onSaveTyped={handleSaveTyped}
                onCancel={() => setShowOgpForm(false)}
                showClubAudienceRadios={Boolean(
                  sharedWithClubOnly && clubId && isClubAdmin
                )}
              />
            </div>
          </div>
        )}

        <NewsArticlesList
          pasted={visiblePasted}
          typed={filterToClubShared ? [] : typedArticles}
          activeTopic={activeTopic}
          topics={topics}
          onRemovePasted={handleRemovePasted}
          onRemoveTyped={handleRemoveTyped}
          canDeleteOgp={user?.userType === 'ADMIN'}
          currentUserId={user?.id ?? null}
          currentUserCountry={user?.country ?? null}
          onUpdatePastedSettings={handleUpdatePastedSettings}
          onUpdatePastedTopic={handleUpdatePastedTopic}
          onAddClick={
            filterToClubShared && !isClubAdmin
              ? undefined
              : () => setShowOgpForm((prev) => !prev)
          }
          addButtonDisabled={activeTopic === ALL_TOPICS}
          ogpNewsGroups={visibleGroups}
          onSaveOgpNewsGroup={
            filterToClubShared && !isClubAdmin ? undefined : handleSaveOgpNewsGroup
          }
          onCreateTopic={
            filterToClubShared && !isClubAdmin ? undefined : addTopic
          }
          onRemoveOgpNewsGroup={
            filterToClubShared && !isClubAdmin ? undefined : removeOgpNewsGroup
          }
          onUpdateOgpNewsGroup={
            filterToClubShared && !isClubAdmin ? undefined : updateOgpNewsGroup
          }
          onUpdateOgpNewsGroupSettings={
            filterToClubShared && !isClubAdmin ? undefined : updateOgpNewsGroupSettings
          }
          preferSingleNewsDefault={filterToClubShared}
          showShareInMyClubsButton={isClubAdmin}
          showClubGlobalNewsButton={Boolean(isClubAdmin && filterToClubShared && clubId)}
          clubGlobalNewsClubId={filterToClubShared ? clubId : null}
          onToggleClubGlobalNews={handleToggleClubGlobalNews}
          currentUserType={user?.userType ?? null}
          clubAdminUsername={user?.username ?? null}
          onArticleSharedClubIdsChange={handleArticleSharedClubIdsChange}
          onArticleClubAudienceModeChange={handleArticleClubAudienceModeChange}
          showDeletedByMeLabel={
            // Club member on club OGP, or normal user on personal OGP News
            filterToClubShared
              ? !isClubAdmin
              : user?.userType !== 'ADMIN'
          }
          enableClubGlobalAndOtherClubsToggle={filterToClubShared}
        />
      </div>
    </div>
  );
}
