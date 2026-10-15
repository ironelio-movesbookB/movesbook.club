'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import NewsOGPPanel from '@/components/news/NewsOGPPanel';
import AddMemberModal from '@/components/AddMemberModal';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { canAccessClubWorkspace } from '@/utils/dashboardRouting';
import ClubIdentificationDevicesPanel from './components/ClubIdentificationDevicesPanel';
import ClubAccessOutcomeSettingsPanel from './components/ClubAccessOutcomeSettingsPanel';
import ClubBachecaMemberPanel from '@/components/club/websiteSettings/ClubBachecaMemberPanel';
import ClubTopicMemberPanel from '@/components/club/websiteSettings/ClubTopicMemberPanel';
import ClubDashboardTopicsHorizontalPanel from '@/components/club/ClubDashboardTopicsHorizontalPanel';
import ClubChatPanel from '@/components/club/ClubChatPanel';
import ClubNewsArchivePanel from '@/components/club/ClubNewsArchivePanel';
import ClubSharedNewsPanel from '@/components/club/ClubSharedNewsPanel';
import ClubMovesbookNewsPanel from '@/components/club/ClubMovesbookNewsPanel';
import NotificationByPromocodeDashboardView from '@/components/promocodes/NotificationByPromocodeDashboard';
import {
  getClubMyPageDisplayName,
  getFormCreatedClubsSortedByCreatedAt,
  parseClubDescriptionMeta,
  formatMyClubsSidebarLabel,
} from '@/lib/club/clubSidebarLabel';
import {
  writeClubWorkspaceTab,
} from '@/lib/club/clubWorkspaceTab';
import { useClubWorkspace } from '@/contexts/ClubWorkspaceContext';
import SharingNotifications from '@/components/sharing/SharingNotifications';

function ClubDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const {
    activeTab,
    selectedClubId: contextClubId,
    myPageNewsPanel,
    setMyPageNewsPanel,
    sharingScope,
  } = useClubWorkspace();

  const [clubs, setClubs] = useState<any[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(contextClubId);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showWorkoutSection, setShowWorkoutSection] = useState(false);
  const [clubAddSongsOgpOpen, setClubAddSongsOgpOpen] = useState(false);
  const [clubAddSongsOgpExpanded, setClubAddSongsOgpExpanded] = useState(false);
  const [myPageOgpExpanded, setMyPageOgpExpanded] = useState(false);
  const [clubMainPanel, setClubMainPanel] = useState<
    | 'default'
    | 'identification-devices'
    | 'outcome-settings'
    | 'suggest-movesbook'
    | 'bacheca'
    | 'topic'
    | 'topics-horizontal'
    | 'chat'
    | 'club-news'
    | 'club-news-ogp'
    | 'club-global-news'
    | 'club-movesbook-news'
    | 'mb-news'
  >('default');
  const [clubTopicId, setClubTopicId] = useState<string | null>(null);

  useEffect(() => {
    if (contextClubId) setSelectedClubId(contextClubId);
  }, [contextClubId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedClubId = localStorage.getItem('selectedClub');
    if (savedClubId) setSelectedClubId(savedClubId);
  }, []);

  const formClubs = useMemo(
    () => getFormCreatedClubsSortedByCreatedAt(clubs),
    [clubs],
  );

  const hasFormClub = formClubs.length > 0;
  const activeClub = selectedClubId
    ? formClubs.find((c) => c.id === selectedClubId) ?? null
    : null;

  const loadClubs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/clubs/my-clubs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setClubs(data.clubs || []);
      }
    } catch (error) {
      console.error('Error loading clubs:', error);
    }
  };

  useEffect(() => {
    if (activeTab !== 'my-entity') {
      setClubAddSongsOgpOpen(false);
      setClubAddSongsOgpExpanded(false);
      setClubMainPanel('default');
    }
  }, [activeTab]);

  useEffect(() => {
    if (myPageNewsPanel !== 'ogp-news') {
      setMyPageOgpExpanded(false);
    }
  }, [myPageNewsPanel]);

  useEffect(() => {
    if (searchParams != null && searchParams.get('open') === 'news' && formClubs.length > 0) {
      const clubId = selectedClubId ?? formClubs[0]?.id;
      if (clubId && !selectedClubId) {
        setSelectedClubId(clubId);
        localStorage.setItem('selectedClub', clubId);
      }
      writeClubWorkspaceTab('my-entity');
      setMyPageNewsPanel(null);
      setShowWorkoutSection(false);
      setClubAddSongsOgpOpen(true);
      router.replace('/club/dashboard', { scroll: false });
    }
  }, [searchParams, router, formClubs, selectedClubId, setMyPageNewsPanel]);

  useEffect(() => {
    const panel = searchParams?.get('panel');
    if (panel === 'identification-devices') {
      writeClubWorkspaceTab('my-entity');
      setMyPageNewsPanel(null);
      setShowWorkoutSection(false);
      setClubAddSongsOgpOpen(false);
      setClubAddSongsOgpExpanded(false);
      setClubMainPanel('identification-devices');
      router.replace('/club/dashboard', { scroll: false });
    }
    if (panel === 'outcome-settings') {
      writeClubWorkspaceTab('my-entity');
      setMyPageNewsPanel(null);
      setShowWorkoutSection(false);
      setClubAddSongsOgpOpen(false);
      setClubAddSongsOgpExpanded(false);
      setClubMainPanel('outcome-settings');
      router.replace('/club/dashboard', { scroll: false });
    }
    if (panel === 'suggest-movesbook') {
      writeClubWorkspaceTab('my-entity');
      setMyPageNewsPanel(null);
      setShowWorkoutSection(false);
      setClubAddSongsOgpOpen(false);
      setClubAddSongsOgpExpanded(false);
      setClubMainPanel('suggest-movesbook');
      router.replace('/club/dashboard', { scroll: false });
    }
    if (panel === 'chat') {
      writeClubWorkspaceTab('my-entity');
      setMyPageNewsPanel(null);
      setShowWorkoutSection(false);
      setClubAddSongsOgpOpen(false);
      setClubAddSongsOgpExpanded(false);
      setClubMainPanel('chat');
      router.replace('/club/dashboard', { scroll: false });
    }
    if (panel === 'club-news') {
      writeClubWorkspaceTab('my-entity');
      setMyPageNewsPanel(null);
      setShowWorkoutSection(false);
      setClubAddSongsOgpOpen(false);
      setClubAddSongsOgpExpanded(false);
      setClubMainPanel('club-news');
      router.replace('/club/dashboard', { scroll: false });
    }
    if (panel === 'club-news-ogp') {
      writeClubWorkspaceTab('my-entity');
      setMyPageNewsPanel(null);
      setShowWorkoutSection(false);
      setClubAddSongsOgpOpen(false);
      setClubAddSongsOgpExpanded(false);
      setClubMainPanel('club-news-ogp');
      router.replace('/club/dashboard', { scroll: false });
    }
    if (panel === 'club-global-news') {
      writeClubWorkspaceTab('my-entity');
      setMyPageNewsPanel(null);
      setShowWorkoutSection(false);
      setClubAddSongsOgpOpen(false);
      setClubAddSongsOgpExpanded(false);
      setClubMainPanel('club-global-news');
      router.replace('/club/dashboard', { scroll: false });
    }
    if (panel === 'club-movesbook-news') {
      writeClubWorkspaceTab('my-entity');
      setMyPageNewsPanel(null);
      setShowWorkoutSection(false);
      setClubAddSongsOgpOpen(false);
      setClubAddSongsOgpExpanded(false);
      setClubMainPanel('club-movesbook-news');
      router.replace('/club/dashboard', { scroll: false });
    }
    if (panel === 'mb-news') {
      writeClubWorkspaceTab('my-entity');
      setMyPageNewsPanel(null);
      setShowWorkoutSection(false);
      setClubAddSongsOgpOpen(false);
      setClubAddSongsOgpExpanded(false);
      setClubMainPanel('mb-news');
      router.replace('/club/dashboard', { scroll: false });
    }
    if (panel === 'bacheca') {
      const queryClubId = searchParams?.get('clubId');
      if (queryClubId) {
        setSelectedClubId(queryClubId);
        localStorage.setItem('selectedClub', queryClubId);
      }
      writeClubWorkspaceTab('my-entity');
      setMyPageNewsPanel(null);
      setShowWorkoutSection(false);
      setClubAddSongsOgpOpen(false);
      setClubAddSongsOgpExpanded(false);
      setClubMainPanel('bacheca');
      setClubTopicId(null);
    }
    if (panel === 'topic') {
      const queryClubId = searchParams?.get('clubId');
      const queryTopicId = searchParams?.get('topicId');
      if (queryClubId) {
        setSelectedClubId(queryClubId);
        localStorage.setItem('selectedClub', queryClubId);
      }
      if (queryTopicId) {
        setClubTopicId(queryTopicId);
      }
      writeClubWorkspaceTab('my-entity');
      setMyPageNewsPanel(null);
      setShowWorkoutSection(false);
      setClubAddSongsOgpOpen(false);
      setClubAddSongsOgpExpanded(false);
      setClubMainPanel('topic');
    }
    if (panel === 'topics-horizontal') {
      const queryClubId = searchParams?.get('clubId');
      if (queryClubId) {
        setSelectedClubId(queryClubId);
        localStorage.setItem('selectedClub', queryClubId);
      }
      writeClubWorkspaceTab('my-entity');
      setMyPageNewsPanel(null);
      setShowWorkoutSection(false);
      setClubAddSongsOgpOpen(false);
      setClubAddSongsOgpExpanded(false);
      setClubMainPanel('topics-horizontal');
      setClubTopicId(null);
    }
  }, [searchParams, router, setMyPageNewsPanel]);

  useEffect(() => {
    if (user && canAccessClubWorkspace(user.userType)) {
      void loadClubs();
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'my-page') {
      setShowWorkoutSection(false);
    }
  }, [activeTab]);

  if (loading || !user) {
    return null;
  }

  const dashboardShellActiveTab: 'my-page' | 'my-entity' =
    activeClub ? activeTab : 'my-page';

  if (dashboardShellActiveTab === 'my-page' && myPageNewsPanel === 'movesbook-news') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ClubMovesbookNewsPanel
          title="Movesbook News"
          onClose={() => setMyPageNewsPanel(null)}
        />
      </div>
    );
  }

  if (dashboardShellActiveTab === 'my-page' && myPageNewsPanel === 'mb-news') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ClubNewsArchivePanel
          title="News"
          onClose={() => setMyPageNewsPanel(null)}
        />
      </div>
    );
  }

  if (dashboardShellActiveTab === 'my-page' && myPageNewsPanel === 'ogp-news') {
    return (
      <div className="flex min-h-0 flex-1 flex-col py-4">
        <NewsOGPPanel
          title="OGP News"
          onClose={() => {
            setMyPageNewsPanel(null);
            setMyPageOgpExpanded(false);
          }}
          embedded
          isExpanded={myPageOgpExpanded}
          onExpandReduce={() => setMyPageOgpExpanded((prev) => !prev)}
        />
      </div>
    );
  }

  return (
    <>
      {!clubAddSongsOgpOpen && !showWorkoutSection && clubMainPanel === 'identification-devices' ? (
        <div className="bg-white rounded-lg shadow-sm border p-6 flex-1 flex flex-col">
          <ClubIdentificationDevicesPanel clubId={selectedClubId} />
        </div>
      ) : !clubAddSongsOgpOpen && !showWorkoutSection && clubMainPanel === 'outcome-settings' ? (
        <div className="bg-white rounded-lg shadow-sm border p-6 flex-1 flex flex-col">
          <ClubAccessOutcomeSettingsPanel
            clubId={selectedClubId}
            onBack={() => setClubMainPanel('default')}
          />
        </div>
      ) : !clubAddSongsOgpOpen && !showWorkoutSection && clubMainPanel === 'suggest-movesbook' ? (
        <div className="bg-white rounded-lg shadow-sm border p-6 flex-1 flex flex-col min-h-0">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Suggest Movesbook to friends</h2>
          <NotificationByPromocodeDashboardView />
        </div>
      ) : !clubAddSongsOgpOpen && !showWorkoutSection && clubMainPanel === 'chat' ? (
        <div className="flex min-h-0 w-full flex-col">
          {selectedClubId ?? activeClub?.id ? (
            <ClubChatPanel
              clubId={(selectedClubId ?? activeClub?.id)!}
              onCancelTelegram={() => setClubMainPanel('default')}
            />
          ) : (
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <p className="py-12 text-center text-sm text-gray-600">
                Select a club in the sidebar to open Club Channel chat.
              </p>
            </div>
          )}
        </div>
      ) : !clubAddSongsOgpOpen && !showWorkoutSection && clubMainPanel === 'bacheca' ? (
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-white p-4 shadow-sm">
          {selectedClubId ?? activeClub?.id ? (
            <ClubBachecaMemberPanel
              clubId={(selectedClubId ?? activeClub?.id)!}
              compact
            />
          ) : (
            <p className="py-12 text-center text-sm text-gray-600">
              Select a club in the sidebar to view its bacheca.
            </p>
          )}
        </div>
      ) : !clubAddSongsOgpOpen && !showWorkoutSection && clubMainPanel === 'topics-horizontal' ? (
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-white p-4 shadow-sm">
          {selectedClubId ?? activeClub?.id ? (
            <ClubDashboardTopicsHorizontalPanel
              clubId={(selectedClubId ?? activeClub?.id)!}
              clubDisplayName={
                activeClub ? getClubMyPageDisplayName(activeClub) : ''
              }
            />
          ) : (
            <p className="py-12 text-center text-sm text-gray-600">
              Select a club in the sidebar to view club topics.
            </p>
          )}
        </div>
      ) : !clubAddSongsOgpOpen && !showWorkoutSection && clubMainPanel === 'topic' && clubTopicId ? (
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-white p-4 shadow-sm">
          {selectedClubId ?? activeClub?.id ? (
            <ClubTopicMemberPanel
              clubId={(selectedClubId ?? activeClub?.id)!}
              topicId={clubTopicId}
              clubDisplayName={
                activeClub ? getClubMyPageDisplayName(activeClub) : ''
              }
              compact
            />
          ) : (
            <p className="py-12 text-center text-sm text-gray-600">
              Select a club in the sidebar to view this topic.
            </p>
          )}
        </div>
      ) : !clubAddSongsOgpOpen && !showWorkoutSection && clubMainPanel === 'club-news' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {selectedClubId ?? activeClub?.id ? (
            <ClubNewsArchivePanel
              clubId={(selectedClubId ?? activeClub?.id)!}
              sharedWithClubOnly
              title="News"
              onClose={() => setClubMainPanel('default')}
            />
          ) : (
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <p className="py-12 text-center text-sm text-gray-600">
                Select a club in the sidebar to view shared News.
              </p>
            </div>
          )}
        </div>
      ) : !clubAddSongsOgpOpen && !showWorkoutSection && clubMainPanel === 'club-news-ogp' ? (
        <div className="flex min-h-0 flex-1 flex-col py-4">
          {selectedClubId ?? activeClub?.id ? (
            <NewsOGPPanel
              title="OGP News"
              clubId={(selectedClubId ?? activeClub?.id)!}
              sharedWithClubOnly
              onClose={() => {
                setClubMainPanel('default');
                setClubAddSongsOgpExpanded(false);
              }}
              embedded
              isExpanded={clubAddSongsOgpExpanded}
              onExpandReduce={() => setClubAddSongsOgpExpanded((prev) => !prev)}
            />
          ) : (
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <p className="py-12 text-center text-sm text-gray-600">
                Select a club in the sidebar to view shared OGP News.
              </p>
            </div>
          )}
        </div>
      ) : !clubAddSongsOgpOpen && !showWorkoutSection && clubMainPanel === 'club-global-news' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {selectedClubId ?? activeClub?.id ? (
            <ClubSharedNewsPanel
              clubId={(selectedClubId ?? activeClub?.id)!}
              type="all"
              title="Club News & OGP News"
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-white p-6 shadow-sm">
              <p className="py-12 text-center text-sm text-gray-600">
                Select a club in the sidebar to view Club News & OGP News.
              </p>
            </div>
          )}
        </div>
      ) : !clubAddSongsOgpOpen && !showWorkoutSection && clubMainPanel === 'club-movesbook-news' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <ClubMovesbookNewsPanel title="Movesbook News" />
        </div>
      ) : !clubAddSongsOgpOpen && !showWorkoutSection && clubMainPanel === 'mb-news' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <ClubNewsArchivePanel
            title="News"
            onClose={() => setClubMainPanel('default')}
          />
        </div>
      ) : !clubAddSongsOgpOpen && !showWorkoutSection ? (
        <div className="bg-white rounded-lg shadow-sm border p-6 flex-1 flex flex-col">
          {!hasFormClub ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <Building2 className="w-20 h-20 mx-auto mb-6 opacity-60" />
                <p className="text-2xl font-bold mb-2">Set up your club</p>
                <p className="text-lg mb-4 max-w-md">
                  Expand <strong>My clubs</strong> in the sidebar, click <strong>Create a club</strong>,
                  and save your club username, direct access, and other details.
                </p>
              </div>
            </div>
          ) : dashboardShellActiveTab === 'my-page' ? (
            <div>
              <h2 className="mb-6 text-2xl font-bold text-gray-900">My Page</h2>
              <div className="max-w-2xl space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-6">
                <p className="text-gray-700">
                  Your personal club owner page. Use the left sidebar to manage your profile,
                  visitors, and club settings.
                </p>
                {hasFormClub && (
                  <p className="text-sm text-gray-600">
                    To open a club workspace, expand <strong>My clubs</strong> and click your club
                    (e.g. <strong>{formatMyClubsSidebarLabel(formClubs[0]!)}</strong>). That opens{' '}
                    <strong>My Club</strong>, where you can switch back here with{' '}
                    <strong>My Page</strong>.
                  </p>
                )}
              </div>
              <div className="mt-6">
                <SharingNotifications scope={sharingScope} />
              </div>
            </div>
          ) : dashboardShellActiveTab === 'my-entity' && activeClub ? (
            <div>
              <h2 className="mb-6 text-2xl font-bold text-gray-900">My Club</h2>
              <div className="max-w-2xl space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Official club name
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {getClubMyPageDisplayName(activeClub)}
                  </p>
                </div>
                {(() => {
                  const meta = parseClubDescriptionMeta(activeClub.description);
                  const rows = [
                    ['Club username', meta.username],
                    ['Direct access', meta.directAccess],
                    ['Category', meta.category],
                    ['Country', meta.country],
                    ['Region', meta.region],
                    ['Location', activeClub.location],
                    ['Club mail', meta.mail],
                  ].filter(([, v]) => v && String(v).trim());
                  return rows.length > 0 ? (
                    <dl className="grid gap-3 sm:grid-cols-2">
                      {rows.map(([label, value]) => (
                        <div key={String(label)}>
                          <dt className="text-xs font-medium text-gray-500">{label}</dt>
                          <dd className="text-sm text-gray-900">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null;
                })()}
                <p className="text-sm text-gray-600">
                  Sidebar:{' '}
                  <span className="font-medium text-gray-800">
                    {formatMyClubsSidebarLabel(activeClub)}
                  </span>
                </p>
                <p className="text-sm text-gray-500">
                  Use the left sidebar for club tools, members, music, and management.
                </p>
              </div>
              <div className="mt-6">
                <SharingNotifications scope={sharingScope} />
              </div>
            </div>
          ) : dashboardShellActiveTab === 'my-entity' ? (
            <div>
              <h2 className="mb-2 text-2xl font-bold text-gray-900">My Club</h2>
              <p className="text-gray-600">
                Click a club under <strong>My clubs</strong> in the sidebar to open it here.
              </p>
            </div>
          ) : null}
        </div>
      ) : clubAddSongsOgpOpen ? (
        <div className="flex-1 flex flex-col min-h-0 py-4">
          <NewsOGPPanel
            onClose={() => {
              setClubAddSongsOgpOpen(false);
              setClubAddSongsOgpExpanded(false);
            }}
            embedded
            isExpanded={clubAddSongsOgpExpanded}
            onExpandReduce={() => setClubAddSongsOgpExpanded((prev) => !prev)}
          />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border p-6 flex-1 flex flex-col">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Workouts Section</h2>
          <p className="text-gray-600">Workout management content goes here.</p>
        </div>
      )}

      <AddMemberModal
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        onAddNewUser={() => setShowAddMemberModal(false)}
        onAddExistingUser={() => setShowAddMemberModal(false)}
        entityType="club"
      />
    </>
  );
}

export default function ClubDashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <ClubDashboardContent />
    </Suspense>
  );
}
