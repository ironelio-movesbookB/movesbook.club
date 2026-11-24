'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useNewsData } from '@/hooks/useNewsData';
import NewsTopicBar, { type NewsTopic, ALL_TOPICS, ALL_USER_SECTORS, ALL_SUPER_ADMIN } from '@/app/news/components/NewsTopicBar';
import NewTopicModal from '@/app/news/components/NewTopicModal';
import NewsTopicSortModal from '@/app/news/components/NewsTopicSortModal';
import OGPForm from '@/app/news/components/OGPForm';
import NewsArticlesList from '@/app/news/components/NewsArticlesList';
import { ADMIN_OGP_EXPAND_EVENT } from '@/lib/adminOgpExpand';
import { resolveIsSuperAdminFromStorage } from '@/lib/panelSession';

export interface AdminSuperAdminOGPNewsContentProps {
  /** Target for the header close (X) link — default returns to admin home without query params */
  closeHref?: string;
}

/**
 * Superadmin OGP / News admin UI (same as /admin/news/links).
 * Used on /admin/news/links.
 */
export default function AdminSuperAdminOGPNewsContent({
  closeHref = '/admin/dashboard',
}: AdminSuperAdminOGPNewsContentProps) {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<{ id: string; name?: string } | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  /** Super admin: simulate normal user — show OGPs visible to this username (all topics). */
  const [viewAsUsername, setViewAsUsername] = useState<string | null>(null);
  const topicBeforeViewAsRef = useRef<NewsTopic | null>(null);
  const [activeTopic, setActiveTopic] = useState<NewsTopic | null>(null);

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
    hiddenTopics,
    addTopic,
    updateTopic,
    deleteTopic,
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
    toggleOgpGlobalNews,
    toggleOgpFeatured,
  } = useNewsData({ adminContext: true, viewAsUsername });

  const prevLoading = useRef(true);

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

  const topicsForSortModal = useMemo(
    () =>
      isSuperAdmin && topicNamesCreatedByNormalUsers.length > 0
        ? topics.filter((t) => !topicNamesCreatedByNormalUsers.includes(t))
        : topics,
    [isSuperAdmin, topicNamesCreatedByNormalUsers, topics]
  );

  // On reload (and whenever data finishes loading): select the first topic so the OGP area shows its OGPs.
  useEffect(() => {
    if (prevLoading.current && !loading && topics.length > 0 && !viewAsUsername) {
      setActiveTopic(topics[0]);
    }
    prevLoading.current = loading;
  }, [loading, topics, viewAsUsername]);

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
  const [showNewTopicModal, setShowNewTopicModal] = useState(false);
  const [showTopicSortModal, setShowTopicSortModal] = useState(false);
  const [topicModalEditing, setTopicModalEditing] = useState<string | null>(null);
  const [topicModalEditingId, setTopicModalEditingId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

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
        const targetTopic =
          activeTopic === ALL_TOPICS || activeTopic === ALL_USER_SECTORS || activeTopic === ALL_SUPER_ADMIN
            ? 'News'
            : (activeTopic ?? 'News');
        await addPastedArticle(data, targetTopic);
        setShowOgpForm(false);
      } catch (e) {
        console.error(e);
      }
    },
    [activeTopic, addPastedArticle]
  );

  const handleSaveTyped = useCallback(
    async (description: string) => {
      try {
        await addTypedArticle(description);
        setShowOgpForm(false);
      } catch (e) {
        console.error(e);
      }
    },
    [addTypedArticle]
  );

  if (!authChecked || !adminUser) {
    return null;
  }

  return (
    <div className="p-4 md:p-6 w-full min-w-0 max-w-full box-border">
      <div className="bg-white rounded-xl shadow-md border border-gray-200 w-full min-w-0 overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 gap-2 flex-wrap">
          {viewAsUsername ? (
            <>
              <h1 className="text-lg font-semibold text-gray-900 flex-1 min-w-0">
                OGP News visible by user <span className="text-pink-600">{viewAsUsername}</span>
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
            <h1 className="text-lg font-semibold text-gray-900">OGP News</h1>
          )}
          <a
            href={closeHref}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors shrink-0 ml-auto"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </a>
        </div>

        <div className="p-4 min-w-0">
          {loading && <p className="text-sm text-gray-500 mb-2">Loading OGP News...</p>}
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

          <NewsTopicBar
            topics={topicsForTopicBar}
            activeTopic={activeTopic}
            onTopicSelect={setActiveTopic}
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
            isSuperAdmin={isSuperAdmin}
            onAfterDeleteOgNews={refresh}
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
                className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.key === 'Escape' && setShowOgpForm(false)}
              >
                <div className="flex justify-between items-center p-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl">
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
                <div className="p-6">
                  <OGPForm
                    onPastedArticle={handlePastedArticle}
                    onSaveTyped={handleSaveTyped}
                    onCancel={() => setShowOgpForm(false)}
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
            onAddClick={viewAsUsername ? undefined : () => setShowOgpForm((prev) => !prev)}
            addButtonDisabled={
              activeTopic === ALL_TOPICS || activeTopic === ALL_USER_SECTORS || activeTopic === ALL_SUPER_ADMIN
            }
            adminContext={true}
            isSuperAdmin={isSuperAdmin}
            topicNamesCreatedByNormalUsers={topicNamesCreatedByNormalUsers}
            userInsertedTopics={userInsertedTopics}
            onSuperAdminViewAsUser={viewAsUsername ? undefined : handleSuperAdminViewAsUser}
            hideCreatorUsernameInHeading={!!viewAsUsername}
            showOnlyMyOgNewsLabelUsername={viewAsUsername}
            viewerScopedOgpList={!!viewAsUsername}
            ogpNewsGroups={ogpNewsGroups}
            onSaveOgpNewsGroup={viewAsUsername ? undefined : saveOgpNewsGroup}
            onCreateTopic={viewAsUsername ? undefined : addTopic}
            onRemoveOgpNewsGroup={viewAsUsername ? undefined : removeOgpNewsGroup}
            onUpdateOgpNewsGroup={viewAsUsername ? undefined : updateOgpNewsGroup}
            onUpdateOgpNewsGroupSettings={viewAsUsername ? undefined : updateOgpNewsGroupSettings}
            superAdminReadOnlyOgpActions={!!viewAsUsername}
            showGlobalNewsButton={isSuperAdmin && !viewAsUsername}
            onToggleGlobalNews={isSuperAdmin && !viewAsUsername ? toggleOgpGlobalNews : undefined}
            showFeaturedControls={isSuperAdmin && !viewAsUsername}
            onToggleOgpFeatured={isSuperAdmin && !viewAsUsername ? toggleOgpFeatured : undefined}
          />
        </div>
      </div>
    </div>
  );
}
