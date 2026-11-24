'use client';

import { useParams } from 'next/navigation';
import ClubEventSubscribePage from '@/components/club/events/public/ClubEventSubscribePage';

export default function PublicClubEventSubscribeRoute() {
  const params = useParams<{ orgId: string; token: string }>();
  return params?.orgId && params?.token ? (
    <ClubEventSubscribePage orgId={params.orgId} token={params.token} />
  ) : null;
}
