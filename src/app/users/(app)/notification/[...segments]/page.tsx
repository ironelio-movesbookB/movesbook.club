'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import NotificationsInboxPanel from '@/components/notifications/NotificationsInboxPanel';

/**
 * Recipient inbox (PHP: /users/notification/all/all/movesbook|clubs).
 * Club Admin send UI lives at /users/clubnotification (separate route).
 * Club admins also see this inbox (Clear section) when opening Club Staff tab.
 */
export default function UserNotificationPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();

  const segments = (params?.segments as string[] | undefined) ?? [];
  const last = segments[segments.length - 1] || 'movesbook';

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  if (loading || !user) return null;

  const source = last === 'clubs' ? 'clubs' : 'movesbook';
  return <NotificationsInboxPanel source={source} />;
}
