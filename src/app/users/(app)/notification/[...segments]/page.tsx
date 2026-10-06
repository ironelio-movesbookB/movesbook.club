'use client';

import { Suspense, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isClubAccountUserType } from '@/utils/dashboardRouting';
import NotificationsInboxPanel from '@/components/notifications/NotificationsInboxPanel';

/**
 * Recipient inbox (PHP: /users/notification/all/all/movesbook|clubs).
 * ?clubId= scopes the clubs tab to one club (MY CLUB).
 * Club Admins manage club notifications at /users/clubnotification instead of this inbox.
 */
function UserNotificationInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const segments = (params?.segments as string[] | undefined) ?? [];
  const last = segments[segments.length - 1] || 'movesbook';
  const source = last === 'clubs' ? 'clubs' : 'movesbook';
  const clubId = searchParams?.get('clubId') || null;
  const isClubAdmin = user ? isClubAccountUserType(user.userType) : false;

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user || source !== 'clubs' || !isClubAdmin) return;
    const qs = new URLSearchParams({ view: 'all' });
    if (clubId) qs.set('clubId', clubId);
    router.replace(`/users/clubnotification?${qs}`);
  }, [loading, user, source, isClubAdmin, clubId, router]);

  if (loading || !user) return null;
  if (source === 'clubs' && isClubAdmin) return null;

  return <NotificationsInboxPanel source={source} clubId={source === 'clubs' ? clubId : null} />;
}

export default function UserNotificationPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading…</div>}>
      <UserNotificationInner />
    </Suspense>
  );
}
