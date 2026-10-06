'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import ClubStaffMessagesPanel from '@/components/messages/ClubStaffMessagesPanel';

/**
 * Messages among Staff and members: private conversations between a sender and one recipient
 * (club admin/staff ↔ members, or members → club staff). Replies are allowed.
 */
function ClubMessagesInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clubId = searchParams?.get('clubId') || null;

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  }

  return (
    <div className="w-full">
      <div className="px-4 pt-4 md:px-6">
        <h1 className="text-xl font-bold text-orange-600">Messages among Staff and members</h1>
        <p className="text-sm text-gray-600 mt-1 mb-2">
          Choose a club, the type of recipient and the recipient, then post your message. Messages are
          visible only to the sender and the recipient.
        </p>
      </div>
      <ClubStaffMessagesPanel initialClubId={clubId} />
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
