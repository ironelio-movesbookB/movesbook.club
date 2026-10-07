'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AutoTranslate from '@/components/i18n/AutoTranslate';
import ClubStaffProfileForm from '@/components/club/staff/ClubStaffProfileForm';

function AddClubStaffContent() {
  const searchParams = useSearchParams();
  return <ClubStaffProfileForm mode="create" defaultStaffType={searchParams.get('type') ?? ''} />;
}

export default function AddClubStaffPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-500">Loading…</p>}>
      <AutoTranslate>
        <AddClubStaffContent />
      </AutoTranslate>
    </Suspense>
  );
}
