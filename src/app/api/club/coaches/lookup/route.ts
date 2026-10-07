import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import { searchWorkspaceProfiles, workspaceFromContext } from '@/lib/club/clubCoachService';
import { coachErrorResponse } from '@/lib/club/clubCoachApi';

export const dynamic = 'force-dynamic';

/** "Duplicate an existing profile": members, staff and admin of the current club/team. */
export async function GET(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;
    const q = request.nextUrl.searchParams.get('q') ?? '';
    const items = await searchWorkspaceProfiles(workspaceFromContext(auth.ctx), q);
    return NextResponse.json({ items });
  } catch (error) {
    return coachErrorResponse(error, 'GET /api/club/coaches/lookup:');
  }
}
