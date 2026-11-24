'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { parseBannerSequenceJson } from '@/lib/profileBannerSequence';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';

export type AthleteLegacyBannerProfile = {
  image?: string | null;
  profileBanner?: string | null;
  /** "center" | "default" — cover crop alignment */
  profileBannerAlignment?: string | null;
  /** JSON string array of image paths for rotating cover */
  profileBannerSequence?: string | null;
  /** Uploaded banner video path (takes precedence over images / sequence) */
  profileBannerVideo?: string | null;
  name?: string | null;
  firstName?: string | null;
  surname?: string | null;
};

type AthleteLegacyBannerProps = {
  profile: AthleteLegacyBannerProfile | null;
  primaryClubName?: string | null;
  /** Opens "CHANGE THE BANNER" for the large cover (not avatar) */
  onCoverCameraClick?: () => void;
  /** Opens profile photo upload (avatar badge camera) */
  onAvatarCameraClick?: () => void;
  t: (key: string) => string;
};

const DEFAULT_BANNER = '/images/banner.jpg';

/**
 * Use plain <img> (not next/image) so missing `/uploads/...` files fall back
 * instead of throwing ImageOptimizer errors under `next start`.
 */
function CoverImage({
  src,
  className,
  priority,
}: {
  src: string;
  className: string;
  priority?: boolean;
}) {
  const [current, setCurrent] = useState(src);

  useEffect(() => {
    setCurrent(src);
  }, [src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt=""
      className={`absolute inset-0 h-full w-full ${className}`}
      onError={() => {
        if (current !== DEFAULT_BANNER) setCurrent(DEFAULT_BANNER);
      }}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}

function SequenceCoverImages({
  sequencePaths,
  coverObjectClass,
}: {
  sequencePaths: string[];
  coverObjectClass: string;
}) {
  const [idx, setIdx] = useState(0);
  const resolved = sequencePaths.map((p) => resolvePublicImageUrl(p) || DEFAULT_BANNER);

  useEffect(() => {
    if (resolved.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % resolved.length), 5000);
    return () => clearInterval(id);
  }, [resolved.length]);

  return (
    <div className="absolute inset-0">
      {resolved.map((src, i) => (
        <div
          key={`${src.slice(0, 64)}-${i}`}
          className={`absolute inset-0 transition-opacity duration-[900ms] ${
            i === idx ? 'opacity-90 z-[1]' : 'opacity-0 z-0 pointer-events-none'
          }`}
        >
          <CoverImage src={src} className={coverObjectClass} priority={i === 0} />
        </div>
      ))}
    </div>
  );
}

export default function AthleteLegacyBanner({
  profile,
  primaryClubName,
  onCoverCameraClick,
  onAvatarCameraClick,
  t,
}: AthleteLegacyBannerProps) {
  const sequencePaths = parseBannerSequenceJson(profile?.profileBannerSequence);
  const useSequence = sequencePaths.length > 0;

  const videoSrc = profile?.profileBannerVideo?.trim()
    ? resolvePublicImageUrl(profile.profileBannerVideo)
    : null;

  const bannerSrc = profile?.profileBanner?.trim()
    ? resolvePublicImageUrl(profile.profileBanner) || DEFAULT_BANNER
    : DEFAULT_BANNER;

  const alignCenter = profile?.profileBannerAlignment === 'center';
  const coverObjectClass = alignCenter ? 'object-cover object-center' : 'object-cover object-top';

  const avatarSrc = resolvePublicImageUrl(profile?.image);
  const clubLabel = primaryClubName?.trim()
    ? `${primaryClubName.trim()} ${t('athlete_banner_club_badge')}`
    : t('athlete_banner_club_badge');

  return (
    <div className="flex w-full flex-col sm:flex-row shadow-lg overflow-hidden bg-black min-h-[220px] max-h-[280px]">
      {/* Main banner (legacy ns-left) */}
      <div className="relative flex-1 min-h-[200px] sm:min-h-[220px]">
        {videoSrc ? (
          <video
            key={videoSrc}
            src={videoSrc}
            className={`absolute inset-0 h-full w-full ${coverObjectClass} opacity-90`}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden
          />
        ) : useSequence ? (
          <SequenceCoverImages
            key={sequencePaths.map((p) => p.slice(0, 48)).join('|')}
            sequencePaths={sequencePaths}
            coverObjectClass={coverObjectClass}
          />
        ) : (
          <CoverImage
            key={bannerSrc.startsWith('data:') ? 'banner-data' : bannerSrc}
            src={bannerSrc}
            className={`${coverObjectClass} opacity-90`}
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent pointer-events-none" />

        {/* Cover camera — opens CHANGE THE BANNER modal (large banner only) */}
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

        {/* Avatar + club badge */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end gap-3 p-3 z-10">
          <div className="flex items-end gap-2 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 border-4 border-white shadow-lg overflow-hidden bg-gray-200">
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={avatarSrc.startsWith('data:') ? 'avatar-data' : avatarSrc}
                    src={avatarSrc}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-300 text-gray-600 text-sm font-medium">
                    {(profile?.name || profile?.firstName || '?').slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onAvatarCameraClick}
                disabled={!onAvatarCameraClick}
                className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded bg-black/70 text-white flex items-center justify-center text-[10px] hover:bg-black/85 focus:outline-none focus:ring-2 focus:ring-white/70 disabled:pointer-events-none disabled:opacity-50 z-10"
                title={t('athlete_banner_change_photo')}
                aria-label={t('athlete_banner_change_photo')}
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="mb-1 px-2 py-0.5 bg-blue-700 text-white text-xs font-semibold uppercase tracking-wide rounded shadow max-w-[12rem] truncate">
              {clubLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Sponsored column (legacy ns-right) */}
      <aside className="w-full sm:w-64 md:w-72 flex-shrink-0 bg-[#e8e8e8] border-t sm:border-t-0 sm:border-l border-gray-300 flex flex-col min-h-[140px] sm:min-h-0">
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
                <Image
                  src="/images/banner.jpg"
                  alt=""
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
    </div>
  );
}
