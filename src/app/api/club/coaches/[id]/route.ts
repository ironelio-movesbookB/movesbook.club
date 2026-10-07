import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import {
  deleteClubCoaches,
  getClubCoach,
  parseCoachInput,
  updateClubCoach,
  workspaceFromContext,
} from '@/lib/club/clubCoachService';
import { coachErrorResponse } from '@/lib/club/clubCoachApi';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;
    const coach = await getClubCoach(workspaceFromContext(auth.ctx), params.id);
    return NextResponse.json({ coach });
  } catch (error) {
    return coachErrorResponse(error, 'GET /api/club/coaches/[id]:');
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    const coach = await updateClubCoach(workspaceFromContext(auth.ctx), params.id, parseCoachInput(body));
    return NextResponse.json({ coach });
  } catch (error) {
    return coachErrorResponse(error, 'PATCH /api/club/coaches/[id]:');
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;
    return NextResponse.json(await deleteClubCoaches(workspaceFromContext(auth.ctx), [params.id]));
  } catch (error) {
    return coachErrorResponse(error, 'DELETE /api/club/coaches/[id]:');
  }
}
