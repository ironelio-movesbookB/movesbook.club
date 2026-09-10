import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import {
  clearInboxExceptRecentDays,
  getUnreadCounts,
  listInboxForUser,
  markNotificationVisited,
} from '@/lib/notifications/notificationService';

export const dynamic = 'force-dynamic';

function requireUser(request: NextRequest): { userId: string } | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const decoded = verifyToken(authHeader.slice(7));
  if (!decoded?.userId) return null;
  return { userId: String(decoded.userId) };
}

export async function GET(request: NextRequest) {
  const auth = requireUser(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  if (searchParams.get('countsOnly') === '1') {
    try {
      const counts = await getUnreadCounts(auth.userId);
      return NextResponse.json(counts);
    } catch (e) {
      console.error('GET /api/notifications counts', e);
      return NextResponse.json({ error: 'Failed to load counts' }, { status: 500 });
    }
  }

  const sourceParam = searchParams.get('source') || 'movesbook';
  const source = sourceParam === 'clubs' ? 'clubs' : 'movesbook';

  try {
    const result = await listInboxForUser({
      userId: auth.userId,
      source,
      search: searchParams.get('q') || '',
      page: Number(searchParams.get('page') || '1'),
      pageSize: Number(searchParams.get('pageSize') || '10'),
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('GET /api/notifications', e);
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireUser(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    if (body?.action === 'clear_section') {
      const source = body?.source === 'clubs' ? 'clubs' : 'movesbook';
      const result = await clearInboxExceptRecentDays(auth.userId, source);
      return NextResponse.json({ ok: true, ...result });
    }

    const id = typeof body?.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    if (body?.action === 'visit') {
      await markNotificationVisited(auth.userId, id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('POST /api/notifications', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
