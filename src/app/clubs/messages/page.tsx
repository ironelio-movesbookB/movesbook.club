'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isClubAccountUserType } from '@/utils/dashboardRouting';
import ClubStaffMessagesPanel from '@/components/messages/ClubStaffMessagesPanel';

/**
 * Post messages for the Club Staff (members ↔ club admin/staff, replies allowed).
 * Club Admin: ?view=received → "Messages received by the members".
 */
function ClubMessagesInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const received = searchParams?.get('view') === 'received';
  const clubId = searchParams?.get('clubId') || null;
  const isClubAdmin = user ? isClubAccountUserType(user.userType) : false;
  const receivedView = received || isClubAdmin;

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  }

  const heading = receivedView
    ? 'Messages received by the members'
    : 'Post messages for the Club Staff';

  return (
    <div className="w-full">
      <div className="px-4 pt-4 md:px-6">
        <h1 className="text-xl font-bold text-gray-900">{heading}</h1>
        <p className="text-sm text-gray-600 mt-1 mb-2">
          {receivedView
            ? 'Messages from members. Open a thread to reply. Member name and picture appear on each post.'
            : 'Post a message for club staff. Replies are allowed (unlike broadcast club notifications).'}
        </p>
      </div>
      <ClubStaffMessagesPanel receivedView={receivedView} initialClubId={clubId} />
    </div>
  );
}

export default function ClubMessagesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading…</div>}>
      <ClubMessagesInner />
    </Suspense>
  );
}
