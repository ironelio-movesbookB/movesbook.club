'use client';

import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';

type MovesbookGlobalNewsToggleButtonProps = {
  itemId: string;
  inGlobalNews: boolean;
  onToggled?: (inGlobalNews: boolean) => void;
  /** Compact matches OGP card actions; overlay sits on news card thumbnails. */
  variant?: 'compact' | 'overlay';
  className?: string;
};

/**
 * Club admin / superadmin — promote a News article into Movesbook Global News.
 */
export default function MovesbookGlobalNewsToggleButton({
  itemId,
  inGlobalNews,
  onToggled,
  variant = 'compact',
  className = '',
}: MovesbookGlobalNewsToggleButtonProps) {
  const [loading, setLoading] = useState(false);
  const [shared, setShared] = useState(inGlobalNews);

  useEffect(() => {
    setShared(inGlobalNews);
  }, [inGlobalNews]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
    if (!token) return;

    const next = !shared;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/clubs/movesbook-global-news/news/${encodeURIComponent(itemId)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inGlobalNews: next }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Failed to update Movesbook Global News');
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
            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            : 'border-gray-200 bg-white/95 text-gray-600 hover:bg-gray-100'
        }`
      : `inline-flex items-center justify-center rounded-md border px-2 py-1 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
          shared
            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
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
          ? 'Shared in Movesbook Global News (click to remove)'
          : 'Share in Movesbook Global News'
      }
      aria-label={
        shared
          ? 'Remove from Movesbook Global News'
          : 'Share in Movesbook Global News'
      }
    >
      <BookOpen className={variant === 'overlay' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
    </button>
  );
}
