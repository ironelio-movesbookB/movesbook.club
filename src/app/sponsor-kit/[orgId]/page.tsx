'use client';

import { useParams } from 'next/navigation';
import SponsorKitPage from '@/components/club/sponsors/public/SponsorKitPage';

export default function PublicSponsorKitPage() {
  const params = useParams<{ orgId: string }>();
  return params?.orgId ? <SponsorKitPage orgId={params.orgId} /> : null;
}
