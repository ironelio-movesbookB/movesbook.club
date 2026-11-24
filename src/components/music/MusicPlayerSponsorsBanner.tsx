'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  activeSponsorGroups,
  openSponsorLink,
  SPONSOR_DELAY_MS_DEFAULT,
  type OgpSponsor,
  type OgpSponsorSettings,
} from '@/lib/news/ogpSponsors';

/**
 * Music player header ad: flattens every sponsor from all active OGP News
 * sponsor groups and rotates at the fastest (minimum) delayMs among those groups.
 */
export default function MusicPlayerSponsorsBanner() {
  const [sponsors, setSponsors] = useState<OgpSponsor[]>([]);
  const [delayMs, setDelayMs] = useState(SPONSOR_DELAY_MS_DEFAULT);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/news/ogp-sponsors');
        if (!res.ok) return;
        const data = (await res.json()) as OgpSponsorSettings;
        if (cancelled || !data || !Array.isArray(data.groups)) return;

        const groups = activeSponsorGroups(data);
        const flat = groups
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .flatMap((g) =>
            g.sponsors.slice().sort((a, b) => a.sortOrder - b.sortOrder),
          );
        const fastest =
          groups.length > 0
            ? Math.min(...groups.map((g) => g.delayMs))
            : SPONSOR_DELAY_MS_DEFAULT;

        setSponsors(flat);
        setDelayMs(fastest);
        setIndex(0);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setIndex((i) => (sponsors.length === 0 ? 0 : Math.min(i, sponsors.length - 1)));
  }, [sponsors.length]);

  useEffect(() => {
    if (sponsors.length < 2) return;
    const timer = window.setInterval(() => {
      if (pausedRef.current) return;
      setIndex((i) => (i >= sponsors.length - 1 ? 0 : i + 1));
    }, Math.max(1000, delayMs));
    return () => window.clearInterval(timer);
  }, [sponsors.length, delayMs]);

  const current = sponsors[index] ?? sponsors[0];
  const handleOpen = useCallback(() => {
    if (!current?.linkUrl) return;
    openSponsorLink(current.linkUrl, current.linkTarget);
  }, [current]);

  if (!current) {
    return (
      <div className="mx-2 flex-1 flex items-center justify-center min-h-[100px] sm:min-h-[120px] rounded-sm border border-sky-300/40 bg-sky-200/90 px-3 py-4 text-center text-sm font-medium text-sky-950">
        Advertising here
      </div>
    );
  }

  const title = current.hoverTitle || 'Sponsored';

  return (
    <div
      className="mx-2 flex-1 min-h-[100px] sm:min-h-[120px] rounded-sm border border-sky-300/40 bg-sky-200/90 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <button
        type="button"
        className="relative block h-full w-full min-h-[100px] sm:min-h-[120px]"
        onClick={handleOpen}
        title={title}
        aria-label={title}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.image}
          alt={title}
          className="absolute inset-0 h-full w-full object-contain bg-sky-100/80"
        />
      </button>
    </div>
  );
}
