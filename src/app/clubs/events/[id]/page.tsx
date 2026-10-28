'use client';

import { useParams } from 'next/navigation';
import EventEditPage from '@/components/club/events/EventEditPage';

export default function ClubEventEditRoute() {
  const params = useParams<{ id: string }>();
  return params?.id ? <EventEditPage eventId={params.id} /> : null;
}
