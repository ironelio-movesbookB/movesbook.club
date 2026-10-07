import { NextRequest, NextResponse } from 'next/server';
import { nextMemberNumber } from '@/lib/club/clubStaffAdminService';
import { staffAdminAuth, staffAdminErrorResponse } from '@/lib/club/clubStaffAdminApi';

export const dynamic = 'force-dynamic';

/** Next number of the progressive member counter of the club/team. */
export async function GET(request: NextRequest) {
  try {
    const auth = await staffAdminAuth(request);
    if ('error' in auth) return auth.error;
    return NextResponse.json({ next: await nextMemberNumber(auth.ws) });
  } catch (error) {
    return staffAdminErrorResponse(error, 'GET /api/club/staff/member-number:');
  }
}
