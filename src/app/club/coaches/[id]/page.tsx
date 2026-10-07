'use client';

import AutoTranslate from '@/components/i18n/AutoTranslate';
import ClubCoachForm from '@/components/club/coaches/ClubCoachForm';

export default function EditClubCoachPage({ params }: { params: { id: string } }) {
  return (
    <AutoTranslate>
      <ClubCoachForm mode="edit" coachId={params.id} />
    </AutoTranslate>
  );
}
