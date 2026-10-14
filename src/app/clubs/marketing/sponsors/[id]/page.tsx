'use client';

import { useParams } from 'next/navigation';
import SponsorEditPage from '@/components/club/sponsors/SponsorEditPage';

export default function ClubSponsorEditPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? 'new';
  return <SponsorEditPage key={id} id={id} />;
}
