import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import { ClubCoachError, workspaceFromContext, type CoachWorkspace } from '@/lib/club/clubCoachService';
import { WorkGroupError } from '@/lib/club/clubWorkGroupService';

export function workGroupErrorResponse(error: unknown, label: string) {
  if (error instanceof WorkGroupError || error instanceof ClubCoachError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(label, error);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

/** Club or team admin of the selected workspace. */
export async function workGroupAuth(
  request: NextRequest,
): Promise<{ ws: CoachWorkspace; userId: string } | { error: NextResponse }> {
  const auth = await getClubAuthContext(request);
  if ('error' in auth) return { error: auth.error };
  return { ws: workspaceFromContext(auth.ctx), userId: auth.ctx.userId };
}
