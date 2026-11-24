'use client';

import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import AdvertisementCarousel from '@/components/AdvertisementCarousel';
import ModernNavbar from '@/components/ModernNavbar';
import SimpleFooter from '@/components/SimpleFooter';
import ClubDashboardMyPageBanner from '@/app/club/dashboard/components/ClubDashboardMyPageBanner';
import { getHeroBannerDisplayUrl } from '@/lib/profileBannerSequence';
import { useClubWebsiteSettingsPage } from '@/hooks/useClubWebsiteSettingsPage';
import { ClubWebsiteSettingsSidebarProvider } from '@/components/club/websiteSettings/ClubWebsiteSettingsSidebarContext';
import { isClubAccountUserType } from '@/utils/dashboardRouting';

/**
 * Club accounts: content only (ClubWorkspaceShell provides chrome).
 * Other roles: full standalone page chrome so display/settings stay reachable.
 */
export default function ClubWebsiteSettingsPageShell({
  children,
}: {
  children: (ctx: ReturnType<typeof useClubWebsiteSettingsPage>) => ReactNode;
}) {
  const ctx = useClubWebsiteSettingsPage();
  const {
    user,
    loading,
    clubsLoading,
    showAdBanner,
    showPersonalBanner,
    activeClub,
    bannerProfile,
    clubDisplayName,
  } = ctx;
  const inClubWorkspace = Boolean(user && isClubAccountUserType(user.userType));

  if (loading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
      </div>
    );
  }

  const body = clubsLoading ? (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
    </div>
  ) : (
    <ClubWebsiteSettingsSidebarProvider clubId={ctx.clubId}>
      {children(ctx)}
    </ClubWebsiteSettingsSidebarProvider>
  );

  if (inClubWorkspace) {
    return body;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <ModernNavbar />
      <div className="flex w-full flex-1 flex-col py-2">
        {showAdBanner ? (
          <div className="mb-4 flex-shrink-0">
            <AdvertisementCarousel />
          </div>
        ) : null}
        {showPersonalBanner && activeClub ? (
          <ClubDashboardMyPageBanner
            clubName={clubDisplayName}
            coverImageUrl={getHeroBannerDisplayUrl(bannerProfile)}
            coverBannerAlignment={
              bannerProfile?.profileBannerAlignment === 'center' ? 'center' : 'default'
            }
            onCoverCameraClick={() => {}}
            showSponsored={false}
          />
        ) : null}
        <main className="min-w-0 flex-1 px-2 pb-4">{body}</main>
      </div>
      <SimpleFooter />
    </div>
  );
}
