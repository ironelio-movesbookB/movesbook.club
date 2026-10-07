'use client';

import AutoTranslate from '@/components/i18n/AutoTranslate';
import ClubStaffProfileForm from '@/components/club/staff/ClubStaffProfileForm';

export default function EditClubStaffPage({ params }: { params: { id: string } }) {
  return (
    <AutoTranslate>
      <ClubStaffProfileForm mode="edit" staffId={params.id} />
    </AutoTranslate>
  );
}
