import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { sendTelegramMessage } from '@/lib/telegram';
import { resolveMessageDatabaseUserId } from '@/lib/messages/resolveMessageUserId';
import { messagePreview } from '@/lib/chat/messageContent';

/** GET - List messages for a conversation (current user must be participant). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    const decoded = verifyToken(authHeader.replace('Bearer ', ''));
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const myId = await resolveMessageDatabaseUserId(decoded.userId, decoded.userType);
    if (!myId) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }
    const { id: conversationId } = await params;

    const conv = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv || (conv.user1Id !== myId && conv.user2Id !== myId)) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Mark conversation as read when user opens it (schema has user1LastReadAt, user2LastReadAt)
    const readData =
      conv.user1Id === myId
        ? { user1LastReadAt: new Date() }
        : { user2LastReadAt: new Date() };
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: readData as Prisma.ChatConversationUpdateInput,
    });

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      include: { sender: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const list = messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.sender.name,
      content: m.content,
      createdAt: m.createdAt,
      isOwn: m.senderId === myId,
    }));

    return NextResponse.json({ messages: list });
  } catch (error) {
    console.error('Chat messages GET:', error);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}

/** POST - Send a message (store in DB, then send via Telegram to the other user if they have telegramChatId). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    const decoded = verifyToken(authHeader.replace('Bearer ', ''));
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const myId = await resolveMessageDatabaseUserId(decoded.userId, decoded.userType);
    if (!myId) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }
    const { id: conversationId } = await params;
    const body = await request.json();
    const rawContent = typeof body?.content === 'string' ? body.content : '';
    const isMediaDataUrl =
      rawContent.startsWith('data:image/') || rawContent.startsWith('data:audio/');
    const content = isMediaDataUrl ? rawContent : rawContent.trim();
    if (!content) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 });
    }
    // MySQL TEXT ≈ 64KB; keep voice/image payloads within a safe bound.
    if (isMediaDataUrl && content.length > 60_000) {
      return NextResponse.json(
        { error: 'Media message is too large. Try a shorter voice note.' },
        { status: 400 }
      );
    }

    const conv = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: {
        user1: { select: { id: true, name: true, telegramChatId: true } },
        user2: { select: { id: true, name: true, telegramChatId: true } },
      },
    });
    if (!conv || (conv.user1Id !== myId && conv.user2Id !== myId)) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const msg = await prisma.chatMessage.create({
      data: { conversationId, senderId: myId, content },
      include: { sender: { select: { id: true, name: true } } },
    });

    const other = conv.user1Id === myId ? conv.user2 : conv.user1;
    if (other.telegramChatId) {
      const preview = messagePreview(content, 200);
      const sent = await sendTelegramMessage(
        other.telegramChatId,
        `${msg.sender.name}: ${preview}`
      );
      if (sent?.messageId) {
        await prisma.chatMessage.update({
          where: { id: msg.id },
          data: { telegramMessageId: String(sent.messageId) },
        });
      }
    }

    return NextResponse.json({
      id: msg.id,
      senderId: msg.senderId,
      senderName: msg.sender.name,
      content: msg.content,
      createdAt: msg.createdAt,
      isOwn: true,
    });
  } catch (error) {
    console.error('Chat messages POST:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

/** DELETE - Clear all messages in a conversation (participant only). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    const decoded = verifyToken(authHeader.replace('Bearer ', ''));
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const myId = await resolveMessageDatabaseUserId(decoded.userId, decoded.userType);
    if (!myId) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }
    const { id: conversationId } = await params;

    const conv = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv || (conv.user1Id !== myId && conv.user2Id !== myId)) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const result = await prisma.chatMessage.deleteMany({
      where: { conversationId },
    });

    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error('Chat messages DELETE:', error);
    return NextResponse.json({ error: 'Failed to reset conversation' }, { status: 500 });
  }
}
