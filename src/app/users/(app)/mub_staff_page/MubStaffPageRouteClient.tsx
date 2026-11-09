'use client';

import { useSearchParams } from 'next/navigation';
import type { MubCategory, MubRoleTemplate } from '@/lib/mub/types';
import { mubCategoryFromPath } from '@/lib/mub/routes';
import { MUB_STAFF_ROLE_TEMPLATES } from '@/lib/mub/constants';
import MubPageClient from '@/components/mub/MubPageClient';

type MubStaffPageRouteClientProps = {
  /** Admin panel: Super Admin signed in with username + password (see /admin/mub). */
  adminSession?: boolean;
  basePath?: string;
};

export default function MubStaffPageRouteClient({
  adminSession = false,
  basePath,
}: MubStaffPageRouteClientProps = {}) {
  const searchParams = useSearchParams();
  // Unknown `role` values fall back to Single Users instead of surfacing an API 400.
  const rawRole = (searchParams?.get('role') ?? '').toUpperCase();
  const role: MubRoleTemplate =
    MUB_STAFF_ROLE_TEMPLATES.find((r) => r.id === rawRole)?.id ?? 'SINGLE_USER';
  const category =
    mubCategoryFromPath(searchParams?.get('category')) ?? ('CLUB_MANAGEMENT' as MubCategory);

  return (
    <div className="px-2 py-4">
      <MubPageClient
        mode="staff"
        staffRoleTemplate={role}
        initialCategory={category}
        adminSession={adminSession}
        staffBasePath={basePath}
      />
    </div>
  );
}
