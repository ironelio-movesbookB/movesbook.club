import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { addCoachAthleteByCredentials } from '@/lib/club/coachMemberLists';

export const dynamic = 'force-dynamic';

/** Archive of Users → Add a member (coach): body { username, password } of the athlete. */
export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const decoded = token ? verifyToken(token) : null;
  if (!decoded?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (decoded.userType !== 'COACH') {
    return NextResponse.json({ error: 'Only coaches can add athletes trained' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { username?: unknown; password?: unknown };
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
  }

  try {
    const result = await addCoachAthleteByCredentials(String(decoded.userId), username, password);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, athleteId: result.athleteId });
  } catch (error) {
    console.error('POST coach athletes add:', error);
    return NextResponse.json({ error: 'Failed to add athlete' }, { status: 500 });
  }
}
