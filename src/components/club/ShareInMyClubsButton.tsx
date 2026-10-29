'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import ShareInMyClubsModal, { type ShareInMyClubsKind } from '@/components/club/ShareInMyClubsModal';
import { isClubAccountUserType } from '@/utils/dashboardRouting';

type ShareInMyClubsButtonProps = {
  kind: ShareInMyClubsKind;
  itemId: string;
  itemTitle?: string | null;
  adminUsername?: string;
  /** Compact icon button (OGP cards) vs inline icon (news tables). */
  variant?: 'compact' | 'inline';
  className?: string;
  sharedClubIds?: string[];
  onSharedChange?: (clubIds: string[]) => void;
};

export default function ShareInMyClubsButton({
  kind,
  itemId,
  itemTitle,
  adminUsername,
  variant = 'compact',
  className = '',
  sharedClubIds: sharedClubIdsProp,
  onSharedChange,
}: ShareInMyClubsButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [sharedClubIds, setSharedClubIds] = useState<string[]>(sharedClubIdsProp ?? []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sharedClubIdsProp !== undefined) setSharedClubIds(sharedClubIdsProp);
  }, [sharedClubIdsProp]);

  const fetchStatus = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/clubs/shared-news/status?kind=${kind}&ids=${encodeURIComponent(itemId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { sharedByItem?: Record<string, string[]> };
      const ids = data.sharedByItem?.[itemId] ?? [];
      setSharedClubIds(ids);
      onSharedChange?.(ids);
    } finally {
      setLoading(false);
    }
  }, [kind, itemId, onSharedChange]);

  useEffect(() => {
    if (sharedClubIdsProp === undefined) {
      void fetchStatus();
    }
  }, [fetchStatus, sharedClubIdsProp]);

  const isShared = sharedClubIds.length > 0;

  const handleShared = (clubId: string) => {
    setSharedClubIds((prev) => {
      const next = prev.includes(clubId) ? prev : [...prev, clubId];
      onSharedChange?.(next);
      return next;
    });
  };

  const handleUnshared = (clubId: string) => {
    setSharedClubIds((prev) => {
      const next = prev.filter((id) => id !== clubId);
      onSharedChange?.(next);
      return next;
    });
  };

  const baseClass =
    variant === 'compact'
      ? `inline-flex items-center justify-center rounded-md border px-2 py-1 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
          isShared
            ? 'border-teal-500 bg-teal-50 text-teal-700 hover:bg-teal-100'
            : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
        }`
      : `transition-colors disabled:opacity-50 ${
          isShared ? 'text-teal-700 hover:text-teal-900' : 'text-gray-500 hover:text-teal-700'
        }`;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setModalOpen(true);
        }}
        disabled={loading}
        className={`${baseClass} ${className}`}
        title={
          isShared
            ? 'Shared in My Clubs (click to manage)'
            : 'Share in My Clubs'
        }
        aria-label={
          isShared ? 'Shared in My Clubs (click to manage)' : 'Share in My Clubs'
        }
      >
        <Building2 className={variant === 'compact' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      </button>
      <ShareInMyClubsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        kind={kind}
        itemId={itemId}
        itemTitle={itemTitle}
        adminUsername={adminUsername}
        sharedClubIds={sharedClubIds}
        onShared={handleShared}
        onUnshared={handleUnshared}
      />
    </>
  );
}

export function ShareInMyClubsButtonIfClub(props: ShareInMyClubsButtonProps & {
  userType?: string | null;
}) {
  const { userType, ...rest } = props;
  if (!userType || !isClubAccountUserType(userType)) return null;
  return <ShareInMyClubsButton {...rest} />;
}
