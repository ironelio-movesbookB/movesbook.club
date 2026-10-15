'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import OrgFeedbacksPanel from '@/components/messages/OrgFeedbacksPanel';

function ClubFeedbacksInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const scope = searchParams?.get('scope') === 'manage' ? 'manage' : 'mine';

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  }

  return (
    <div className="flex w-full min-h-[60vh] p-4 md:p-6">
      <OrgFeedbacksPanel key={scope} scope={scope} />
    </div>
  );
}

export default function ClubFeedbacksPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading…</div>}>
      <ClubFeedbacksInner />
    </Suspense>
  );
}
