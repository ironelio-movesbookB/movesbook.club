'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import OrgNotificationsPanel from '@/components/notifications/OrgNotificationsPanel';
import type { OrgEntityKind } from '@/lib/notifications/notificationService';

function Inner({ kind, allow }: { kind: OrgEntityKind; allow: (userType: string) => boolean }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityId = searchParams?.get('entityId') || null;

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
      return;
    }
    if (!loading && user && !allow(user.userType)) {
      router.push('/users/notification/all/all/movesbook');
    }
  }, [user, loading, router, allow]);

  if (loading || !user || !allow(user.userType)) return null;
  return <OrgNotificationsPanel kind={kind} entityId={entityId} />;
}

export function OrgNotificationPageShell({
  kind,
  allow,
}: {
  kind: OrgEntityKind;
  allow: (userType: string) => boolean;
}) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading…</div>}>
      <Inner kind={kind} allow={allow} />
    </Suspense>
  );
}
