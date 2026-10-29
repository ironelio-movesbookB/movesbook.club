'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import MyMusicPanel from '@/components/music/MyMusicPanel';

export interface AdminOgMusicPanelContentProps {
  /** Target for the header close (X) link — default returns to admin home */
  closeHref?: string;
}

/**
 * Superadmin My Music UI (same as the athlete/user dashboard).
 * Embedded on /admin/dashboard when opened from Music → Music Tracked.
 * Fills the full central column at a fixed height so tab changes do not resize it.
 */
export default function AdminOgMusicPanelContent({
  closeHref = '/admin/dashboard',
}: AdminOgMusicPanelContentProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col p-2 md:p-3">
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-[#152038] shadow-md">
        <div className="flex flex-shrink-0 items-center justify-end border-b border-white/20 bg-[#1a2744] px-3 py-2">
          <Link
            href={closeHref}
            className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Link>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <MyMusicPanel embedded adminContext />
        </div>
      </div>
    </div>
  );
}
