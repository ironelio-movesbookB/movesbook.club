'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MubStaffPageRouteClient from '@/app/users/(app)/mub_staff_page/MubStaffPageRouteClient';
import { MUB_ADMIN_PAGE_PATH } from '@/lib/mub/routes';

/**
 * Movesbook MUB settings in the admin panel: the Super Admin signs in to /admin with
 * his username + password and builds the MUB templates for every user type
 * (ID5 single users, ID6 coaches, ID7 teams, ID8 clubs, ID9 groups) — the templates
 * users bring into their own MUB with "Import Movesbook MUB".
 *
 * Access is enforced by the API (`/api/mub/verify-access` with `adminSession`):
 * only an active Super Admin gets the staff unlock.
 */
export default function AdminMubPage() {
  const router = useRouter();
  const [hasAdminSession, setHasAdminSession] = useState<boolean | null>(null);

  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem('adminToken');
    } catch {
      token = null;
    }
    if (!token) {
      router.replace('/admin/login');
      return;
    }
    setHasAdminSession(true);
  }, [router]);

  if (!hasAdminSession) {
    return <p className="px-4 py-6 text-sm text-gray-600">Loading…</p>;
  }

  return (
    <Suspense fallback={<div className="px-4 py-6 text-sm text-gray-600">Loading…</div>}>
      <MubStaffPageRouteClient adminSession basePath={MUB_ADMIN_PAGE_PATH} />
    </Suspense>
  );
}
