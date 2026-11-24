'use client';

import { useParams } from 'next/navigation';
import ClubEventsPublicPage from '@/components/club/events/public/ClubEventsPublicPage';

export default function PublicClubEventsRoute() {
  const params = useParams<{ orgId: string }>();
  return params?.orgId ? <ClubEventsPublicPage orgId={params.orgId} /> : null;
}
