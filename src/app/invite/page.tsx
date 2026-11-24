'use client';

import { Suspense } from 'react';
import PublicInvitePage from '@/components/promocodes/PublicInvitePage';

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 px-4 py-16 text-center text-slate-600">Loading invite…</div>}>
      <PublicInvitePage />
    </Suspense>
  );
}
