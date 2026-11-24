'use client';

import { useSearchParams } from 'next/navigation';
import type { MubCategory, MubRoleTemplate } from '@/lib/mub/types';
import { mubCategoryFromPath } from '@/lib/mub/routes';
import MubPageClient from '@/components/mub/MubPageClient';

export default function MubStaffPageRouteClient() {
  const searchParams = useSearchParams();
  const role = (searchParams?.get('role') ?? 'SINGLE_USER').toUpperCase() as MubRoleTemplate;
  const category =
    mubCategoryFromPath(searchParams?.get('category')) ?? ('CLUB_MANAGEMENT' as MubCategory);

  return (
    <div className="px-4 py-6">
      <MubPageClient mode="staff" staffRoleTemplate={role} initialCategory={category} />
    </div>
  );
}
