'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { canAccessClubWorkspace } from '@/utils/dashboardRouting';
import MemberOverviewPanel from '@/components/club/memberOverview/MemberOverviewPanel';

function MemberOverviewInner() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/');
      return;
    }
    if (!canAccessClubWorkspace(user.userType)) {
      router.push('/club/dashboard');
    }
  }, [user, loading, router]);

  if (loading || !user || !canAccessClubWorkspace(user.userType)) {
    return <div className="p-4 text-sm text-gray-500">Loading…</div>;
  }

  return <MemberOverviewPanel />;
}

export default function MemberOverviewPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading…</div>}>
      <MemberOverviewInner />
    </Suspense>
  );
}
