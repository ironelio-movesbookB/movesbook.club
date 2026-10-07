'use client';

import AutoTranslate from '@/components/i18n/AutoTranslate';
import ClubMeetingsList from '@/components/club/meetings/ClubMeetingsList';

export default function ClubMeetingsPage() {
  return (
    <AutoTranslate>
      <ClubMeetingsList />
    </AutoTranslate>
  );
}
