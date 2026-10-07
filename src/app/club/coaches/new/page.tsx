'use client';

import AutoTranslate from '@/components/i18n/AutoTranslate';
import ClubCoachForm from '@/components/club/coaches/ClubCoachForm';

export default function CreateClubCoachPage() {
  return (
    <AutoTranslate>
      <ClubCoachForm mode="create" />
    </AutoTranslate>
  );
}
