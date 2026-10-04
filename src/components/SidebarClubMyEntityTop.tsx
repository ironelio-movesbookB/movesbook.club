'use client';

import Image from 'next/image';
import {
  UserCircle,
  BookOpen,
  Building2,
  Eye,
  ChevronDown,
  Settings,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import ClubMembersDashboardSection from '@/components/club/ClubMembersDashboardSection';
import ClubMyClubInfoSubmenu from '@/components/club/ClubMyClubInfoSubmenu';
import ClubSocialSubmenu from '@/components/club/ClubSocialSubmenu';
import { isClubAccountUserType } from '@/utils/dashboardRouting';
import { canManageClubWebsite } from '@/lib/club/clubWebsitePermissions';
import { parseClubDescriptionMeta } from '@/lib/club/clubSidebarLabel';
import { resolveManagedEntityDisplayImageUrl } from '@/lib/entity/resolveManagedEntityDisplayImage';
import { useAuth } from '@/hooks/useAuth';
import MubSidebarBar from '@/components/mub/MubSidebarBar';

type ClubEntity = {
  id?: string;
  name?: string;
  description?: string | null;
  location?: string | null;
  imageUrl?: string | null;
  youtubeChannelUrl?: string | null;
  adminId?: string | null;
  admin?: { id?: string } | null;
};

function parseLocalityAndCountry(location: string | null | undefined): {
  locality: string;
  country: string;
} {
  const raw = (location || '').trim();
  if (!raw) return { locality: '—', country: '—' };
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return {
      locality: parts[0],
      country: parts.slice(1).join(', '),
    };
  }
  return { locality: raw, country: '—' };
}

/**
 * Replaces the legacy "My Page" profile strip when a club account selects "My Club":
 * reference layout — header + logo/details, then primary accordion rows (no red bar).
 */
export default function SidebarClubMyEntityTop({
  personName,
  club,
  userCountry,
  userImageUrl,
  userType,
  onClubYoutubeSaved,
  onClubBootstrapped,
  onChangeLogo,
  onChatClick,
}: {
  personName: string;
  club: ClubEntity | null;
  userCountry?: string | null;
  userImageUrl?: string | null;
  userType: string;
  onClubYoutubeSaved?: (clubId: string, url: string | null) => void;
  onClubBootstrapped?: (club: {
    id: string;
    name?: string;
    youtubeChannelUrl?: string | null;
  }) => void;
  onChangeLogo?: () => void;
  onChatClick?: () => void;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const canManageClub = canManageClubWebsite(user?.id, userType, club);
  const { locality, country: fallbackCountry } = parseLocalityAndCountry(club?.location);
  const clubMeta = parseClubDescriptionMeta(club?.description);
  const clubType =
    clubMeta.category?.trim() ||
    (club?.description?.trim().startsWith('{') ? '' : club?.description?.trim()) ||
    '';
  const logoUrl = resolveManagedEntityDisplayImageUrl({
    description: club?.description,
    imageUrl: club?.imageUrl,
    userImageUrl,
  });
  const country = userCountry ?? fallbackCountry;
  /** Official MY CLUB menu: dashboard, social and visitors rows move below Club Info (DarkSidebar). */
  const officialClubLayout = isClubAccountUserType(userType);

  return (
    <div className="bg-[#252525] flex-shrink-0 border-b border-gray-700/80">
      <div className="p-3 pb-0">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 ring-1 ring-white/25">
              <UserCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-white text-sm font-bold truncate">{personName}</span>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-md bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-gray-100 transition-colors"
          >
            Like
          </button>
        </div>

        <div className="flex gap-3 mb-3">
          <div className="flex flex-col items-stretch w-[5.5rem] flex-shrink-0">
            <div className="relative w-20 h-20 bg-gray-700 rounded overflow-hidden border border-gray-600/80">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="80px"
                  unoptimized
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-amber-200/90 via-sky-300/80 to-slate-700/90" />
              )}
            </div>
            <button
              type="button"
              onClick={onChangeLogo}
              className="mt-1 text-left text-[11px] text-white underline underline-offset-2 decoration-white/80 hover:text-white/90"
            >
              Change Logo
            </button>
          </div>

          <div className="flex-1 min-w-0 space-y-2 text-xs leading-snug">
            <div>
              <div className="text-[#d4a017] font-medium">Club Type</div>
              <div className="text-white mt-0.5 min-h-[1rem]">
                {clubType || <span className="text-white/30"> </span>}
              </div>
            </div>
            <div>
              <div className="text-[#d4a017] font-medium">Country</div>
              <div className="text-white mt-0.5">{country}</div>
            </div>
            <div>
              <div className="text-[#d4a017] font-medium">Locality</div>
              <div className="text-white mt-0.5 border-b border-white/70 inline-block pb-px">
                {locality}
              </div>
            </div>
          </div>
        </div>
        <MubSidebarBar variant="gradient" />

      </div>

      {/* MY CLUB - Dashboard for the members (topics/subtopics from website editor) */}
      {officialClubLayout ? null : (
        <div className="border-t border-gray-700/60">
          <ClubMembersDashboardSection
            clubId={club?.id}
            youtubeChannelUrl={club?.youtubeChannelUrl}
            canManageClub={canManageClub}
            onYoutubeChannelUrlSaved={onClubYoutubeSaved}
            onClubBootstrapped={onClubBootstrapped}
          />
        </div>
      )}

      {/* Primary menus below dashboard */}
      <div className="border-t border-gray-700/60">
        <div className="w-full bg-teal-800 text-white border-b border-teal-700">
          <div className="flex items-center justify-between py-2.5 px-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <BookOpen className="w-5 h-5 shrink-0" />
              <span className="font-semibold tracking-wide truncate">{t('sidebar_user_guides')}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ChevronDown className="w-4 h-4 opacity-90" />
              <Settings className="w-4 h-4 opacity-90" />
            </div>
          </div>
        </div>

        {officialClubLayout ? null : <ClubSocialSubmenu onChatClick={onChatClick} />}

        {officialClubLayout ? (
          <ClubMyClubInfoSubmenu clubId={club?.id} />
        ) : (
          <button
            type="button"
            className="w-full bg-teal-800 hover:bg-teal-700 text-white py-2.5 px-3 flex items-center justify-between transition-colors border-b border-teal-700"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Building2 className="w-5 h-5 shrink-0" />
              <span className="font-semibold tracking-wide truncate">Club Info</span>
            </div>
            <ChevronDown className="w-4 h-4 opacity-90" />
          </button>
        )}

        {officialClubLayout ? null : (
          <button
            type="button"
            className="w-full bg-teal-800 hover:bg-teal-700 text-white py-2.5 px-3 flex items-center justify-between transition-colors border-b border-teal-700"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Eye className="w-5 h-5 shrink-0" />
              <span className="font-semibold tracking-wide truncate">Club page for visitors</span>
            </div>
            <ChevronDown className="w-4 h-4 opacity-90" />
          </button>
        )}

      </div>
    </div>
  );
}
