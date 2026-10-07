'use client';

import AutoTranslate from '@/components/i18n/AutoTranslate';
import ClubWorkGroupEditor from '@/components/club/workGroups/ClubWorkGroupEditor';

export default function EditClubWorkGroupPage({ params }: { params: { id: string } }) {
  return (
    <AutoTranslate>
      <ClubWorkGroupEditor mode="edit" groupId={params.id} />
    </AutoTranslate>
  );
}
