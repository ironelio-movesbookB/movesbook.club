'use client';

import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';

type ClubGlobalNewsToggleButtonProps = {
  kind: 'news' | 'ogp' | 'ogp-group';
  itemId: string;
  clubId: string;
  inClubGlobalNews: boolean;
  onToggled?: (inClubGlobalNews: boolean) => void;
  /**
   * When enabling Global share but the item is not yet shared to this club (404),
   * call this so the parent can open the Share in My Clubs modal instead.
   */
  onNotShared?: () => void;
  /** Compact matches OGP card actions; overlay sits on news card thumbnails. */
  variant?: 'compact' | 'overlay';
  className?: string;
};

/**
 * Club admin globe toggle — promotes a club-shared News/OGP item into Club Global News.
 * Mirrors the superadmin "Share in Global News" globe.
 */
export default function ClubGlobalNewsToggleButton({
  kind,
  itemId,
  clubId,
  inClubGlobalNews,
  onToggled,
  onNotShared,
  variant = 'compact',
  className = '',
}: ClubGlobalNewsToggleButtonProps) {
  const [loading, setLoading] = useState(false);
  const [shared, setShared] = useState(inClubGlobalNews);

  useEffect(() => {
    setShared(inClubGlobalNews);
  }, [inClubGlobalNews]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const token = localStorage.getItem('token');
    if (!token || !clubId) return;

    const next = !shared;
    setLoading(true);
    try {
      const path =
        kind === 'ogp-group'
          ? `/api/clubs/shared-news/ogp-group/${encodeURIComponent(itemId)}`
          : kind === 'ogp'
            ? `/api/clubs/shared-news/ogp/${encodeURIComponent(itemId)}`
            : `/api/clubs/shared-news/news/${encodeURIComponent(itemId)}`;
      const res = await fetch(path, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clubId, inClubGlobalNews: next }),
      });
      if (!res.ok) {
        if (res.status === 404 && next && onNotShared) {
          onNotShared();
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Failed to update Club Global News');
      }
      setShared(next);
      onToggled?.(next);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const baseClass =
    variant === 'overlay'
      ? `inline-flex items-center justify-center rounded-md border p-1.5 shadow-sm transition-colors disabled:opacity-50 ${
          shared
            ? 'border-teal-500 bg-teal-50 text-teal-700 hover:bg-teal-100'
            : 'border-gray-200 bg-white/95 text-gray-600 hover:bg-gray-100'
        }`
      : `inline-flex items-center justify-center rounded-md border px-2 py-1 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
          shared
            ? 'border-teal-500 bg-teal-50 text-teal-700 hover:bg-teal-100'
            : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
        }`;

  return (
    <button
      type="button"
      onClick={(e) => void handleToggle(e)}
      disabled={loading}
      className={`${baseClass} ${className}`}
      title={
        shared
          ? 'Shared in Club Global News (click to remove)'
          : 'Share in Club Global News'
      }
      aria-label={
        shared ? 'Remove from Club Global News' : 'Share in Club Global News'
      }
    >
      <Globe className={variant === 'overlay' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
    </button>
  );
}
