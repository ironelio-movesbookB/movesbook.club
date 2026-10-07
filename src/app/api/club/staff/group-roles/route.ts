import { NextRequest, NextResponse } from 'next/server';
import { listStaffGroupLinks } from '@/lib/club/clubStaffAdminService';
import { staffAdminAuth, staffAdminErrorResponse } from '@/lib/club/clubStaffAdminApi';

export const dynamic = 'force-dynamic';

/** Groups & roles grid: every group assigned to a component of the staff. */
export async function GET(request: NextRequest) {
  try {
    const auth = await staffAdminAuth(request);
    if ('error' in auth) return auth.error;
    return NextResponse.json({ items: await listStaffGroupLinks(auth.ws) });
  } catch (error) {
    return staffAdminErrorResponse(error, 'GET /api/club/staff/group-roles:');
  }
}
