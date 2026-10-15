'use client';

import { useParams } from 'next/navigation';
import PublicSitePage from '@/components/club/website/PublicSitePage';

export default function ClubPublicSitePage() {
  const params = useParams<{ slug: string }>();
  return params?.slug ? <PublicSitePage slug={params.slug} /> : null;
}
