'use client';

import AutoTranslate from '@/components/i18n/AutoTranslate';
import ClubMeetingForm from '@/components/club/meetings/ClubMeetingForm';

export default function NewClubMeetingPage() {
  return (
    <AutoTranslate>
      <ClubMeetingForm mode="create" />
    </AutoTranslate>
  );
}
