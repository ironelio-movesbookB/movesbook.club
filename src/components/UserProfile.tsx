'use client';

import { useEffect, useState, useCallback, type FormEvent } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { User, Mail, Calendar, Users, Award, Trophy, Settings as SettingsIcon } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '@/constants/tools.constants';
import { ALL_COUNTRIES } from '@/constants/countries.constants';
import ModernNavbar from '@/components/ModernNavbar';
import ChangeProfilePhotoModal from '@/components/athlete/ChangeProfilePhotoModal';
import ChangeBannerModal, { type BannerAlignment } from '@/components/athlete/ChangeBannerModal';
import type { AthleteLegacyBannerProfile } from '@/components/athlete/AthleteLegacyBanner';
import StandardPageBanners, { profileToBannerProfile } from '@/components/layout/StandardPageBanners';
import { useLanguage } from '@/contexts/LanguageContext';
import ProfileSportsMultiSelect from '@/components/profile/ProfileSportsMultiSelect';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';
import { getDashboardPathForUserType, isClubAccountUserType } from '@/utils/dashboardRouting';
import ClubAdminInfoForm from '@/components/profile/ClubAdminInfoForm';
import MemberSelfProfilePanel from '@/components/profile/MemberSelfProfilePanel';
import ClubReferencesDisplay from '@/components/club/ClubReferencesDisplay';
import {
  getClubReferencesHtmlForDisplay,
  parseClubDescriptionMeta,
} from '@/lib/club/clubSidebarLabel';

const CKEditorComponent = dynamic(() => import('@/components/news/CKEditor'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[200px] rounded border border-gray-300 bg-white p-4 text-sm text-gray-500">
      Loading editor…
    </div>
  ),
});

interface UserProfileData {
  id: string;
  email: string;
  username: string;
  name: string;
  firstName?: string | null;
  surname?: string | null;
  country?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  image?: string | null;
  profileBanner?: string | null;
  profileBannerAlignment?: string | null;
  profileBannerSequence?: string | null;
  profileBannerVideo?: string | null;
  telegramAccount?: string | null;
  youtubeChannelUrl?: string | null;
  mainSports?: Array<{ sport: string; order: number }>;
  userType: string;
  createdAt: string;
  settings: { language?: string } | null;
  periods: Array<{ id: string; name: string; color: string; description: string }>;
  sections: Array<{ id: string; name: string; color: string; description: string }>;
  clubMemberships: Array<{
    club: { id: string; name: string; description: string };
  }>;
  coaches: Array<{
    coach: { id: string; name: string; email: string };
  }>;
  athletes: Array<{
    athlete: { id: string; name: string; email: string };
  }>;
  _count: {
    workoutPlans: number;
    workoutTemplates: number;
    clubMemberships: number;
  };
  referencesHtml?: string;
  referencesLevel?: string;
}

type ProfileFormState = {
  name: string;
  firstName: string;
  surname: string;
  country: string;
  gender: string;
  birthdate: string;
  preferredLanguage: string;
  telegramAccount: string;
  youtubeChannelUrl: string;
  mainSports: string[];
};

function readProfileHash(): 'member-info' | 'admin-info' | 'member-profile' | null {
  if (typeof window === 'undefined') return null;
  const id = window.location.hash.replace(/^#/, '');
  if (id === 'member-info' || id === 'admin-info' || id === 'member-profile') return id;
  return null;
}

function scrollToHash(hash: string) {
  if (!hash) return;
  const id = hash.replace(/^#/, '');
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function formatBirthdateInput(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function formatProfileDisplayDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function formatUserTypeLabel(userType: string): string {
  return userType.replace(/_/g, ' ');
}

export default function UserProfile({
  embedded = false,
  embeddedVariant,
}: {
  embedded?: boolean;
  embeddedVariant?: 'admin-profile';
}) {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [profileHash, setProfileHash] = useState<
    'member-info' | 'admin-info' | 'member-profile' | null
  >(null);
  const [form, setForm] = useState<ProfileFormState>({
    name: '',
    firstName: '',
    surname: '',
    country: '',
    gender: '',
    birthdate: '',
    preferredLanguage: 'en',
    telegramAccount: '',
    youtubeChannelUrl: '',
    mainSports: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showChangeBannerModal, setShowChangeBannerModal] = useState(false);
  const [avatarOverride, setAvatarOverride] = useState<string | null | undefined>(undefined);
  const [bannerOverride, setBannerOverride] = useState<AthleteLegacyBannerProfile | null>(null);
  const [referencesHtml, setReferencesHtml] = useState('');
  const [referencesLevel, setReferencesLevel] = useState('1');

  const applyProfileToForm = useCallback((data: UserProfileData) => {
    setForm({
      name: data.name ?? '',
      firstName: data.firstName ?? '',
      surname: data.surname ?? '',
      country: data.country ?? '',
      gender: data.gender ?? '',
      birthdate: formatBirthdateInput(data.birthdate),
      preferredLanguage: data?.settings?.language || 'en',
      telegramAccount: data.telegramAccount ?? '',
      youtubeChannelUrl: data.youtubeChannelUrl ?? '',
      mainSports: data.mainSports?.map((s) => s.sport) ?? [],
    });
    setReferencesHtml(data.referencesHtml ?? '');
    setReferencesLevel(data.referencesLevel?.trim() || '1');
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/user/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = (await response.json()) as UserProfileData;
        setProfile(data);
        applyProfileToForm(data);
      } else {
        setError('Failed to load profile');
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Error loading profile');
    } finally {
      setLoading(false);
    }
  }, [applyProfileToForm]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const syncHash = () => {
      const hash = readProfileHash();
      setProfileHash(hash);
      if (!hash) return;
      if (profile && !isClubAccountUserType(profile.userType) && hash === 'member-profile') {
        scrollToHash('member-info');
        return;
      }
      scrollToHash(window.location.hash);
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [loading, profile]);

  const saveProfile = async (e?: FormEvent) => {
    e?.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setSaveMessage('Please sign in to save your profile.');
        return;
      }

      const displayName = form.name.trim();
      if (!displayName) {
        setSaveMessage('Display name is required.');
        return;
      }

      setSaving(true);
      setSaveMessage(null);

      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: displayName,
          firstName: form.firstName.trim() || null,
          surname: form.surname.trim() || null,
          country: form.country.trim() || null,
          gender: form.gender.trim() || null,
          birthdate: form.birthdate.trim() || null,
          language: form.preferredLanguage,
          telegramAccount: form.telegramAccount.trim() || null,
          youtubeChannelUrl: form.youtubeChannelUrl.trim() || null,
          mainSports: form.mainSports,
          ...(profile && isClubAccountUserType(profile.userType)
            ? {
                referencesHtml,
                referencesLevel,
              }
            : {}),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save profile');
      }

      await loadProfile();

      localStorage.setItem('language', form.preferredLanguage);
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser) as Record<string, unknown>;
          parsed.language = form.preferredLanguage;
          parsed.name = displayName;
          if (form.country.trim()) parsed.country = form.country.trim();
          localStorage.setItem('user', JSON.stringify(parsed));
        } catch (err) {
          console.error('Failed to update local user cache:', err);
        }
      }

      setSaveMessage('Profile saved successfully.');
    } catch (err) {
      console.error('Error saving profile:', err);
      setSaveMessage(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={embedded ? 'bg-gray-50' : 'min-h-screen bg-gray-50 flex flex-col'}>
        {!embedded && <ModernNavbar />}
        {!embedded && (
          <StandardPageBanners bannerProfile={null} t={t} onAvatarCameraClick={() => setShowPhotoModal(true)} />
        )}
        <div className={`flex items-center justify-center flex-1 ${embedded ? 'py-12' : 'min-h-[40vh]'}`}>
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={embedded ? 'bg-gray-50' : 'min-h-screen bg-gray-50 flex flex-col'}>
        {!embedded && <ModernNavbar />}
        {!embedded && (
          <StandardPageBanners bannerProfile={null} t={t} onAvatarCameraClick={() => setShowPhotoModal(true)} />
        )}
        <div className={`flex items-center justify-center flex-1 ${embedded ? 'py-12' : 'min-h-[40vh]'}`}>
          <div className="text-center">
            <p className="text-red-600 mb-4">{error || 'Failed to load profile'}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                loadProfile();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayName =
    [form.firstName, form.surname].filter(Boolean).join(' ').trim() || form.name || profile.name;
  const isClubAdmin = isClubAccountUserType(profile.userType);
  const isEmbeddedAdminProfile = embedded && embeddedVariant === 'admin-profile';
  const infoSectionId = isClubAdmin ? 'admin-info' : 'member-info';
  const infoSectionTitle = isClubAdmin ? 'Admin info' : 'Member info';
  const profileSectionTitle = isEmbeddedAdminProfile ? 'Admin Profile' : 'User Profile';
  const profileSectionDescription = isEmbeddedAdminProfile
    ? 'Personal details for the club administrator account.'
    : 'Edit your details below, then click Save profile to update your account.';
  const editProfileMode = profileHash === 'member-profile';
  const avatarSrc = resolvePublicImageUrl(avatarOverride ?? profile.image);
  const dashboardHref = getDashboardPathForUserType(profile.userType);

  const bannerProfile =
    bannerOverride ??
    profileToBannerProfile({
      image: avatarOverride ?? profile.image,
      profileBanner: profile.profileBanner,
      profileBannerAlignment: profile.profileBannerAlignment,
      profileBannerSequence: profile.profileBannerSequence,
      profileBannerVideo: profile.profileBannerVideo,
      name: profile.name,
      firstName: profile.firstName,
      surname: profile.surname,
    });

  return (
    <div className={embedded ? 'bg-gray-50' : 'min-h-screen bg-gray-50 flex flex-col'}>
      {!embedded && <ModernNavbar />}
      {!embedded && (
        <StandardPageBanners
          bannerProfile={bannerProfile}
          t={t}
          onCoverCameraClick={() => setShowChangeBannerModal(true)}
          onAvatarCameraClick={() => setShowPhotoModal(true)}
        />
      )}
      <ChangeProfilePhotoModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        onSaved={(patch) => {
          if (patch.image !== undefined) {
            setAvatarOverride(patch.image);
            setProfile((prev) => (prev ? { ...prev, image: patch.image } : prev));
          }
        }}
        currentImagePath={avatarOverride ?? profile.image}
        t={t}
      />
      {!embedded && (
        <ChangeBannerModal
          isOpen={showChangeBannerModal}
          onClose={() => setShowChangeBannerModal(false)}
          onSaved={(patch) => {
            setBannerOverride((prev) => {
              const base = prev ?? profileToBannerProfile(profile) ?? {};
              const next = { ...base };
              if (patch.profileBanner !== undefined) next.profileBanner = patch.profileBanner;
              if (patch.profileBannerAlignment !== undefined) {
                next.profileBannerAlignment = patch.profileBannerAlignment;
              }
              if (patch.profileBannerSequence !== undefined) {
                next.profileBannerSequence = patch.profileBannerSequence;
              }
              if (patch.profileBannerVideo !== undefined) {
                next.profileBannerVideo = patch.profileBannerVideo;
              }
              return next;
            });
            setProfile((prev) =>
              prev
                ? {
                    ...prev,
                    ...(patch.profileBanner !== undefined
                      ? { profileBanner: patch.profileBanner }
                      : {}),
                    ...(patch.profileBannerAlignment !== undefined
                      ? { profileBannerAlignment: patch.profileBannerAlignment }
                      : {}),
                    ...(patch.profileBannerSequence !== undefined
                      ? { profileBannerSequence: patch.profileBannerSequence }
                      : {}),
                    ...(patch.profileBannerVideo !== undefined
                      ? { profileBannerVideo: patch.profileBannerVideo }
                      : {}),
                  }
                : prev,
            );
          }}
          currentBannerPath={bannerProfile?.profileBanner}
          currentAlignment={
            (bannerProfile?.profileBannerAlignment as BannerAlignment | null | undefined) ??
            'default'
          }
          currentBannerSequenceJson={bannerProfile?.profileBannerSequence}
          currentBannerVideoPath={bannerProfile?.profileBannerVideo}
          t={t}
        />
      )}
      <div className={`flex-1 w-full max-w-6xl mx-auto ${embedded ? 'p-4' : 'p-4 md:p-8'}`}>
        {!embedded && (
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <Link href={dashboardHref} className="text-blue-600 hover:text-blue-800 font-medium">
              ← Back to dashboard
            </Link>
            <span className="text-gray-300">|</span>
            {isClubAdmin ? (
              <>
                <a href="#member-profile" className="text-gray-600 hover:text-gray-900 font-medium">
                  User Profile
                </a>
                <span className="text-gray-300">|</span>
                <a href={`#${infoSectionId}`} className="text-gray-600 hover:text-gray-900">
                  {infoSectionTitle}
                </a>
              </>
            ) : (
              <>
                <a href={`#${infoSectionId}`} className="text-gray-600 hover:text-gray-900 font-medium">
                  {infoSectionTitle}
                </a>
                <span className="text-gray-300">|</span>
                <a href="#member-profile" className="text-gray-600 hover:text-gray-900">
                  User Profile
                </a>
              </>
            )}
          </div>
        )}
        {/* Header */}
        {!embedded && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold overflow-hidden shrink-0">
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-800">{displayName}</h1>
                <p className="text-gray-600 flex items-center gap-2 mt-1">
                  <Mail className="w-4 h-4" />
                  {profile.email}
                </p>
                <p className="text-gray-600 flex items-center gap-2 mt-1">
                  <User className="w-4 h-4" />@{profile.username}
                </p>
                <div className="mt-2">
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                    {profile.userType.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Member Since
                </p>
                <p className="font-semibold">{new Date(profile.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Member info (non-club accounts only; club Admin info appears after User Profile) */}
        {!embedded && !isClubAdmin && (
        <section
          id={infoSectionId}
          className="scroll-mt-24 mb-6 bg-white rounded-lg shadow-lg p-4 md:p-6"
        >
          <MemberSelfProfilePanel
            userId={profile.id}
            clubs={(profile.clubMemberships || []).map((m) => ({
              id: m.club.id,
              name: m.club.name,
            }))}
          />
        </section>
        )}

        {/* Legacy editable block — club admins only (members use Member info tabs above). */}
        {isClubAdmin ? (
        <section
          id="member-profile"
          className={`scroll-mt-24 bg-white rounded-lg shadow-lg p-6 mb-6 ${
            editProfileMode ? 'ring-2 ring-blue-500/40' : ''
          }`}
        >
          <h2 className="text-xl font-bold text-gray-800 mb-1">{profileSectionTitle}</h2>
          <p className="text-sm text-gray-600 mb-4">
            {profileSectionDescription}
          </p>

          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden shrink-0">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowPhotoModal(true)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2"
            >
              Change profile photo
            </button>
          </div>

          <form onSubmit={saveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 mb-1">
                Display name
              </label>
              <input
                id="profile-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="profile-username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                id="profile-username"
                type="text"
                value={profile.username}
                readOnly
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <label htmlFor="profile-first" className="block text-sm font-medium text-gray-700 mb-1">
                First name
              </label>
              <input
                id="profile-first"
                type="text"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="profile-surname" className="block text-sm font-medium text-gray-700 mb-1">
                Surname
              </label>
              <input
                id="profile-surname"
                type="text"
                value={form.surname}
                onChange={(e) => setForm((f) => ({ ...f, surname: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="profile-country" className="block text-sm font-medium text-gray-700 mb-1">
                Country
              </label>
              <select
                id="profile-country"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select country —</option>
                {ALL_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="profile-lang" className="block text-sm font-medium text-gray-700 mb-1">
                Preferred language
              </label>
              <select
                id="profile-lang"
                value={form.preferredLanguage}
                onChange={(e) => setForm((f) => ({ ...f, preferredLanguage: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name} ({lang.code.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="profile-gender" className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select
                id="profile-gender"
                value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select —</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="profile-birthdate" className="block text-sm font-medium text-gray-700 mb-1">
                Birthdate
              </label>
              <input
                id="profile-birthdate"
                type="date"
                value={form.birthdate}
                onChange={(e) => setForm((f) => ({ ...f, birthdate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="profile-email"
                type="email"
                value={profile.email}
                readOnly
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <label htmlFor="profile-telegram" className="block text-sm font-medium text-gray-700 mb-1">
                Telegram account
              </label>
              <input
                id="profile-telegram"
                type="text"
                value={form.telegramAccount}
                onChange={(e) => setForm((f) => ({ ...f, telegramAccount: e.target.value }))}
                placeholder="@username"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="profile-youtube" className="block text-sm font-medium text-gray-700 mb-1">
                YouTube channel
              </label>
              <input
                id="profile-youtube"
                type="url"
                value={form.youtubeChannelUrl}
                onChange={(e) => setForm((f) => ({ ...f, youtubeChannelUrl: e.target.value }))}
                placeholder="https://youtube.com/@channel"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="profile-account-type" className="block text-sm font-medium text-gray-700 mb-1">
                Account type
              </label>
              <input
                id="profile-account-type"
                type="text"
                value={formatUserTypeLabel(profile.userType)}
                readOnly
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <label htmlFor="profile-member-since" className="block text-sm font-medium text-gray-700 mb-1">
                Member since
              </label>
              <input
                id="profile-member-since"
                type="text"
                value={formatProfileDisplayDate(profile.createdAt)}
                readOnly
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="profile-main-sports" className="block text-sm font-medium text-gray-700 mb-1">
                Main sports
              </label>
              <ProfileSportsMultiSelect
                id="profile-main-sports"
                value={form.mainSports}
                onChange={(mainSports) => setForm((f) => ({ ...f, mainSports }))}
                disabled={saving}
              />
              <p className="mt-1 text-xs text-gray-500">Select one or more sports from the list.</p>
            </div>
            {isClubAdmin ? (
              <div className="md:col-span-2">
                <div className="mb-2 border border-[#c9bd7a] bg-[#efe7b3] px-4 py-2 text-sm font-semibold text-gray-900">
                  References of the admin
                </div>
                <p className="mb-2 text-xs text-gray-600">
                  These references belong to the club administrator account, not to the club itself.
                </p>
                <div className="border border-gray-300 bg-white p-3">
                  <CKEditorComponent
                    value={referencesHtml}
                    onChange={(html) => setReferencesHtml(html)}
                    minHeightPx={260}
                    placeholder=""
                  />
                  <div className="mt-3 grid max-w-md grid-cols-[160px_1fr] items-center gap-2 text-sm">
                    <label className="text-gray-800">References level</label>
                    <select
                      value={referencesLevel}
                      onChange={(e) => setReferencesLevel(e.target.value)}
                      className="w-24 rounded border border-gray-400 bg-gray-100 px-2 py-1.5"
                    >
                      {['1', '2', '3', '4', '5', '6'].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="md:col-span-2 mt-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {saving ? 'Saving...' : 'Save profile'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => profile && applyProfileToForm(profile)}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium"
              >
                Reset
              </button>
              {saveMessage ? (
                <p
                  role="status"
                  className={`text-sm ${saveMessage.includes('success') ? 'text-green-700' : 'text-red-600'}`}
                >
                  {saveMessage}
                </p>
              ) : null}
            </div>
          </form>
        </section>
        ) : null}

        {/* Admin info (club accounts only; my-club Contact Info tab uses ClubAdminInfoForm) */}
        {!embedded && isClubAdmin && (
        <section id={infoSectionId} className="scroll-mt-24 mb-6">
          <ClubAdminInfoForm profileYoutubeUrl={profile.youtubeChannelUrl} />
        </section>
        )}

        {/* Statistics */}
        {!embedded && (!isClubAdmin || !editProfileMode) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-3xl font-bold text-gray-800">{profile._count.workoutPlans}</p>
            <p className="text-sm text-gray-600">Workout Plans</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <SettingsIcon className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-3xl font-bold text-gray-800">{profile._count.workoutTemplates}</p>
            <p className="text-sm text-gray-600">Templates</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Users className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-3xl font-bold text-gray-800">{profile._count.clubMemberships}</p>
            <p className="text-sm text-gray-600">Club Memberships</p>
          </div>
        </div>
        )}

        {!embedded && (!isClubAdmin || !editProfileMode) && profile.clubMemberships && profile.clubMemberships.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              My Clubs
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.clubMemberships.map((membership) => {
                const meta = parseClubDescriptionMeta(membership.club.description);
                const referencesHtml = getClubReferencesHtmlForDisplay(
                  membership.club.description,
                );
                const locationLine = [meta.location, meta.region, meta.country]
                  .map((v) => String(v || '').trim())
                  .filter(Boolean)
                  .join(', ');
                return (
                  <div
                    key={membership.club.id}
                    className="overflow-hidden rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50 shadow-sm"
                  >
                    <div className="p-4">
                      <h3 className="font-semibold text-lg text-gray-800">
                        {membership.club.name}
                      </h3>
                      {locationLine ? (
                        <p className="mt-1 text-xs text-gray-500">{locationLine}</p>
                      ) : null}
                    </div>
                    <div className="border-t border-blue-100 bg-white/80 px-2 pb-2">
                      <ClubReferencesDisplay
                        variant="club"
                        referencesHtml={referencesHtml || meta.referencesHtml}
                        referencesLevel={meta.referencesLevel}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!embedded && (!isClubAdmin || !editProfileMode) && profile.coaches && profile.coaches.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5" />
              My Coaches
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.coaches.map((relationship) => (
                <div
                  key={relationship.coach.id}
                  className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-teal-50 hover:shadow-lg transition-all border border-green-200"
                >
                  <h3 className="font-semibold text-lg text-gray-800">{relationship.coach.name}</h3>
                  <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                    <Mail className="w-4 h-4" />
                    {relationship.coach.email}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!embedded && (!isClubAdmin || !editProfileMode) && profile.athletes && profile.athletes.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              My Athletes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.athletes.map((relationship) => (
                <div
                  key={relationship.athlete.id}
                  className="p-4 rounded-lg bg-gradient-to-br from-orange-50 to-yellow-50 hover:shadow-lg transition-all border border-orange-200"
                >
                  <h3 className="font-semibold text-lg text-gray-800">{relationship.athlete.name}</h3>
                  <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                    <Mail className="w-4 h-4" />
                    {relationship.athlete.email}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
