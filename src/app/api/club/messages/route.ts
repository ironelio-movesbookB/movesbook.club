import { NextRequest, NextResponse } from 'next/server';
import { requireMessageAuth } from '@/lib/messages/messageAuth';
import {
  createClubStaffMessage,
  deleteClubStaffMessage,
  deleteClubStaffReply,
  getClubStaffMessageThread,
  listAccessibleClubsForMessages,
  listClubRecipients,
  listClubStaffMessages,
  userCanAccessClubMessages,
  type ClubPartyType,
} from '@/lib/messages/clubStaffMessages';

export const dynamic = 'force-dynamic';

function parsePartyType(raw: string | null | undefined): ClubPartyType | null {
  return raw === 'staff' || raw === 'member' ? raw : null;
}

export async function GET(request: NextRequest) {
  const auth = await requireMessageAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);

  try {
    if (searchParams.get('clubs') === '1') {
      const clubs = await listAccessibleClubsForMessages(auth.userId);
      return NextResponse.json({ clubs, viewerId: auth.userId });
    }

    if (searchParams.get('recipients') === '1') {
      const clubId = searchParams.get('clubId')?.trim() || '';
      const type = parsePartyType(searchParams.get('type'));
      if (!clubId || !type) return NextResponse.json({ recipients: [] });
      const [recipients, access] = await Promise.all([
        listClubRecipients({ viewerId: auth.userId, clubId, type }),
        userCanAccessClubMessages(auth.userId, clubId),
      ]);
      return NextResponse.json({ recipients, isClubAdmin: access.isClubAdmin });
    }

    const threadId = searchParams.get('threadId');
    if (threadId) {
      const detail = await getClubStaffMessageThread(threadId, auth.userId);
      if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(detail);
    }

    const result = await listClubStaffMessages({
      viewerId: auth.userId,
      clubId: searchParams.get('clubId')?.trim() || null,
      partyType: parsePartyType(searchParams.get('type')),
      partyUserId: searchParams.get('recipientId')?.trim() || null,
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
    const recipientType = parsePartyType(body?.recipientType);
    const recipientUserId =
      typeof body?.recipientUserId === 'string' ? body.recipientUserId.trim() : '';
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!clubId) return NextResponse.json({ error: 'Select a club' }, { status: 400 });
    if (!recipientType) return NextResponse.json({ error: 'Select a type of recipient' }, { status: 400 });
    if (!recipientUserId) return NextResponse.json({ error: 'Select a recipient' }, { status: 400 });
    if (!text) return NextResponse.json({ error: 'Message body required' }, { status: 400 });

    const thread = await createClubStaffMessage({
      userId: auth.userId,
      clubId,
      recipientType,
      recipientUserId,
      subject: typeof body?.subject === 'string' ? body.subject : undefined,
      body: text,
    });

    return NextResponse.json({ id: thread.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create';
    console.error('POST /api/club/messages', e);
    if (msg === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (msg === 'Invalid recipient') return NextResponse.json({ error: msg }, { status: 400 });
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}

/** ?id= deletes a message (creator) or clears it (recipient); ?replyId= deletes your own reply. */
export async function DELETE(request: NextRequest) {
  const auth = await requireMessageAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const replyId = searchParams.get('replyId')?.trim();
  const id = searchParams.get('id')?.trim();

  try {
    if (replyId) {
      const ok = await deleteClubStaffReply(replyId, auth.userId);
      if (!ok) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 });
      return NextResponse.json({ ok: true });
    }
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const result = await deleteClubStaffMessage(id, auth.userId);
    if (!result) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error('DELETE /api/club/messages', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
