'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import AutoTranslate from '@/components/i18n/AutoTranslate';
import ClubMeetingForm from '@/components/club/meetings/ClubMeetingForm';

function MeetingPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = String(params?.id ?? '');
  const mode = searchParams?.get('view') === '1' ? 'view' : 'edit';
  return (
    <AutoTranslate>
      <ClubMeetingForm key={`${id}-${mode}`} mode={mode} meetingId={id} />
    </AutoTranslate>
  );
}

export default function ClubMeetingPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-500">Loading…</p>}>
      <MeetingPage />
    </Suspense>
  );
}
