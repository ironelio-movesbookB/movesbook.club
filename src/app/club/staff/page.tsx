'use client';

import { Suspense } from 'react';
import AutoTranslate from '@/components/i18n/AutoTranslate';
import ClubStaffList from '@/components/club/staff/ClubStaffList';

export default function ClubStaffPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-500">Loading staff list…</p>}>
      <AutoTranslate>
        <ClubStaffList />
      </AutoTranslate>
    </Suspense>
  );
}
