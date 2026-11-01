'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import NewsTopicBar, {
  type NewsTopic,
  ALL_TOPICS,
  ALL_SUPER_ADMIN,
} from '@/app/news/components/NewsTopicBar';
import NewTopicModal from '@/app/news/components/NewTopicModal';
import NewsTopicSortModal from '@/app/news/components/NewsTopicSortModal';
import OGPForm from '@/app/news/components/OGPForm';
import NewsArticlesList from '@/app/news/components/NewsArticlesList';
import { useAuth } from '@/hooks/useAuth';
import { useNewsData } from '@/hooks/useNewsData';
import { getExerciseDefaultTopics } from '@/constants/exerciseLibrary.constants';
import { X } from 'lucide-react';
import { resolveIsSuperAdminFromStorage } from '@/lib/panelSession';

const EXERCISE_API_BASE = '/api/exercises';

interface ExerciseOGPPanelProps {
  /** One of the 9 My Library category chips. */
  category: string;
  embedded?: boolean;
  isExpanded?: boolean;
  onExpandReduce?: () => void;
  /**
   * When true (Sport settings / admin panel), use adminToken and the same
   * superadmin OGP News behaviors: All defaults, user-inserted topics, see-as-user.
   */
  adminContext?: boolean;
}

export default function ExerciseOGPPanel({
  category,
  embedded = true,
  isExpanded = false,
  onExpandReduce,
  adminContext = false,
}: ExerciseOGPPanelProps) {
  const { user } = useAuth();
  const defaultTopics = getExerciseDefaultTopics(category);

  const [adminUser, setAdminUser] = useState<{ id: string; name?: string } | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  /** Super admin: simulate normal user — show OGPs visible to this username. */
  const [viewAsUsername, setViewAsUsername] = useState<string | null>(null);
  const topicBeforeViewAsRef = useRef<NewsTopic | null>(null);

  const {
    topics,
    customTopics,
    topicNamesCreatedBySuperAdmin,
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
  } = useNewsData({
    apiBase: EXERCISE_API_BASE,
    defaultTopics,
    category,
    adminContext: adminContext || undefined,
    viewAsUsername: adminContext ? viewAsUsername : null,
  });

  const [activeTopic, setActiveTopic] = useState<NewsTopic | null>(null);
  const prevLoading = useRef(true);
  const prevCategory = useRef(category);
  const [showNewTopicModal, setShowNewTopicModal] = useState(false);
  const [showTopicSortModal, setShowTopicSortModal] = useState(false);
  const [topicModalEditing, setTopicModalEditing] = useState<string | null>(null);
  const [topicModalEditingId, setTopicModalEditingId] = useState<string | null>(null);
  const [showOgpForm, setShowOgpForm] = useState(false);
  const [localExpanded, setLocalExpanded] = useState(false);

  const expanded = onExpandReduce ? isExpanded : localExpanded;
  const handleExpandReduce =
    onExpandReduce ??
    (() => {
      setLocalExpanded((e) => !e);
    });

  // Resolve admin / superadmin identity (Sport settings uses adminToken).
  useEffect(() => {
    if (!adminContext || typeof window === 'undefined') {
      setAdminUser(null);
      setIsSuperAdmin(false);
      return;
    }
    try {
      const raw = localStorage.getItem('adminUser');
      const u = raw ? JSON.parse(raw) : null;
      if (u?.id) {
        setAdminUser({ id: String(u.id), name: u.name });
        setIsSuperAdmin(resolveIsSuperAdminFromStorage(u));
        return;
      }
      const superRaw = localStorage.getItem('superAdminUser');
      if (superRaw) {
        const su = JSON.parse(superRaw);
        if (su?.id) {
          const synced = { id: String(su.id), name: su.name ?? su.username };
          localStorage.setItem('adminUser', JSON.stringify(synced));
          setAdminUser(synced);
          setIsSuperAdmin(true);
          return;
        }
      }
      setAdminUser(null);
      setIsSuperAdmin(false);
    } catch {
      setAdminUser(null);
      setIsSuperAdmin(false);
    }
  }, [adminContext]);

  /** In “see as user” mode, topic bar lists defaults + this user’s custom topics (no dropdown). */
  const topicsForTopicBar = useMemo(() => {
    const visible = topics.filter((t) => !hiddenTopics.includes(t));
    if (!adminContext || !viewAsUsername?.trim()) return visible;
    const v = viewAsUsername.trim().toLowerCase();
    const insertedByOthers = new Set(
      userInsertedTopics.filter((x) => (x.creatorUsername ?? '').toLowerCase() !== v).map((x) => x.name)
    );
    return visible.filter((t) => !insertedByOthers.has(t));
  }, [topics, hiddenTopics, userInsertedTopics, viewAsUsername, adminContext]);

  const topicsForSortModal = useMemo(
    () =>
      adminContext && isSuperAdmin && topicNamesCreatedByNormalUsers.length > 0
        ? topics.filter((t) => !topicNamesCreatedByNormalUsers.includes(t))
        : topics,
    [adminContext, isSuperAdmin, topicNamesCreatedByNormalUsers, topics]
  );

  // Reset selection (and see-as-user) when switching library category.
  useEffect(() => {
    if (prevCategory.current !== category) {
      prevCategory.current = category;
      setActiveTopic(null);
      prevLoading.current = true;
      setShowOgpForm(false);
      if (adminContext) {
        setViewAsUsername(null);
        topicBeforeViewAsRef.current = null;
      }
    }
  }, [category, adminContext]);

  useEffect(() => {
    if (prevLoading.current && !loading && topics.length > 0 && !(adminContext && viewAsUsername)) {
      setActiveTopic(topics[0]);
    }
    if (!loading && topics.length === 0) {
      setActiveTopic(null);
    }
    prevLoading.current = loading;
  }, [loading, topics, adminContext, viewAsUsername]);

  const handleSuperAdminViewAsUser = useCallback(
    (username: string) => {
      topicBeforeViewAsRef.current = activeTopic;
      setViewAsUsername(username.trim());
      setActiveTopic(ALL_TOPICS);
    },
    [activeTopic]
  );

  const handleBackFromViewAsUser = useCallback(() => {
    setViewAsUsername(null);
    const prev = topicBeforeViewAsRef.current;
    topicBeforeViewAsRef.current = null;
    setActiveTopic(prev ?? ALL_SUPER_ADMIN);
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

  const fallbackTopic = defaultTopics[0] ?? 'Exercise';

  const handlePastedArticle = useCallback(
    async (data: Parameters<Parameters<typeof OGPForm>[0]['onPastedArticle']>[0]) => {
      try {
        const targetTopic =
          activeTopic === ALL_TOPICS || activeTopic === ALL_SUPER_ADMIN
            ? fallbackTopic
            : (activeTopic ?? fallbackTopic);
        await addPastedArticle(data, targetTopic);
        setShowOgpForm(false);
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
    [activeTopic, addPastedArticle, fallbackTopic]
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

  const categoryLabel = category.replace(/\\/g, '/');
  const viewingAsUser = adminContext && !!viewAsUsername;
  const effectiveUserId = adminContext
    ? viewingAsUser && viewAsUserId
      ? viewAsUserId
      : (adminUser?.id ?? null)
    : (user?.id ?? null);
  const canDeleteOgp = adminContext || user?.userType === 'ADMIN';

  return (
    <div
      className={`flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${
        embedded ? 'flex-1 min-h-0' : ''
      }`}
    >
      <div
        className={`flex items-center justify-between px-4 py-2 border-b border-gray-200 gap-2 flex-wrap ${
          viewingAsUser ? 'bg-[#EFE4B0]' : 'bg-gray-50'
        }`}
      >
        {viewingAsUser ? (
          <>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-gray-900">
                Exercises visible by user <span className="text-pink-600">{viewAsUsername}</span>
              </h2>
              <p className="text-xs text-gray-500 truncate">{categoryLabel}</p>
            </div>
            <button
              type="button"
              onClick={handleBackFromViewAsUser}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors shrink-0"
            >
              Back to Super Admin page
            </button>
          </>
        ) : (
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">OGP Exercises</h2>
            <p className="text-xs text-gray-500 truncate">{categoryLabel}</p>
          </div>
        )}
      </div>

      <div className="flex-1 p-4">
        {loading && <p className="text-sm text-gray-500 mb-4">Loading exercises...</p>}
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <NewsTopicBar
          topics={topicsForTopicBar}
          activeTopic={activeTopic}
          onTopicSelect={setActiveTopic}
          onAddNewTopic={handleOpenTopicModal}
          onAddTopic={handleOpenAddTopicModal}
          isExpanded={expanded}
          onExpandReduce={handleExpandReduce}
          onOpenTopicSort={() => setShowTopicSortModal(true)}
          topicNamesCreatedBySuperAdmin={
            adminContext && isSuperAdmin ? undefined : topicNamesCreatedBySuperAdmin
          }
          topicNamesCreatedByNormalUsers={
            adminContext && isSuperAdmin ? topicNamesCreatedByNormalUsers : undefined
          }
          userInsertedTopics={adminContext && isSuperAdmin ? userInsertedTopics : undefined}
          allTopicLabel={
            adminContext && isSuperAdmin
              ? viewAsUsername
                ? 'All'
                : 'All defaults'
              : undefined
          }
          showSuperAdminAllButton={adminContext && isSuperAdmin && !viewAsUsername}
          hideUserInsertedDropdown={!!viewAsUsername}
          disableTopicManagement={!!viewAsUsername}
          defaultTopicNames={defaultTopics}
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
          topics={topicsForSortModal}
          savedHiddenTopics={hiddenTopics}
          onSave={async (ordered, _genreOrder, hidden) => {
            await saveTopicOrder(ordered, undefined, hidden);
          }}
          apiBase={EXERCISE_API_BASE}
          category={category}
          isSuperAdmin={adminContext && isSuperAdmin}
          onAfterDeleteOgNews={adminContext ? refresh : undefined}
        />

        {showOgpForm && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowOgpForm(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="exercise-ogp-modal-title"
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.key === 'Escape' && setShowOgpForm(false)}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 id="exercise-ogp-modal-title" className="text-lg font-semibold text-gray-900">
                  Add OGP exercise
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
                variant="exercise"
                onPastedArticle={handlePastedArticle}
                onSaveTyped={handleSaveTyped}
                onCancel={() => setShowOgpForm(false)}
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
          currentUserCountry={
            adminContext
              ? viewingAsUser
                ? viewAsUserCountry
                : null
              : (user?.country ?? null)
          }
          onUpdatePastedSettings={handleUpdatePastedSettings}
          onUpdatePastedTopic={handleUpdatePastedTopic}
          onAddClick={viewingAsUser ? undefined : () => setShowOgpForm((prev) => !prev)}
          addButtonDisabled={
            !activeTopic || activeTopic === ALL_TOPICS || activeTopic === ALL_SUPER_ADMIN
          }
          apiBase={EXERCISE_API_BASE}
          adminContext={adminContext || undefined}
          isSuperAdmin={adminContext && isSuperAdmin}
          topicNamesCreatedByNormalUsers={
            adminContext && isSuperAdmin ? topicNamesCreatedByNormalUsers : undefined
          }
          userInsertedTopics={adminContext && isSuperAdmin ? userInsertedTopics : undefined}
          onSuperAdminViewAsUser={
            adminContext && isSuperAdmin && !viewAsUsername
              ? handleSuperAdminViewAsUser
              : undefined
          }
          hideCreatorUsernameInHeading={!!viewAsUsername}
          showOnlyMyOgNewsLabelUsername={viewAsUsername}
          viewerScopedOgpList={!!viewAsUsername}
          superAdminReadOnlyOgpActions={!!viewAsUsername}
          ogpNewsGroups={ogpNewsGroups}
          onSaveOgpNewsGroup={viewingAsUser ? undefined : saveOgpNewsGroup}
          onCreateTopic={viewingAsUser ? undefined : addTopic}
          onRemoveOgpNewsGroup={viewingAsUser ? undefined : removeOgpNewsGroup}
          onUpdateOgpNewsGroup={viewingAsUser ? undefined : updateOgpNewsGroup}
          onUpdateOgpNewsGroupSettings={viewingAsUser ? undefined : updateOgpNewsGroupSettings}
        />
      </div>
    </div>
  );
}
