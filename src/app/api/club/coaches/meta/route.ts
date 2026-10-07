import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import { listWorkspaceGroups, workspaceFromContext } from '@/lib/club/clubCoachService';
import { coachErrorResponse } from '@/lib/club/clubCoachApi';
import { CLUB_COACH_ROLES } from '@/lib/club/clubCoach.constants';

export const dynamic = 'force-dynamic';

/** Workspace info for the coach screens: groups, roles and the invite `society` id. */
export async function GET(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;
    const ws = workspaceFromContext(auth.ctx);
    const groups = await listWorkspaceGroups(ws);
    return NextResponse.json({
      workspace: { kind: ws.kind, id: ws.id, name: ws.name },
      groups,
      roles: CLUB_COACH_ROLES,
    });
  } catch (error) {
    return coachErrorResponse(error, 'GET /api/club/coaches/meta:');
  }
}
