import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import type { CoachWorkspace } from '@/lib/club/clubCoachService';
import { StaffAdminError, staffWorkspace } from '@/lib/club/clubStaffAdminService';
import { ClubMeetingError } from '@/lib/club/clubMeetingService';
import { WorkGroupError } from '@/lib/club/clubWorkGroupService';

export function staffAdminErrorResponse(error: unknown, label: string) {
  if (error instanceof StaffAdminError || error instanceof ClubMeetingError || error instanceof WorkGroupError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(label, error);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

/** Club or team admin of the selected workspace. */
export async function staffAdminAuth(
  request: NextRequest,
): Promise<{ ws: CoachWorkspace; userId: string } | { error: NextResponse }> {
  const auth = await getClubAuthContext(request);
  if ('error' in auth) return { error: auth.error };
  return { ws: staffWorkspace(auth.ctx), userId: auth.ctx.userId };
}
