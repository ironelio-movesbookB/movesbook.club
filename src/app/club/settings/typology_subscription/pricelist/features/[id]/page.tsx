'use client';

import { useParams } from 'next/navigation';
import PackageFeaturesForm from '@/components/club/settings/subscriptionPackages/PackageFeaturesForm';

export default function PackageFeaturesPage() {
  const params = useParams<{ id: string }>();
  return <PackageFeaturesForm listpriceId={String(params?.id ?? '')} />;
}
