'use client';

import { useParams } from 'next/navigation';
import SubscriptionPackageForm from '@/components/club/settings/subscriptionPackages/SubscriptionPackageForm';

export default function SubscriptionPackagePage() {
  const params = useParams<{ id: string }>();
  return <SubscriptionPackageForm listpriceId={String(params?.id ?? '')} />;
}
