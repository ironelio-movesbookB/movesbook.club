'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { isClubAccountUserType } from '@/utils/dashboardRouting';
import ClubNotificationsPanel from '@/components/notifications/ClubNotificationsPanel';

function ClubNotificationInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clubId = searchParams?.get('clubId') || null;
  const viewParam = searchParams?.get('view') || searchParams?.get('audience');
  const view = viewParam === 'staff' ? 'staff' : viewParam === 'members' ? 'members' : 'all';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
      return;
    }
    if (!loading && user && !isClubAccountUserType(user.userType)) {
      router.push('/users/notification/all/all/movesbook');
    }
  }, [user, loading, router]);

  if (loading || !user || !isClubAccountUserType(user.userType)) return null;

  // Only scope to one club when ?clubId= is present (MY CLUB).
  // Bare /users/clubnotification = MY PAGE → all owned clubs.
  return <ClubNotificationsPanel clubId={clubId} view={view} />;
}

export default function ClubNotificationPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading…</div>}>
      <ClubNotificationInner />
    </Suspense>
  );
}
