import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { resolveMessageDatabaseUserId } from '@/lib/messages/resolveMessageUserId';
import { parseReplyMeta, userCanSeeBroadcastRow } from '@/lib/chat/broadcastVisibility';

export const dynamic = 'force-dynamic';

const BROADCAST_MODES = new Set(['all', 'group', 'subscribers', 'favourites']);

async function requireUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Authorization required' }, { status: 401 }) };
  }
  const decoded = verifyToken(authHeader.replace('Bearer ', ''));
  if (!decoded?.userId) {
    return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }
  const myId = await resolveMessageDatabaseUserId(decoded.userId, decoded.userType);
  if (!myId) {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 401 }) };
  }
  const user = await prisma.user.findUnique({
    where: { id: myId },
    select: { id: true, name: true },
  });
  if (!user) {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 401 }) };
  }
  return { user };
}

/** POST - Normal user replies to a Movesbook channel broadcast. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if ('error' in auth && auth.error) return auth.error;
    const user = auth.user!;

    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const rawContent = typeof body.content === 'string' ? body.content : '';
    const isImage = rawContent.startsWith('data:image/');
    const isAudio = rawContent.startsWith('data:audio/');
    const isMediaDataUrl = isImage || isAudio;
    const content = isMediaDataUrl ? rawContent : rawContent.trim();
    if (!content) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }
    if (!isMediaDataUrl && content.length > 4000) {
      return NextResponse.json({ error: 'Message is too long' }, { status: 400 });
    }
    if (isImage && content.length > 6_000_000) {
      return NextResponse.json({ error: 'Image is too large' }, { status: 400 });
    }
    if (isAudio && content.length > 60_000) {
      return NextResponse.json(
        { error: 'Voice message is too large. Try a shorter note.' },
        { status: 400 }
      );
    }

    const replyToId = typeof body.replyToId === 'string' ? body.replyToId.trim() : '';
    if (!replyToId) {
      return NextResponse.json({ error: 'replyToId is required' }, { status: 400 });
    }

    const parent = await prisma.chatBroadcastMessage.findUnique({
      where: { id: replyToId },
      select: {
        id: true,
        content: true,
        mode: true,
        senderName: true,
        clubId: true,
        recipientIds: true,
      },
    });
    if (!parent || !BROADCAST_MODES.has(parent.mode)) {
      return NextResponse.json({ error: 'Broadcast message not found' }, { status: 404 });
    }

    const rowById = new Map([
      [
        parent.id,
        {
          id: parent.id,
          recipientIds: parent.recipientIds,
          mode: parent.mode,
        },
      ],
    ]);
    if (!userCanSeeBroadcastRow(parent, user.id, rowById)) {
      return NextResponse.json({ error: 'Broadcast message not found' }, { status: 404 });
    }

    const created = await prisma.chatBroadcastMessage.create({
      data: {
        content,
        mode: 'reply',
        senderName: user.name || 'User',
        clubId: parent.clubId,
        recipientIds: JSON.stringify({ parentId: parent.id, senderUserId: user.id }),
      },
    });

    return NextResponse.json({
      message: {
        id: created.id,
        content: created.content,
        mode: created.mode,
        senderName: created.senderName,
        createdAt: created.createdAt.toISOString(),
        isReply: true,
        isOwn: true,
        parentId: parent.id,
        parentContent: parent.content,
        parentSenderName: parent.senderName,
      },
    });
  } catch (error) {
    console.error('Chat broadcast reply POST:', error);
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 });
  }
}

/** PATCH - Edit own channel reply. */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if ('error' in auth && auth.error) return auth.error;
    const user = auth.user!;

    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const messageId = typeof body.messageId === 'string' ? body.messageId.trim() : '';
    const rawContent = typeof body.content === 'string' ? body.content : '';
    const isImage = rawContent.startsWith('data:image/');
    const isAudio = rawContent.startsWith('data:audio/');
    const isMediaDataUrl = isImage || isAudio;
    const content = isMediaDataUrl ? rawContent : rawContent.trim();
    if (!messageId) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
    }
    if (!content) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }
    if (!isMediaDataUrl && content.length > 4000) {
      return NextResponse.json({ error: 'Message is too long' }, { status: 400 });
    }
    if (isImage && content.length > 6_000_000) {
      return NextResponse.json({ error: 'Image is too large' }, { status: 400 });
    }
    if (isAudio && content.length > 60_000) {
      return NextResponse.json(
        { error: 'Voice message is too large. Try a shorter note.' },
        { status: 400 }
      );
    }

    const existing = await prisma.chatBroadcastMessage.findUnique({ where: { id: messageId } });
    if (!existing || existing.mode !== 'reply') {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
    }
    const meta = parseReplyMeta(existing.recipientIds);
    if (meta.senderUserId !== user.id) {
      return NextResponse.json({ error: 'You can only edit your own replies' }, { status: 403 });
    }

    const updated = await prisma.chatBroadcastMessage.update({
      where: { id: messageId },
      data: { content },
    });

    let parentContent: string | null = null;
    let parentSenderName: string | null = null;
    if (meta.parentId) {
      const parent = await prisma.chatBroadcastMessage.findUnique({
        where: { id: meta.parentId },
        select: { content: true, senderName: true },
      });
      parentContent = parent?.content ?? null;
      parentSenderName = parent?.senderName ?? null;
    }

    return NextResponse.json({
      message: {
        id: updated.id,
        content: updated.content,
        mode: updated.mode,
        senderName: updated.senderName,
        createdAt: updated.createdAt.toISOString(),
        isReply: true,
        isOwn: true,
        parentId: meta.parentId,
        parentContent,
        parentSenderName,
      },
    });
  } catch (error) {
    console.error('Chat broadcast reply PATCH:', error);
    return NextResponse.json({ error: 'Failed to edit reply' }, { status: 500 });
  }
}

/** DELETE - Delete own channel reply for everyone. */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if ('error' in auth && auth.error) return auth.error;
    const user = auth.user!;

    const messageId = request.nextUrl.searchParams.get('messageId')?.trim() || '';
    if (!messageId) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
    }

    const existing = await prisma.chatBroadcastMessage.findUnique({ where: { id: messageId } });
    if (!existing || existing.mode !== 'reply') {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
    }
    const meta = parseReplyMeta(existing.recipientIds);
    if (meta.senderUserId !== user.id) {
      return NextResponse.json({ error: 'You can only delete your own replies' }, { status: 403 });
    }

    await prisma.chatBroadcastMessage.delete({ where: { id: messageId } });
    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    console.error('Chat broadcast reply DELETE:', error);
    return NextResponse.json({ error: 'Failed to delete reply' }, { status: 500 });
  }
}
