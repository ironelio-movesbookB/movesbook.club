'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Check, Loader2, X } from 'lucide-react';
import { formatMyClubsSidebarLabel } from '@/lib/club/clubSidebarLabel';

export type ShareInMyClubsKind = 'ogp' | 'ogp-group' | 'news';

/** Per-club share targets — both may be selected. */
type ShareDestinations = {
  /** Club OGP News / News feed */
  clubFeed: boolean;
  /** Also promote into Club Global News */
  global: boolean;
};

const DEFAULT_DESTINATIONS: ShareDestinations = { clubFeed: true, global: false };

function destinationLabels(kind: ShareInMyClubsKind): { club: string; global: string } {
  if (kind === 'news') return { club: 'News', global: 'Global News' };
  return { club: 'OGP News', global: 'Global News' };
}

type MyClubOption = {
  id: string;
  name: string;
  sidebarLabel?: string;
  clubUsername?: string | null;
};

type ShareInMyClubsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  kind: ShareInMyClubsKind;
  itemId: string;
  itemTitle?: string | null;
  adminUsername?: string;
  sharedClubIds?: string[];
  onShared?: (clubId: string) => void;
  onUnshared?: (clubId: string) => void;
};

export default function ShareInMyClubsModal({
  isOpen,
  onClose,
  kind,
  itemId,
  itemTitle,
  adminUsername = 'username',
  sharedClubIds = [],
  onShared,
  onUnshared,
}: ShareInMyClubsModalProps) {
  const [clubs, setClubs] = useState<MyClubOption[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  /** Per-club share targets (checkboxes); defaults to club OGP/News feed only. */
  const [clubDestinations, setClubDestinations] = useState<Record<string, ShareDestinations>>({});
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingClubId, setRemovingClubId] = useState<string | null>(null);

  const loadClubs = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setLoadingClubs(true);
    try {
      const res = await fetch('/api/clubs/my-clubs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load clubs');
      const data = (await res.json()) as { clubs?: MyClubOption[] };
      setClubs(data.clubs ?? []);
    } catch {
      setError('Could not load your clubs.');
    } finally {
      setLoadingClubs(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedClubId(null);
    setClubDestinations({});
    setPassword('');
    setError(null);
    setSubmitting(false);
    setRemovingClubId(null);
    void loadClubs();
  }, [isOpen, loadClubs]);

  const destLabels = destinationLabels(kind);

  const getClubDestinations = (clubId: string): ShareDestinations =>
    clubDestinations[clubId] ?? DEFAULT_DESTINATIONS;

  const toggleClubDestination = (
    clubId: string,
    key: keyof ShareDestinations,
    checked: boolean,
  ) => {
    setClubDestinations((prev) => {
      const current = prev[clubId] ?? DEFAULT_DESTINATIONS;
      return { ...prev, [clubId]: { ...current, [key]: checked } };
    });
    setSelectedClubId(clubId);
  };

  if (!isOpen) return null;

  const shareEndpoint =
    kind === 'ogp-group'
      ? `/api/clubs/shared-news/ogp-group/${itemId}`
      : kind === 'ogp'
        ? `/api/clubs/shared-news/ogp/${itemId}`
        : `/api/clubs/shared-news/news/${itemId}`;

  const handleShare = async () => {
    if (!selectedClubId) {
      setError('Select a club first.');
      return;
    }
    const destinations = getClubDestinations(selectedClubId);
    if (!destinations.clubFeed && !destinations.global) {
      setError(`Select at least one of ${destLabels.club} or ${destLabels.global}.`);
      return;
    }
    const trimmed = password.trim();
    if (!trimmed) {
      setError('Enter your admin password.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Not signed in.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(shareEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clubId: selectedClubId,
          password: trimmed,
          // Global News is a promotion flag on the club share; selecting either/both
          // creates the share, and global sets inClubGlobalNews.
          inClubGlobalNews: destinations.global,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || 'Failed to share in club.');
        return;
      }
      onShared?.(selectedClubId);
      setPassword('');
      setSelectedClubId(null);
    } catch {
      setError('Could not share. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnshare = async (clubId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setRemovingClubId(clubId);
    setError(null);
    try {
      const res = await fetch(`${shareEndpoint}?clubId=${encodeURIComponent(clubId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || 'Failed to remove from club.');
        return;
      }
      onUnshared?.(clubId);
    } catch {
      setError('Could not remove from club.');
    } finally {
      setRemovingClubId(null);
    }
  };

  const labelForClub = (club: MyClubOption) =>
    club.sidebarLabel || formatMyClubsSidebarLabel(club);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-in-my-clubs-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[90vh] overflow-hidden border border-gray-400 bg-[#f3f3f3] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="absolute right-3 top-3 z-10 rounded p-1 text-white/90 hover:bg-white/10 disabled:opacity-50"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div
          id="share-in-my-clubs-title"
          className="bg-[#6b1020] px-4 py-2.5 pr-10 text-sm font-semibold text-white"
        >
          Share in My Clubs
        </div>

        <div className="space-y-4 overflow-y-auto p-5 max-h-[calc(90vh-3rem)]">
          {itemTitle ? (
            <p className="text-sm text-gray-700">
              Share <span className="font-medium">&quot;{itemTitle}&quot;</span> into one of your clubs.
            </p>
          ) : (
            <p className="text-sm text-gray-700">
              Select a club to share this{' '}
              {kind === 'ogp-group'
                ? 'OGP News group'
                : kind === 'ogp'
                  ? 'OGP News'
                  : 'News'}{' '}
              {kind === 'ogp-group' ? '' : 'article'}.
            </p>
          )}

          {loadingClubs ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your clubs…
            </div>
          ) : clubs.length === 0 ? (
            <p className="text-sm text-gray-600">
              You have no clubs yet. Create a club from the sidebar first.
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded border border-gray-300 bg-white">
              {clubs.map((club) => {
                const isShared = sharedClubIds.includes(club.id);
                const isSelected = selectedClubId === club.id;
                const destinations = getClubDestinations(club.id);
                return (
                  <div
                    key={club.id}
                    className={`flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2.5 last:border-b-0 ${
                      isSelected ? 'bg-teal-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!isShared) setSelectedClubId(club.id);
                      }}
                      disabled={isShared || submitting}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
                    >
                      <Building2 className="h-4 w-4 shrink-0 text-teal-700" />
                      <span className="truncate text-sm text-gray-900">{labelForClub(club)}</span>
                    </button>
                    {isShared ? (
                      <>
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-teal-700">
                          <Check className="h-3.5 w-3.5" />
                          Shared
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleUnshare(club.id)}
                          disabled={removingClubId === club.id}
                          className="shrink-0 text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {removingClubId === club.id ? 'Removing…' : 'Remove'}
                        </button>
                      </>
                    ) : (
                      <fieldset
                        className="flex shrink-0 items-center gap-3 rounded border border-gray-300 bg-gray-50 px-2.5 py-1.5"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Share destination for ${labelForClub(club)}`}
                      >
                        <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-gray-800">
                          <input
                            type="checkbox"
                            checked={destinations.clubFeed}
                            disabled={submitting}
                            onChange={(e) => {
                              toggleClubDestination(club.id, 'clubFeed', e.target.checked);
                            }}
                            className="h-3.5 w-3.5 rounded border-gray-400 accent-[#6b1020]"
                          />
                          {destLabels.club}
                        </label>
                        <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-gray-800">
                          <input
                            type="checkbox"
                            checked={destinations.global}
                            disabled={submitting}
                            onChange={(e) => {
                              toggleClubDestination(club.id, 'global', e.target.checked);
                            }}
                            className="h-3.5 w-3.5 rounded border-gray-400 accent-[#6b1020]"
                          />
                          {destLabels.global}
                        </label>
                      </fieldset>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {selectedClubId && !sharedClubIds.includes(selectedClubId) ? (
            <div className="space-y-3 rounded border border-gray-300 bg-white p-4">
              <p className="text-sm text-gray-700">
                Retype the password for Club Admin &lt;{adminUsername}&gt; to share in this club.
              </p>
              <div>
                <label htmlFor="share-club-admin-password" className="mb-1 block text-sm text-gray-800">
                  Admin password
                </label>
                <input
                  id="share-club-admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !submitting) void handleShare();
                  }}
                  autoFocus
                  disabled={submitting}
                  className="w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm disabled:opacity-60"
                  placeholder="Retype your password"
                />
              </div>
              <div className="flex justify-center gap-4 pt-1">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleShare()}
                  className="flex items-center justify-center gap-2 rounded-lg border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-8 py-2.5 text-sm font-semibold text-white shadow disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sharing…
                    </>
                  ) : (
                    'Continue'
                  )}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setSelectedClubId(null);
                    setPassword('');
                  }}
                  className="rounded-lg border border-gray-900 bg-gradient-to-b from-gray-700 to-black px-8 py-2.5 text-sm font-semibold text-white shadow disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {!selectedClubId ? (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-900 bg-gradient-to-b from-gray-700 to-black px-6 py-2 text-sm font-semibold text-white shadow"
              >
                Close
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
