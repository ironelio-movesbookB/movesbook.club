'use client';

import { useEffect, useState } from 'react';
import { MapPin, User as UserIcon, X } from 'lucide-react';

export type ChatPeerProfile = {
  id: string;
  name: string;
  fullName: string;
  username: string;
  telegramAccount: string | null;
  image: string | null;
  country: string | null;
  countryFlag: string;
  gender: string | null;
  age: number | null;
  userType: string;
  sports: string[];
  lastSeenAt: string | null;
  isOnline: boolean;
  youtubeChannelUrl: string | null;
};

type ChatPeerInfoSidebarProps = {
  userId: string;
  onClose: () => void;
  getAuthHeaders?: () => Record<string, string>;
};

function formatLastSeen(lastSeenAt: string | null, isOnline: boolean): string {
  if (isOnline) return 'online';
  if (!lastSeenAt) return 'last seen a long time ago';
  try {
    const d = new Date(lastSeenAt);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'last seen just now';
    if (mins < 60) return `last seen ${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `last seen ${hours} hour${hours === 1 ? '' : 's'} ago`;
    return `last seen ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  } catch {
    return 'last seen a long time ago';
  }
}

function formatUserType(userType: string): string {
  return userType
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

const defaultGetAuthHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

export default function ChatPeerInfoSidebar({
  userId,
  onClose,
  getAuthHeaders: getAuthHeadersProp,
}: ChatPeerInfoSidebarProps) {
  const getAuthHeaders = getAuthHeadersProp ?? defaultGetAuthHeaders;
  const [profile, setProfile] = useState<ChatPeerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProfile(null);

    const load = async () => {
      try {
        const res = await fetch(`/api/chat/users/${encodeURIComponent(userId)}/profile`, {
          headers: getAuthHeaders(),
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setError(data.error || 'Failed to load profile');
          return;
        }
        if (!cancelled) setProfile(data as ChatPeerProfile);
      } catch (e) {
        console.error('Chat peer profile load:', e);
        if (!cancelled) setError('Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
    // Auth headers are read at call time; avoid re-fetch loops from unstable callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const telegram =
    profile?.telegramAccount?.trim()
      ? profile.telegramAccount.startsWith('@')
        ? profile.telegramAccount
        : `@${profile.telegramAccount}`
      : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-base font-semibold text-gray-900">User Info</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          title="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-gray-500">Loading…</div>
      ) : error ? (
        <div className="p-6 text-center text-sm text-red-600">{error}</div>
      ) : profile ? (
        <>
          <div className="flex flex-col items-center gap-2 border-b border-gray-100 px-4 py-6">
            <div className="relative h-24 w-24 overflow-hidden rounded-full bg-gray-200">
              {profile.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-400">
                  <UserIcon className="h-12 w-12" />
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900">{profile.fullName}</p>
              <p className="mt-0.5 text-sm text-gray-500">
                {formatLastSeen(profile.lastSeenAt, profile.isOnline)}
              </p>
            </div>
          </div>

          <div className="space-y-4 px-4 py-4">
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Account
              </h4>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500">Username</dt>
                  <dd className="font-medium text-gray-900">@{profile.username}</dd>
                </div>
                {telegram ? (
                  <div>
                    <dt className="text-gray-500">Telegram</dt>
                    <dd className="font-medium text-emerald-700">{telegram}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-gray-500">Type</dt>
                  <dd className="font-medium text-gray-900">{formatUserType(profile.userType)}</dd>
                </div>
              </dl>
            </section>

            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Profile
              </h4>
              <dl className="space-y-2 text-sm">
                {profile.age != null ? (
                  <div>
                    <dt className="text-gray-500">Age</dt>
                    <dd className="font-medium text-gray-900">{profile.age}</dd>
                  </div>
                ) : null}
                {profile.gender ? (
                  <div>
                    <dt className="text-gray-500">Gender</dt>
                    <dd className="font-medium text-gray-900 capitalize">{profile.gender}</dd>
                  </div>
                ) : null}
                {profile.sports.length > 0 ? (
                  <div>
                    <dt className="text-gray-500">Sport</dt>
                    <dd className="font-medium text-gray-900">{profile.sports.join(', ')}</dd>
                  </div>
                ) : null}
                {profile.country ? (
                  <div>
                    <dt className="text-gray-500">Country</dt>
                    <dd className="flex items-center gap-1.5 font-medium text-gray-900">
                      <MapPin className="h-3.5 w-3.5 text-gray-400" />
                      <span>
                        {profile.country}
                        {profile.countryFlag ? ` ${profile.countryFlag}` : ''}
                      </span>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
