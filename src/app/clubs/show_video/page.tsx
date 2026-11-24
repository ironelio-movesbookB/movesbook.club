'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { moodMusicEmbedUrl } from '@/lib/music/moodMusicEmbed';

function ShowVideoContent() {
  const searchParams = useSearchParams();
  const link = searchParams.get('link') ?? '';

  const embedSrc = useMemo(() => moodMusicEmbedUrl(link), [link]);

  if (!embedSrc) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#1F2C4C] text-white">
        <p className="text-sm">Missing video link.</p>
        <Link href="/athlete/dashboard" className="text-sm underline opacity-90 hover:opacity-100">
          Back to dashboard
        </Link>
      </div>
    );
  }

  // Legacy PHP: full-width middle column, sidebars hidden, iframe height 550.
  return (
    <div className="flex min-h-screen flex-col bg-[#1F2C4C]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <Link
          href="/athlete/dashboard"
          className="text-sm text-white/90 underline-offset-2 hover:underline"
        >
          ← Back
        </Link>
        <span className="font-[Arial,Helvetica,sans-serif] text-xs text-white/60">
          /clubs/show_video
        </span>
      </div>
      <iframe
        title="Mood Music player"
        width="100%"
        height="550"
        src={embedSrc}
        className="min-h-[550px] w-full flex-1 border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}

/** Legacy PHP clubs/show_video — YouTube playlist/video embed for Mood Music. */
export default function ShowVideoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#1F2C4C] text-white">
          Loading…
        </div>
      }
    >
      <ShowVideoContent />
    </Suspense>
  );
}
