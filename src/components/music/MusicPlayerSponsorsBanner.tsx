'use client';

import { useEffect, useRef, useState } from 'react';
import { Music2 } from 'lucide-react';

const ROTATE_MS = 5000;

type BannerTrack = {
  id: string;
  title: string | null;
  artist?: string | null;
  image: string | null;
  url: string;
  siteName: string | null;
  description: string | null;
  creatorUsername: string | null;
};

type MusicPlayerPlaylistBannerProps = {
  tracks: BannerTrack[];
  currentIndex: number;
  onSelectTrack: (index: number) => void;
};

/**
 * Header banner: rotates through every track in the current playlist
 * (same items as My Playlist below). Click plays that track.
 */
export default function MusicPlayerSponsorsBanner({
  tracks,
  currentIndex,
  onSelectTrack,
}: MusicPlayerPlaylistBannerProps) {
  const [index, setIndex] = useState(currentIndex);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Keep banner in sync when the playing track changes from the playlist / controls.
  useEffect(() => {
    setIndex(currentIndex);
  }, [currentIndex]);

  useEffect(() => {
    if (tracks.length === 0) {
      setIndex(0);
      return;
    }
    setIndex((i) => Math.min(i, tracks.length - 1));
  }, [tracks.length]);

  useEffect(() => {
    if (tracks.length < 2) return;
    const timer = window.setInterval(() => {
      if (pausedRef.current) return;
      setIndex((i) => (i >= tracks.length - 1 ? 0 : i + 1));
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [tracks.length]);

  if (tracks.length === 0) {
    return (
      <div className="mx-2 flex-1 flex items-center justify-center min-h-[100px] sm:min-h-[120px] rounded-sm border border-sky-300/40 bg-sky-200/90 px-3 py-4 text-center text-sm font-medium text-sky-950">
        Advertising here
      </div>
    );
  }

  const safeIndex = Math.min(Math.max(0, index), tracks.length - 1);
  const track = tracks[safeIndex];
  const title = track.title || track.url || 'Track';
  const subtitle =
    track.artist || track.siteName || track.creatorUsername || track.description || '';

  return (
    <div
      className="mx-2 flex-1 min-h-[100px] sm:min-h-[120px] rounded-sm border border-sky-300/40 bg-sky-200/90 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <button
        type="button"
        className="relative flex h-full w-full min-h-[100px] sm:min-h-[120px] items-stretch gap-3 px-2 py-1.5 text-left"
        onClick={() => onSelectTrack(safeIndex)}
        title={`Play: ${title}`}
        aria-label={`Play ${title}`}
      >
        <span className="relative h-full aspect-square shrink-0 overflow-hidden rounded-sm bg-sky-100/80 self-stretch min-h-[88px]">
          {track.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center bg-sky-100">
              <Music2 className="h-8 w-8 text-sky-700/40" aria-hidden />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1 flex flex-col justify-center py-1">
          <span className="text-[10px] uppercase tracking-wide text-sky-800/70">
            {safeIndex + 1} / {tracks.length}
            {safeIndex === currentIndex ? ' · Playing' : ''}
          </span>
          <span className="truncate text-sm font-semibold text-sky-950">{title}</span>
          {subtitle ? (
            <span className="truncate text-xs text-sky-900/70">{subtitle}</span>
          ) : null}
        </span>
      </button>
    </div>
  );
}
