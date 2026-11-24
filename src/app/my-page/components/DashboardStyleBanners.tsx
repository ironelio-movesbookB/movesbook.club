'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdvertisementCarousel from '@/components/AdvertisementCarousel';
import AthleteLegacyBanner, {
  type AthleteLegacyBannerProfile,
} from '@/components/athlete/AthleteLegacyBanner';
import ChangeBannerModal, { type BannerAlignment } from '@/components/athlete/ChangeBannerModal';
import ClubDashboardMyPageBanner from '@/app/club/dashboard/components/ClubDashboardMyPageBanner';
import { getClubMyPageDisplayName, getFormCreatedClubsSortedByCreatedAt } from '@/lib/club/clubSidebarLabel';
import { getHeroBannerDisplayUrl } from '@/lib/profileBannerSequence';
import { useLanguage } from '@/contexts/LanguageContext';
import { isClubAccountUserType } from '@/utils/dashboardRouting';

type DashboardStyleBannersProps = {
  user: { userType: string };
  activeTab: 'my-page' | 'my-entity';
  showAdBanner: boolean;
  showPersonalBanner: boolean;
  clubs: Array<{
    id: string;
    name: string;
    description?: string | null;
    createdAt?: string | Date | null;
  }>;
  myClubs: Array<{ id: string; name?: string | null }>;
  selectedClubId?: string | null;
};

export default function DashboardStyleBanners({
  user,
  activeTab,
  showAdBanner,
  showPersonalBanner,
  clubs,
  myClubs,
  selectedClubId = null,
}: DashboardStyleBannersProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [bannerProfile, setBannerProfile] = useState<AthleteLegacyBannerProfile | null>(null);
  const [showChangeBannerModal, setShowChangeBannerModal] = useState(false);

  const loadBannerProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBannerProfile({
          image: data.image,
          profileBanner: data.profileBanner,
          profileBannerAlignment: data.profileBannerAlignment,
          profileBannerSequence: data.profileBannerSequence,
          profileBannerVideo: data.profileBannerVideo,
          name: data.name,
          firstName: data.firstName,
          surname: data.surname,
        });
      }
    } catch (e) {
      console.error('Error loading profile for banner:', e);
    }
  }, []);

  useEffect(() => {
    void loadBannerProfile();
  }, [loadBannerProfile]);

  const isClub = isClubAccountUserType(user.userType);
  const isAthlete = ['ATHLETE', 'ADMIN'].includes(user.userType);

  const formClubs = useMemo(() => getFormCreatedClubsSortedByCreatedAt(clubs), [clubs]);
  const bannerClub = useMemo(() => {
    if (!isClub || formClubs.length === 0) return null;
    const activeClub = selectedClubId
      ? formClubs.find((c) => c.id === selectedClubId) ?? null
      : null;
    return activeClub ?? formClubs[0] ?? null;
  }, [isClub, formClubs, selectedClubId]);

  const primaryClubName =
    myClubs.find((c) => c.id === selectedClubId)?.name ?? myClubs[0]?.name ?? null;

  return (
    <>
      {showAdBanner ? (
        <div className="flex-shrink-0 px-4">
          <AdvertisementCarousel />
        </div>
      ) : null}

      {showPersonalBanner && isClub && bannerClub ? (
        <ClubDashboardMyPageBanner
          clubName={getClubMyPageDisplayName(bannerClub)}
          clubId={bannerClub.id}
          onClubProfileClick={() => {
            router.push(`/my-club?clubId=${encodeURIComponent(bannerClub.id)}`);
          }}
          coverImageUrl={getHeroBannerDisplayUrl(bannerProfile)}
          coverBannerAlignment={
            bannerProfile?.profileBannerAlignment === 'center' ? 'center' : 'default'
          }
          onCoverCameraClick={() => setShowChangeBannerModal(true)}
          showSponsored={activeTab === 'my-page'}
        />
      ) : null}

      {showPersonalBanner && isAthlete ? (
        <div className="mb-6 flex-shrink-0 px-0">
          <AthleteLegacyBanner
            profile={bannerProfile}
            primaryClubName={primaryClubName}
            onCoverCameraClick={() => setShowChangeBannerModal(true)}
            t={t}
          />
        </div>
      ) : null}

      {showPersonalBanner && !isClub && !isAthlete ? (
        <div className="mb-6 flex-shrink-0 px-0">
          <AthleteLegacyBanner profile={bannerProfile} t={t} />
        </div>
      ) : null}

      <ChangeBannerModal
        isOpen={showChangeBannerModal}
        onClose={() => setShowChangeBannerModal(false)}
        onSaved={(patch) => {
          setBannerProfile((prev) => {
            const next = { ...(prev ?? {}) };
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
        }}
        currentBannerPath={bannerProfile?.profileBanner}
        currentAlignment={
          (bannerProfile?.profileBannerAlignment as BannerAlignment | null | undefined) ?? 'default'
        }
        currentBannerSequenceJson={bannerProfile?.profileBannerSequence}
        currentBannerVideoPath={bannerProfile?.profileBannerVideo}
        t={t}
      />
    </>
  );
}
