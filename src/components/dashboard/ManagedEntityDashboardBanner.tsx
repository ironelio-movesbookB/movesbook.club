'use client';

import { Camera, Home } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DEFAULT_HERO_BANNER_URL } from '@/lib/profileBannerSequence';
import SafeCoverImage from '@/components/media/SafeCoverImage';
import {
  getManagedEntityDashboardLabels,
  type ManagedEntityDashboardKind,
} from '@/lib/dashboard/managedEntityDashboardLabels';

interface ManagedEntityDashboardBannerProps {
  entityKind: ManagedEntityDashboardKind;
  entityName: string;
  entityId?: string | null;
  onEntityProfileClick?: () => void;
  coverImageUrl: string;
  coverBannerAlignment: 'center' | 'default';
  onCoverCameraClick: () => void;
  showSponsored?: boolean;
  activeTab: 'my-page' | 'my-entity';
  showWorkoutSection: boolean;
  onWorkoutsToggle: () => void;
}

export default function ManagedEntityDashboardBanner({
  entityKind,
  entityName,
  entityId,
  onEntityProfileClick,
  coverImageUrl,
  coverBannerAlignment,
  onCoverCameraClick,
  showSponsored = true,
  activeTab,
  showWorkoutSection,
  onWorkoutsToggle,
}: ManagedEntityDashboardBannerProps) {
  const { t } = useLanguage();
  const labels = getManagedEntityDashboardLabels(entityKind);
  const displayName = entityName?.trim() || labels.fallbackEntityName;

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
                {entityId && onEntityProfileClick ? (
                  <button
                    type="button"
                    onClick={onEntityProfileClick}
                    className="shrink-0 rounded border border-white/80 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-gray-800 shadow hover:bg-white transition-colors"
                  >
                    {labels.profileButton}
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
          <div className="flex items-center justify-between px-4 text-sm h-full relative z-10 gap-3 min-w-0">
            <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto min-w-0 flex-1">
              <button
                type="button"
                className="text-gray-300 hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Home className="w-4 h-4 shrink-0" />
                <span>Home</span>
              </button>
              <button
                type="button"
                className="text-gray-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                FAQ
              </button>
              <button
                type="button"
                className="text-gray-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                {labels.myEntities}
              </button>
              <button
                type="button"
                className="text-lime-400 hover:text-lime-300 transition-colors whitespace-nowrap font-semibold shrink-0"
              >
                {displayName}
              </button>
              {activeTab === 'my-entity' && (
                <button
                  type="button"
                  onClick={onWorkoutsToggle}
                  className={`transition-colors whitespace-nowrap shrink-0 ${
                    showWorkoutSection
                      ? 'text-lime-400 hover:text-lime-300 font-semibold'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Workouts section
                </button>
              )}
              <button
                type="button"
                className="text-gray-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                FunClub
              </button>
              <button
                type="button"
                className="text-gray-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                {labels.sharedEntities}
              </button>
              <button
                type="button"
                className="text-gray-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                {labels.otherEntities}
              </button>
              <button
                type="button"
                className="text-gray-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Populars
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
