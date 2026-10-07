import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMessageAuth } from '@/lib/messages/messageAuth';
import {
  addReplyToThread,
  canReplyToThread,
  deleteMessageThread,
  getThreadForUser,
  updateSupportThreadStatus,
  updateThreadInappropriate,
} from '@/lib/messages/userThreads';
import { isSupportWorkflowStatus } from '@/lib/messages/supportStatus';
import {
  canReplyToClubStaffMessage,
  CLUB_MESSAGE_CATEGORY,
  getClubStaffMessageThread,
  deleteClubStaffMessage,
} from '@/lib/messages/clubStaffMessages';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMessageAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const clubDetail = await getClubStaffMessageThread(id, auth.userId);
    if (clubDetail) return NextResponse.json(clubDetail);

    const { searchParams } = new URL(request.url);
    const communityReview = searchParams.get('communityReview') === '1';
    const detail = await getThreadForUser(id, auth.userId, auth.isStaff, {
      allowCommunityReview: communityReview,
    });
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    console.error('GET /api/messages/threads/[id]', e);
    return NextResponse.json({ error: 'Failed to load thread' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMessageAuth(request);
  if (!auth?.isStaff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));

    if (typeof body?.isInappropriate === 'boolean') {
      const updated = await updateThreadInappropriate(id, body.isInappropriate);
      if (!updated) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      }
      const detail = await getThreadForUser(id, auth.userId, true);
      return NextResponse.json(detail ?? { thread: updated });
    }

    const status = body?.status;
    if (!isSupportWorkflowStatus(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updated = await updateSupportThreadStatus(id, status);
    if (!updated) {
      return NextResponse.json(
        { error: 'Thread not found or status not allowed for this category' },
        { status: 404 },
      );
    }

    const detail = await getThreadForUser(id, auth.userId, true);
    return NextResponse.json(detail ?? updated);
  } catch (e) {
    console.error('PATCH /api/messages/threads/[id]', e);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMessageAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const clubDeleted = await deleteClubStaffMessage(id, auth.userId);
    if (clubDeleted) return NextResponse.json({ ok: true, result: clubDeleted });

    if (!auth.isStaff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const ok = await deleteMessageThread(id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/messages/threads/[id]', e);
    return NextResponse.json({ error: 'Failed to delete thread' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMessageAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!text) return NextResponse.json({ error: 'Message body required' }, { status: 400 });

    const thread = await prisma.userMessageThread.findUnique({ where: { id } });
    if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isClubMessage = thread.supportCategory === CLUB_MESSAGE_CATEGORY;
    const clubReplyOk = isClubMessage
      ? await canReplyToClubStaffMessage(thread, auth.userId)
      : false;

    if (isClubMessage ? !clubReplyOk : !canReplyToThread(thread, auth.userId, auth.isStaff)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await addReplyToThread({
      threadId: id,
      senderId: auth.userId,
      isStaff: isClubMessage ? false : auth.isStaff,
      body: text,
    });

    if (isClubMessage) {
      const detail = await getClubStaffMessageThread(id, auth.userId);
      return NextResponse.json(detail);
    }

    const detail = await getThreadForUser(id, auth.userId, auth.isStaff, {
      allowCommunityReview: false,
    });
    return NextResponse.json(detail);
  } catch (e) {
    console.error('POST /api/messages/threads/[id]', e);
    return NextResponse.json({ error: 'Failed to reply' }, { status: 500 });
  }
}
