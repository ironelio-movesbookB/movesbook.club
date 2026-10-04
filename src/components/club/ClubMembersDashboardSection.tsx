'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  Mail,
  ChevronDown,
  ClipboardList,
  Settings,
  Star,
  Youtube
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { normalizeYoutubeUrlForOpen } from '@/utils/youtubeChannelUrl';
import {
  getClubDashboardFriendTopics,
} from '@/lib/clubWebsiteFriendList';
import {
  filterClubWebsiteTopicsForMembers,
} from '@/lib/clubWebsiteTopics';
import {
  CLUB_WEBSITE_SETTINGS_INDEX_PATH,
  CLUB_WEBSITE_BACHECA_PATH,
  clubBachecaDashboardUrl,
  clubTopicsHorizontalDashboardUrl,
  clubWebsiteDisplayUrl,
  clubWebsiteDisplayTopicUrl,
} from '@/lib/clubWebsiteSettingsPaths';
import { writeClubWorkspaceTab } from '@/lib/club/clubWorkspaceTab';
import { CLUB_WEBSITE_SETTINGS_CHANGED_EVENT } from '@/lib/clubWebsiteSettingsEvents';
import ClubDashboardTopicsList from '@/components/club/ClubDashboardTopicsList';
import { consumeOpenClubTopicsSection } from '@/lib/club/clubTopicsNavigation';
import { useClubWebsiteFriendList } from '@/hooks/useClubWebsiteFriendList';
import { useClubWebsiteTopics } from '@/hooks/useClubWebsiteTopics';
import { clubDeskListUrl, clubDeskSettingsUrl } from '@/lib/club/clubDeskPaths';

type BootstrappedClub = {
  id: string;
  name?: string;
  description?: string | null;
  location?: string | null;
  youtubeChannelUrl?: string | null;
};

export default function ClubMembersDashboardSection({
  clubId,
  youtubeChannelUrl,
  canManageClub,
  onYoutubeChannelUrlSaved,
  onClubBootstrapped,
  title,
  children
}: {
  /** Header label; defaults to the "MY CLUB - Dashboard for the members" translation. */
  title?: string;
  /** Extra rows shown under the dashboard links while the section is open. */
  children?: ReactNode;
  clubId?: string;
  youtubeChannelUrl?: string | null;
  canManageClub: boolean;
  onYoutubeChannelUrlSaved?: (clubId: string, url: string | null) => void;
  /** When my-clubs or POST /api/clubs yields a club id, parent can sync header/routes before entities refetch. */
  onClubBootstrapped?: (club: BootstrappedClub) => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [savedUrl, setSavedUrl] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [resolvedClubId, setResolvedClubId] = useState<string | undefined>(clubId);
  const [clubResolveLoading, setClubResolveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setResolvedClubId(clubId || undefined);
  }, [clubId]);

  useEffect(() => {
    if (consumeOpenClubTopicsSection()) {
      setOpen(true);
      setTopicsOpen(true);
    }
  }, [clubId]);

  useEffect(() => {
    const raw =
      typeof youtubeChannelUrl === 'string'
        ? youtubeChannelUrl
        : youtubeChannelUrl != null
          ? String(youtubeChannelUrl)
          : '';
    setSavedUrl(raw.trim());
  }, [youtubeChannelUrl, resolvedClubId]);

  const ensureClubId = useCallback(async (): Promise<string | null> => {
    if (resolvedClubId) return resolvedClubId;
    if (!canManageClub) return null;
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return null;

    setClubResolveLoading(true);
    try {
      const listRes = await fetch('/api/clubs/my-clubs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (listRes.ok) {
        const listData = (await listRes.json()) as { clubs?: BootstrappedClub[] };
        const first = listData.clubs?.[0];
        if (first?.id) {
          setResolvedClubId(first.id);
          onClubBootstrapped?.(first);
          return first.id;
        }
      }

      const createRes = await fetch('/api/clubs', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!createRes.ok) return null;
      const createData = (await createRes.json()) as { club?: BootstrappedClub };
      const created = createData.club;
      if (created?.id) {
        setResolvedClubId(created.id);
        onClubBootstrapped?.(created);
        return created.id;
      }
    } catch {
      return null;
    } finally {
      setClubResolveLoading(false);
    }
    return null;
  }, [resolvedClubId, canManageClub, onClubBootstrapped]);

  useEffect(() => {
    if (!canManageClub || resolvedClubId) return;
    void ensureClubId();
  }, [canManageClub, resolvedClubId, ensureClubId]);

  const openModal = () => {
    setDraft(savedUrl);
    setSaveError(null);
    setModalOpen(true);
    if (canManageClub && !resolvedClubId) {
      void ensureClubId();
    }
  };

  const clubYoutubeOpenHref = normalizeYoutubeUrlForOpen(savedUrl);

  const openDraftYoutubeInNewTab = () => {
    const href = normalizeYoutubeUrlForOpen(draft);
    if (href) {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  const effectiveClubId = resolvedClubId ?? clubId;
  const deskListHref = effectiveClubId ? clubDeskListUrl(effectiveClubId) : undefined;
  const deskSettingsHref = effectiveClubId ? clubDeskSettingsUrl(effectiveClubId) : undefined;
  const openBachecaPanel = () => {
    if (!effectiveClubId) return;
    writeClubWorkspaceTab('my-entity');
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedClub', effectiveClubId);
    }
    router.push(clubBachecaDashboardUrl(effectiveClubId));
  };

  const openClubWebsiteDisplay = () => {
    if (!effectiveClubId) return;
    writeClubWorkspaceTab('my-entity');
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedClub', effectiveClubId);
    }
    // Always open member DISPLAY — never the settings editor.
    router.push(clubWebsiteDisplayUrl(effectiveClubId));
  };

  const openTopicsHorizontalPanel = () => {
    if (!effectiveClubId) return;
    writeClubWorkspaceTab('my-entity');
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedClub', effectiveClubId);
    }
    router.push(clubTopicsHorizontalDashboardUrl(effectiveClubId));
  };

  const openTopicDisplay = (topicId: string, _label: string) => {
    if (!effectiveClubId) return;
    writeClubWorkspaceTab('my-entity');
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedClub', effectiveClubId);
    }
    router.push(clubWebsiteDisplayTopicUrl(effectiveClubId, topicId));
  };

  const {
    items: friendItems,
    reload: reloadFriendItems,
  } = useClubWebsiteFriendList(effectiveClubId);
  const {
    topics: clubTopics,
    reload: reloadClubTopics,
  } = useClubWebsiteTopics(effectiveClubId);

  const friendDashboardTopics = useMemo(
    () => getClubDashboardFriendTopics(friendItems),
    [friendItems]
  );
  const customDashboardTopics = useMemo(
    () => filterClubWebsiteTopicsForMembers(clubTopics),
    [clubTopics]
  );

  const reloadDashboardTopics = useCallback(() => {
    reloadFriendItems();
    reloadClubTopics();
  }, [reloadFriendItems, reloadClubTopics]);

  useEffect(() => {
    const onFocus = () => reloadDashboardTopics();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reloadDashboardTopics]);

  useEffect(() => {
    if (!effectiveClubId) return;
    const onStorage = (e: StorageEvent) => {
      if (
        e.key?.startsWith('club-website-friend-list:') ||
        e.key?.startsWith('club-website-topics:')
      ) {
        reloadDashboardTopics();
      }
    };
    const onSettingsChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ clubId?: string }>).detail;
      if (!detail?.clubId || detail.clubId === effectiveClubId) {
        reloadDashboardTopics();
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(CLUB_WEBSITE_SETTINGS_CHANGED_EVENT, onSettingsChanged);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CLUB_WEBSITE_SETTINGS_CHANGED_EVENT, onSettingsChanged);
    };
  }, [effectiveClubId, reloadDashboardTopics]);

  const hasDashboardTopics =
    friendDashboardTopics.length > 0 || customDashboardTopics.length > 0;

  const draftValid = !draft.trim() || !!normalizeYoutubeUrlForOpen(draft);

  const saveYoutube = async () => {
    if (!canManageClub) return;
    setSaveError(null);
    const id = (await ensureClubId()) ?? resolvedClubId ?? clubId;
    if (!id) {
      setSaveError(t('modal_club_youtube_no_club'));
      return;
    }
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    const trimmed = draft.trim();
    if (trimmed && !normalizeYoutubeUrlForOpen(trimmed)) return;
    setSaveLoading(true);
    try {
      const res = await fetch(`/api/clubs/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          youtubeChannelUrl: trimmed || null
        })
      });
      if (!res.ok) {
        setSaveError(t('modal_club_youtube_save_failed'));
        return;
      }
      const data = (await res.json()) as {
        club?: { youtubeChannelUrl?: string | null };
      };
      const next = data.club?.youtubeChannelUrl ?? null;
      setSavedUrl((next ?? '').trim());
      onYoutubeChannelUrlSaved?.(id, next);
      setModalOpen(false);
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <>
      <div className="w-full border-b border-teal-700">
        <div className="flex w-full items-stretch bg-teal-800 text-white">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex flex-1 items-center gap-2.5 min-w-0 py-2.5 pl-3 pr-2 text-left transition-colors hover:bg-teal-700"
          >
            <Mail className="h-5 w-5 shrink-0" />
            <span className="truncate font-semibold tracking-wide">
              {title ?? t('sidebar_dashboard_members')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? t('collapse') : t('expand')}
            className="flex shrink-0 items-center border-l border-teal-700/40 px-3 transition-colors hover:bg-teal-700"
          >
            <ChevronDown
              className={`h-4 w-4 opacity-90 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {open && (
          <div className="border-t border-teal-900/40 bg-[#2d2d2d] text-sm text-white">
            <div className="flex min-h-[44px] w-full items-stretch border-b border-black/25">
              <button
                type="button"
                disabled={!effectiveClubId}
                onClick={openBachecaPanel}
                className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-zinc-700/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Mail className="h-4 w-4 shrink-0 opacity-90" />
                <span className="truncate">{t('club_website_bacheca')}</span>
              </button>
              {canManageClub && (
                <button
                  type="button"
                  title={t('club_bacheca_open_editor_aria')}
                  aria-label={t('club_bacheca_open_editor_aria')}
                  onClick={(e) => {
                    e.stopPropagation();
                    writeClubWorkspaceTab('my-entity');
                    if (effectiveClubId && typeof window !== 'undefined') {
                      localStorage.setItem('selectedClub', effectiveClubId);
                    }
                    router.push(CLUB_WEBSITE_BACHECA_PATH);
                  }}
                  className="flex shrink-0 items-center border-l border-black/25 px-3 text-gray-300 transition-colors hover:bg-zinc-700/90"
                >
                  <Settings className="h-4 w-4" />
                </button>
              )}
            </div>

            {effectiveClubId ? (
              <div className="flex min-h-[44px] w-full items-stretch border-b border-black/25">
                <button
                  type="button"
                  disabled={!deskListHref}
                  onClick={() => {
                    if (!deskListHref || !effectiveClubId) return;
                    writeClubWorkspaceTab('my-entity');
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('selectedClub', effectiveClubId);
                    }
                    router.push(deskListHref);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-zinc-700/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ClipboardList className="h-4 w-4 shrink-0 opacity-90" />
                  <span className="truncate">{t('sidebar_club_desk')}</span>
                </button>
                {canManageClub ? (
                  <button
                    type="button"
                    disabled={!deskSettingsHref}
                    title={t('sidebar_club_desk_admin_aria')}
                    aria-label={t('sidebar_club_desk_admin_aria')}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!deskSettingsHref || !effectiveClubId) return;
                      writeClubWorkspaceTab('my-entity');
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('selectedClub', effectiveClubId);
                      }
                      router.push(deskSettingsHref);
                    }}
                    className="flex shrink-0 items-center border-l border-black/25 px-3 text-gray-300 transition-colors hover:bg-zinc-700/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="flex min-h-[44px] w-full items-stretch border-b border-black/25">
              <button
                type="button"
                disabled={!effectiveClubId}
                onClick={openClubWebsiteDisplay}
                className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-zinc-700/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Mail className="h-4 w-4 shrink-0 opacity-90" />
                <span className="truncate">{t('sidebar_club_topics')}</span>
              </button>
              <button
                type="button"
                disabled={!effectiveClubId || !hasDashboardTopics}
                onClick={(e) => {
                  e.stopPropagation();
                  openTopicsHorizontalPanel();
                }}
                title={t('club_topics_display_horizontally')}
                className="max-w-[7.5rem] shrink-0 border-l border-black/25 px-1.5 text-center text-[10px] font-medium leading-tight text-amber-200 transition-colors hover:bg-zinc-700/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('club_topics_display_horizontally')}
              </button>
              {canManageClub ? (
                <button
                  type="button"
                  title={t('sidebar_club_topics_settings_aria')}
                  aria-label={t('sidebar_club_topics_settings_aria')}
                  onClick={(e) => {
                    e.stopPropagation();
                    writeClubWorkspaceTab('my-entity');
                    if (effectiveClubId && typeof window !== 'undefined') {
                      localStorage.setItem('selectedClub', effectiveClubId);
                    }
                    router.push(CLUB_WEBSITE_SETTINGS_INDEX_PATH);
                  }}
                  className="flex shrink-0 items-center border-l border-black/25 px-3 text-gray-300 transition-colors hover:bg-zinc-700/90"
                >
                  <Settings className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setTopicsOpen((v) => !v)}
                aria-label={topicsOpen ? t('collapse') : t('expand')}
                className="flex shrink-0 items-center border-l border-black/25 px-3 text-gray-300 transition-colors hover:bg-zinc-700/90"
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${topicsOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
            {topicsOpen && hasDashboardTopics ? (
              <ClubDashboardTopicsList
                clubId={effectiveClubId}
                friendTopics={friendDashboardTopics}
                customTopics={customDashboardTopics}
                onViewTopicContent={openTopicDisplay}
              />
            ) : topicsOpen && !hasDashboardTopics ? (
              <p className="border-t border-black/25 bg-[#252525] px-3 py-2.5 text-[11px] leading-snug text-white/60">
                {t('club_dashboard_topics_empty')}
              </p>
            ) : null}

            <div className="flex min-h-[44px] w-full items-stretch">
              {clubYoutubeOpenHref ? (
                <a
                  href={clubYoutubeOpenHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-white no-underline transition-colors hover:bg-zinc-700/90"
                >
                  <Mail className="h-4 w-4 shrink-0 opacity-90" />
                  <span className="truncate">{t('sidebar_club_youtube_channel')}</span>
                </a>
              ) : (
                <span
                  className="flex min-w-0 flex-1 cursor-default items-center gap-2 px-3 py-2.5 text-left text-white/50"
                  title={t('sidebar_youtube_row_empty_hint')}
                  role="note"
                >
                  <Mail className="h-4 w-4 shrink-0 opacity-60" />
                  <span className="truncate">{t('sidebar_club_youtube_channel')}</span>
                </span>
              )}
              <button
                type="button"
                title={t('sidebar_club_youtube_settings_aria')}
                aria-label={t('sidebar_club_youtube_settings_aria')}
                onClick={(e) => {
                  e.stopPropagation();
                  openModal();
                }}
                className="flex shrink-0 items-center border-l border-black/25 px-3 text-gray-300 transition-colors hover:bg-zinc-700/90"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
            {children ? <div className="border-t border-black/25">{children}</div> : null}
          </div>
        )}
      </div>

      {modalOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="club-youtube-modal-title"
            >
              <div className="w-full max-w-md overflow-hidden rounded border border-zinc-600 bg-zinc-800 shadow-2xl">
                <div
                  id="club-youtube-modal-title"
                  className="flex items-center justify-between gap-2 bg-[#8b0000] px-3 py-2 text-sm font-semibold text-white"
                >
                  <span className="min-w-0 flex-1">{t('modal_club_youtube_channel_title')}</span>
                  <span className="flex shrink-0 gap-0.5 text-white/90" aria-hidden>
                    <Star className="h-3.5 w-3.5 fill-white" strokeWidth={0} />
                    <Star className="h-3.5 w-3.5 fill-white" strokeWidth={0} />
                    <Star className="h-3.5 w-3.5 fill-white" strokeWidth={0} />
                  </span>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      readOnly={!canManageClub}
                      placeholder={t('modal_youtube_channel_placeholder')}
                      className={`min-w-0 flex-1 rounded border border-zinc-500 px-2 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 ${
                        canManageClub ? 'bg-white' : 'bg-zinc-100'
                      }`}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={openDraftYoutubeInNewTab}
                      disabled={!normalizeYoutubeUrlForOpen(draft)}
                      title={t('modal_youtube_open_draft_tab')}
                      aria-label={t('modal_youtube_open_draft_tab')}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Youtube className="h-5 w-5" />
                    </button>
                  </div>
                  {!draftValid && (
                    <p className="text-xs text-amber-300">{t('modal_youtube_channel_invalid')}</p>
                  )}
                  {saveError && (
                    <p className="text-xs text-red-300">{saveError}</p>
                  )}
                  {clubResolveLoading && canManageClub && (
                    <p className="text-xs text-zinc-300">{t('modal_club_youtube_resolving')}</p>
                  )}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="rounded bg-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-600"
                    >
                      {t('btn_cancel')}
                    </button>
                    {canManageClub ? (
                      <button
                        type="button"
                        disabled={!draftValid || saveLoading || clubResolveLoading}
                        onClick={() => void saveYoutube()}
                        className="rounded bg-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-600 disabled:opacity-50"
                      >
                        {t('btn_save')}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
