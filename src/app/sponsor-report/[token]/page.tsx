'use client';

import { useParams } from 'next/navigation';
import SponsorReportPage from '@/components/club/sponsors/public/SponsorReportPage';

export default function PublicSponsorReportPage() {
  const params = useParams<{ token: string }>();
  return params?.token ? <SponsorReportPage token={params.token} /> : null;
}
