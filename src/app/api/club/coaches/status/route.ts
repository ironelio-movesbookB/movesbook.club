import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import { setClubCoachesStatus, workspaceFromContext } from '@/lib/club/clubCoachService';
import { coachErrorResponse, idsFromBody } from '@/lib/club/clubCoachApi';
import { CLUB_COACH_STATUSES, type ClubCoachStatus } from '@/lib/club/clubCoach.constants';

export const dynamic = 'force-dynamic';

/** Approve (pending → active), archive and restore coaches. */
export async function POST(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    const status = String(body.status ?? '');
    if (!(CLUB_COACH_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    const result = await setClubCoachesStatus(
      workspaceFromContext(auth.ctx),
      idsFromBody(body),
      status as ClubCoachStatus,
    );
    return NextResponse.json(result);
  } catch (error) {
    return coachErrorResponse(error, 'POST /api/club/coaches/status:');
  }
}
