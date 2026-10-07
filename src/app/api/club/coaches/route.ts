import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import {
  createClubCoach,
  deleteClubCoaches,
  listClubCoaches,
  parseCoachInput,
  workspaceFromContext,
} from '@/lib/club/clubCoachService';
import { coachErrorResponse, idsFromBody } from '@/lib/club/clubCoachApi';
import { CLUB_COACH_STATUSES, type ClubCoachStatus } from '@/lib/club/clubCoach.constants';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;
    const ws = workspaceFromContext(auth.ctx);
    const raw = request.nextUrl.searchParams.get('status') ?? 'all';
    const status = (CLUB_COACH_STATUSES as readonly string[]).includes(raw) ? (raw as ClubCoachStatus) : 'all';
    const items = await listClubCoaches(ws, status);
    return NextResponse.json({ items });
  } catch (error) {
    return coachErrorResponse(error, 'GET /api/club/coaches:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;
    const ws = workspaceFromContext(auth.ctx);
    const body = await request.json().catch(() => ({}));
    const input = parseCoachInput(body);
    const userId = typeof body.userId === 'string' && body.userId ? body.userId : null;
    const coach = await createClubCoach(ws, input, { userId, source: userId ? 'duplicate' : 'manual' });
    return NextResponse.json({ coach }, { status: 201 });
  } catch (error) {
    return coachErrorResponse(error, 'POST /api/club/coaches:');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;
    const ws = workspaceFromContext(auth.ctx);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await deleteClubCoaches(ws, idsFromBody(body)));
  } catch (error) {
    return coachErrorResponse(error, 'DELETE /api/club/coaches:');
  }
}
