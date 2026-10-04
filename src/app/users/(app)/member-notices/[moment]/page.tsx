'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import MemberLoginLogoutNoticesPanel, {
  type MemberNoticeMoment,
} from '@/components/club/memberProfile/MemberLoginLogoutNoticesPanel';
import AutoTranslate from '@/components/i18n/AutoTranslate';

function MemberNoticesInner() {
  const params = useParams() ?? {};
  const raw = String((params as { moment?: string | string[] }).moment || 'login');
  const moment: MemberNoticeMoment = raw === 'logout' ? 'logout' : 'login';
  return (
    <AutoTranslate>
      <MemberLoginLogoutNoticesPanel moment={moment} />
    </AutoTranslate>
  );
}

export default function MemberNoticesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading…</div>}>
      <MemberNoticesInner />
    </Suspense>
  );
}
