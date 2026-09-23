import { NextRequest, NextResponse } from 'next/server';
import { requireMessageAuth } from '@/lib/messages/messageAuth';
import {
  createClubStaffMessage,
  deleteClubStaffMessage,
  getClubStaffMessageThread,
  listAccessibleClubsForMessages,
  listClubStaffMessages,
} from '@/lib/messages/clubStaffMessages';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireMessageAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);

  try {
    if (searchParams.get('clubs') === '1') {
      const clubs = await listAccessibleClubsForMessages(auth.userId);
      return NextResponse.json({ clubs });
    }

    const threadId = searchParams.get('threadId');
    if (threadId) {
      const detail = await getClubStaffMessageThread(threadId, auth.userId);
      if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(detail);
    }

    const clubId = searchParams.get('clubId')?.trim();
    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    const result = await listClubStaffMessages({
      clubId,
      viewerId: auth.userId,
      receivedView: searchParams.get('received') === '1',
      mineOnly: searchParams.get('mine') === '1' ? true : searchParams.get('mine') === '0' ? false : undefined,
      page: Number(searchParams.get('page') || '1'),
      pageSize: Number(searchParams.get('pageSize') || '10'),
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error('GET /api/club/messages', e);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireMessageAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const clubId = typeof body?.clubId === 'string' ? body.clubId.trim() : '';
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!clubId) return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    if (!text) return NextResponse.json({ error: 'Message body required' }, { status: 400 });

    const thread = await createClubStaffMessage({
      userId: auth.userId,
      clubId,
      subject: typeof body?.subject === 'string' ? body.subject : undefined,
      body: text,
    });

    return NextResponse.json({ id: thread.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create';
    console.error('POST /api/club/messages', e);
    return NextResponse.json(
      { error: msg === 'Forbidden' ? 'Forbidden' : 'Failed to create message' },
      { status: msg === 'Forbidden' ? 403 : 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireMessageAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id')?.trim();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    const ok = await deleteClubStaffMessage(id, auth.userId);
    if (!ok) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/club/messages', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
