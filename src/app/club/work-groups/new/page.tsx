'use client';

import AutoTranslate from '@/components/i18n/AutoTranslate';
import ClubWorkGroupEditor from '@/components/club/workGroups/ClubWorkGroupEditor';

export default function CreateClubWorkGroupPage() {
  return (
    <AutoTranslate>
      <ClubWorkGroupEditor mode="create" />
    </AutoTranslate>
  );
}
