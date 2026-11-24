'use client';

import { Camera, Home, Menu, Settings, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { DEFAULT_HERO_BANNER_URL } from '@/lib/profileBannerSequence';
import SafeCoverImage from '@/components/media/SafeCoverImage';

interface ClubDashboardMyPageBannerProps {
  clubName: string;
  /** When set, shows "Club profile" beside the club name. */
  clubId?: string | null;
  onClubProfileClick?: () => void;
  /** Resolved banner URL (same rules as athlete dashboard). */
  coverImageUrl: string;
  /** Crop alignment for cover + strip overlay. */
  coverBannerAlignment: 'center' | 'default';
  /** Opens Change banner modal (same as athlete cover camera). */
  onCoverCameraClick: () => void;
  /** Header strip — opens promocode invite flow (PHP: users/notification_by_promocode). */
  onSuggestMovesbookClick?: () => void;
  /** When false, hides the Suggest Movesbook link in the bottom strip. */
  showSuggestMovesbook?: boolean;
  /** When false, hides the right-hand SPONSORED column (e.g. My Club tab). */
  showSponsored?: boolean;
}

export default function ClubDashboardMyPageBanner({
  clubName,
  clubId,
  onClubProfileClick,
  coverImageUrl,
  coverBannerAlignment,
  onCoverCameraClick,
  onSuggestMovesbookClick,
  showSuggestMovesbook = false,
  showSponsored = true,
}: ClubDashboardMyPageBannerProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const displayName = clubName?.trim() || 'Club Magia Avollino Club';

  const src = coverImageUrl || DEFAULT_HERO_BANNER_URL;
  const alignCenter = coverBannerAlignment === 'center';
  const coverObjectClass = alignCenter ? 'object-cover object-center' : 'object-cover object-top';
  const stripBgPos = alignCenter ? 'center center' : 'center top';
  const stripSrc = src.startsWith('/uploads/') ? DEFAULT_HERO_BANNER_URL : src;

  return (
    <div className="mb-6 flex-shrink-0 px-0">
      <div className="flex w-full flex-col lg:flex-row shadow-lg overflow-hidden bg-black min-h-[220px] max-h-[280px]">
        <div className="relative flex-1 min-h-[200px] lg:min-h-[220px] min-w-0">
          <SafeCoverImage
            src={src}
            fill
            className={`${coverObjectClass} opacity-90`}
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent pointer-events-none" />

          <div
            className="absolute top-0 left-0 right-0 h-12 flex items-start justify-start p-2 z-10"
            style={{
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), transparent)',
            }}
          >
            <button
              type="button"
              onClick={onCoverCameraClick}
              className="text-white/95 p-2 rounded bg-black/25 hover:bg-black/45 focus:outline-none focus:ring-2 focus:ring-white/60 pointer-events-auto"
              title={t('athlete_banner_change_cover')}
              aria-label={t('athlete_banner_change_cover')}
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>

          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-3 p-3 z-10">
            <div className="flex items-end gap-2 min-w-0">
              <div className="w-[72px] h-[54px] shrink-0 border-2 border-white shadow-lg overflow-hidden bg-gray-200">
                <SafeCoverImage
                  src={src}
                  width={72}
                  height={54}
                  className={`w-full h-full opacity-90 ${alignCenter ? 'object-cover object-center' : 'object-cover object-top'}`}
                />
              </div>
              <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 bg-blue-700 text-white text-xs font-semibold uppercase tracking-wide rounded shadow max-w-[min(12rem,100%)] truncate">
                  {displayName}
                </span>
                {clubId && onClubProfileClick ? (
                  <button
                    type="button"
                    onClick={onClubProfileClick}
                    className="shrink-0 rounded border border-white/80 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-gray-800 shadow hover:bg-white transition-colors"
                  >
                    Club profile
                  </button>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-2 items-stretch shrink-0 w-[min(100%,15rem)] sm:w-[15rem]">
              <button
                type="button"
                className="w-full bg-white hover:bg-gray-100 text-gray-800 px-4 py-2 rounded transition-colors text-sm font-medium border border-gray-300 text-center"
              >
                Upgrade Informations
              </button>
              <button
                type="button"
                className="w-full bg-white hover:bg-gray-100 text-gray-800 px-4 py-2 rounded transition-colors text-sm font-medium border border-gray-300 text-center"
              >
                Logger of activities
              </button>
            </div>
          </div>
        </div>

        {showSponsored && (
          <aside className="w-full lg:w-64 xl:w-72 flex-shrink-0 bg-[#e8e8e8] border-t lg:border-t-0 lg:border-l border-gray-300 flex flex-col min-h-[140px] lg:min-h-0">
            <div className="bg-[#222] text-white text-center text-xs font-bold tracking-widest py-2 px-2">
              {t('sidebar_sponsored')}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="flex gap-2 bg-white/80 p-2 rounded border border-gray-200/80"
                >
                  <div className="w-12 h-12 flex-shrink-0 bg-gray-300 overflow-hidden relative">
                    <SafeCoverImage
                      src={src}
                      width={48}
                      height={48}
                      className="object-cover w-full h-full opacity-80"
                    />
                  </div>
                  <div className="min-w-0 text-xs leading-snug">
                    <a href="#" className="text-blue-700 font-medium hover:underline block truncate">
                      {t('athlete_sponsor_placeholder_title')}
                    </a>
                    <span className="text-gray-500">{t('athlete_sponsor_placeholder_domain')}</span>
                    <br />
                    <span className="text-gray-600">{t('athlete_sponsor_placeholder_desc')}</span>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      <div className="flex-shrink-0">
        <div className="bg-gray-800 overflow-hidden shadow-lg relative h-[52px]">
          <div
            className="absolute inset-0 bg-cover opacity-20"
            style={{
              backgroundImage: `url(${stripSrc})`,
              backgroundSize: 'cover',
              backgroundPosition: stripBgPos,
            }}
          />
          <div className="flex items-center justify-between px-4 text-sm h-full relative z-10 gap-3 min-w-0 overflow-x-hidden">
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 overflow-hidden">
              <button
                type="button"
                className="bg-transparent border-0 text-sm font-sans text-yellow-400 hover:text-yellow-300 whitespace-nowrap shrink-0 font-medium cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
              >
                FAQ
              </button>
              {showSuggestMovesbook ? (
                <button
                  type="button"
                  onClick={onSuggestMovesbookClick}
                  className="bg-transparent border-0 text-sm font-sans text-yellow-400 hover:text-yellow-300 whitespace-nowrap shrink-0 font-medium cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                >
                  Suggest Movesbook
                </button>
              ) : null}
              <div className="inline-flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => router.push('/users/mub_page')}
                  className="bg-transparent border-0 text-sm font-sans text-yellow-400 hover:text-yellow-300 whitespace-nowrap font-medium cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                >
                  Most used buttons
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/users/mub_page?edit=1')}
                  className="bg-transparent border-0 text-gray-400 hover:text-gray-200 cursor-pointer rounded p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70"
                  aria-label="Most used buttons settings"
                  title="Most used buttons settings"
                >
                  <Settings className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden justify-center flex-1">
              <button
                type="button"
                className="bg-transparent border-0 text-sm font-sans text-gray-300 hover:text-white flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
              >
                <Home className="w-4 h-4 shrink-0" />
                <span>Home</span>
              </button>
              <button
                type="button"
                className="bg-transparent border-0 text-sm font-sans text-gray-300 hover:text-white flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors"
              >
                <Menu className="w-4 h-4 shrink-0" />
                <span>Overview</span>
              </button>
              <button
                type="button"
                className="bg-transparent border-0 text-sm font-sans text-gray-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors"
              >
                Myworkout Section
              </button>
              <button
                type="button"
                className="bg-transparent border-0 text-sm font-sans text-gray-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors"
              >
                My Social Activities
              </button>
              <button
                type="button"
                className="bg-transparent border-0 text-sm font-sans text-gray-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors"
              >
                My Social Area
              </button>
              <button
                type="button"
                className="bg-transparent border-0 text-sm font-sans text-gray-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors"
              >
                My Internet Links
              </button>
              <button
                type="button"
                className="bg-transparent border-0 text-sm font-sans text-gray-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors"
              >
                Socials
              </button>
              <button
                type="button"
                className="bg-transparent border-0 text-sm font-sans text-gray-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors"
              >
                My Desk
              </button>
              <button
                type="button"
                className="bg-red-700 hover:bg-red-800 text-lime-400 px-3 py-1.5 rounded transition-colors inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-sans font-medium shrink-0"
              >
                <span>Search in the Network</span>
                <ChevronRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
