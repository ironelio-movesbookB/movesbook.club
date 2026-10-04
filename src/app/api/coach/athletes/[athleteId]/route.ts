import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { removeCoachAthlete } from '@/lib/club/coachMemberLists';

export const dynamic = 'force-dynamic';

/** Stop training an athlete (removes the coach link and the coach's group memberships). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { athleteId: string } },
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const decoded = token ? verifyToken(token) : null;
  if (!decoded?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (decoded.userType !== 'COACH') {
    return NextResponse.json({ error: 'Only coaches can remove athletes trained' }, { status: 403 });
  }

  try {
    const removed = await removeCoachAthlete(String(decoded.userId), params.athleteId);
    if (!removed) {
      return NextResponse.json({ error: 'Athlete not trained by you' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE coach athlete:', error);
    return NextResponse.json({ error: 'Failed to remove athlete' }, { status: 500 });
  }
}
