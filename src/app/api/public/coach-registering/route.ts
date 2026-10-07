import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createClubCoach, parseCoachInput, resolveSociety } from '@/lib/club/clubCoachService';
import { coachErrorResponse } from '@/lib/club/clubCoachApi';

export const dynamic = 'force-dynamic';

/** Invite link `/coachregistering?society=` — which club or team is inviting. */
export async function GET(request: NextRequest) {
  const society = await resolveSociety(request.nextUrl.searchParams.get('society') ?? '');
  if (!society) return NextResponse.json({ error: 'This invitation link is not valid' }, { status: 404 });
  return NextResponse.json({ society: { kind: society.kind, name: society.name } });
}

/** A COACH account asks to join the inviting club/team; the request waits in "Pending registrations". */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = token ? verifyToken(token) : null;
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Log in or create your coach account first' }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { id: String(decoded.userId) },
      select: { id: true, userType: true },
    });
    if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 401 });
    if (user.userType !== 'COACH') {
      return NextResponse.json(
        { error: 'Only coach accounts can register with this link. Log out and register as a coach.' },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const society = await resolveSociety(typeof body.society === 'string' ? body.society : '');
    if (!society) return NextResponse.json({ error: 'This invitation link is not valid' }, { status: 404 });

    const input = parseCoachInput({ ...body, role: '', groupId: '' });
    await createClubCoach(society, input, { status: 'pending', source: 'invite', userId: user.id });
    return NextResponse.json({ ok: true, society: { kind: society.kind, name: society.name } }, { status: 201 });
  } catch (error) {
    return coachErrorResponse(error, 'POST /api/public/coach-registering:');
  }
}
