import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { resolveMessageDatabaseUserId } from '@/lib/messages/resolveMessageUserId';
import { resolveBroadcastAdminAuth } from '@/lib/chat/clubChannelAuth';
import { messagePreview as formatMessagePreview } from '@/lib/chat/messageContent';

export const dynamic = 'force-dynamic';

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function parseClubId(raw: string | null): string | null {
  const trimmed = raw?.trim() ?? '';
  return trimmed || null;
}

function parseReplyMeta(recipientIds: string | null): {
  parentId: string | null;
  senderUserId: string | null;
} {
  if (!recipientIds) return { parentId: null, senderUserId: null };
  try {
    const meta = JSON.parse(recipientIds) as { parentId?: string; senderUserId?: string };
    return {
      parentId: typeof meta.parentId === 'string' ? meta.parentId : null,
      senderUserId: typeof meta.senderUserId === 'string' ? meta.senderUserId : null,
    };
  } catch {
    return { parentId: null, senderUserId: null };
  }
}

function messagePreview(content: string, max = 80): string {
  return formatMessagePreview(content, max);
}

function clubScopeWhere(clubId: string | null) {
  return clubId ? { clubId } : { clubId: null };
}

/**
 * GET - Admin / club admin: users (with Telegram) who replied to channel broadcasts,
 * plus their reply messages for the Chat users inbox.
 */
export async function GET(request: NextRequest) {
  try {
    const clubId = parseClubId(request.nextUrl.searchParams.get('clubId'));
    const adminAuth = await resolveBroadcastAdminAuth(request, clubId);
    if (!adminAuth.ok) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    const decoded = verifyToken(authHeader.replace('Bearer ', ''));
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const myId = await resolveMessageDatabaseUserId(decoded.userId, decoded.userType);

    const replyRows = await prisma.chatBroadcastMessage.findMany({
      where: { mode: 'reply', ...clubScopeWhere(clubId) },
      orderBy: { createdAt: 'asc' },
      take: 2000,
    });

    const channelRows = await prisma.chatBroadcastMessage.findMany({
      where: { mode: 'repliers', ...clubScopeWhere(clubId) },
      orderBy: { createdAt: 'asc' },
      take: 2000,
    });

    const parentIds = new Set<string>();
    const senderIds = new Set<string>();
    const parsedReplies: Array<{
      id: string;
      content: string;
      createdAt: Date;
      senderName: string;
      parentId: string | null;
      senderUserId: string | null;
    }> = [];

    for (const row of replyRows) {
      const meta = parseReplyMeta(row.recipientIds);
      if (!meta.senderUserId) continue;
      senderIds.add(meta.senderUserId);
      if (meta.parentId) parentIds.add(meta.parentId);
      parsedReplies.push({
        id: row.id,
        content: row.content,
        createdAt: row.createdAt,
        senderName: row.senderName,
        parentId: meta.parentId,
        senderUserId: meta.senderUserId,
      });
    }

    if (senderIds.size === 0 && channelRows.length === 0) {
      return NextResponse.json({ users: [], replies: [], channelMessages: [], count: 0 });
    }

    const [users, parents] = await Promise.all([
      prisma.user.findMany({
        where: {
          id: { in: [...senderIds] },
          telegramAccount: { not: null },
        },
        select: {
          id: true,
          name: true,
          image: true,
          telegramAccount: true,
          lastSeenAt: true,
        },
      }),
      parentIds.size
        ? prisma.chatBroadcastMessage.findMany({
            where: { id: { in: [...parentIds] } },
            select: { id: true, content: true, senderName: true },
          })
        : Promise.resolve([]),
    ]);

    const userById = new Map(users.map((u) => [u.id, u]));
    const parentById = new Map(parents.map((p) => [p.id, p]));

    const telegramReplies = parsedReplies.filter(
      (r) => r.senderUserId && userById.has(r.senderUserId)
    );

    const conversationByUserId = new Map<string, string>();
    if (myId) {
      const userIds = [...userById.keys()];
      const conversations = await prisma.chatConversation.findMany({
        where: {
          OR: [
            { user1Id: myId, user2Id: { in: userIds } },
            { user2Id: myId, user1Id: { in: userIds } },
          ],
        },
        select: { id: true, user1Id: true, user2Id: true },
      });
      for (const c of conversations) {
        const otherId = c.user1Id === myId ? c.user2Id : c.user1Id;
        conversationByUserId.set(otherId, c.id);
      }
    }

    type UserAgg = {
      id: string;
      name: string;
      image: string | null;
      telegramAccount: string | null;
      isOnline: boolean;
      lastMessageAt: string;
      lastMessagePreview: string;
      conversationId: string | null;
      replyCount: number;
    };

    const agg = new Map<string, UserAgg>();
    for (const reply of telegramReplies) {
      const uid = reply.senderUserId!;
      const user = userById.get(uid);
      if (!user) continue;
      const existing = agg.get(uid);
      const preview = messagePreview(reply.content);
      const at = reply.createdAt.toISOString();
      if (!existing) {
        agg.set(uid, {
          id: user.id,
          name: user.name,
          image: user.image,
          telegramAccount: user.telegramAccount,
          isOnline:
            user.lastSeenAt != null &&
            Date.now() - user.lastSeenAt.getTime() < ONLINE_THRESHOLD_MS,
          lastMessageAt: at,
          lastMessagePreview: preview,
          conversationId: conversationByUserId.get(uid) ?? null,
          replyCount: 1,
        });
      } else {
        existing.replyCount += 1;
        if (reply.createdAt.toISOString() >= existing.lastMessageAt) {
          existing.lastMessageAt = at;
          existing.lastMessagePreview = preview;
        }
      }
    }

    const usersList = [...agg.values()].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    const replies = telegramReplies.map((r) => {
      const parent = r.parentId ? parentById.get(r.parentId) : undefined;
      const user = r.senderUserId ? userById.get(r.senderUserId) : undefined;
      return {
        id: r.id,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        senderUserId: r.senderUserId!,
        senderName: user?.name || r.senderName,
        senderImage: user?.image ?? null,
        parentId: r.parentId,
        parentContent: parent?.content ?? null,
        parentSenderName: parent?.senderName ?? null,
        isOwn: false,
        source: 'broadcast_reply' as const,
      };
    });

    const channelMessages = channelRows.map((row) => ({
      id: row.id,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      senderUserId: '',
      senderName: row.senderName,
      senderImage: null as string | null,
      parentId: null as string | null,
      parentContent: null as string | null,
      parentSenderName: null as string | null,
      isOwn: true,
      source: 'channel' as const,
    }));

    return NextResponse.json({
      users: usersList,
      replies,
      channelMessages,
      count: usersList.length,
    });
  } catch (error) {
    console.error('Chat broadcast repliers GET:', error);
    return NextResponse.json({ error: 'Failed to load broadcast repliers' }, { status: 500 });
  }
}

/**
 * DELETE - Admin / club admin: clear Chat users inbox
 * (user replies + admin messages to repliers). Does not wipe Broadcast modes.
 * Optional `userId`: delete only that user's broadcast replies.
 */
export async function DELETE(request: NextRequest) {
  try {
    const clubId = parseClubId(request.nextUrl.searchParams.get('clubId'));
    const adminAuth = await resolveBroadcastAdminAuth(request, clubId);
    if (!adminAuth.ok) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status });
    }

    const userId = request.nextUrl.searchParams.get('userId')?.trim() || '';
    if (userId) {
      const replyRows = await prisma.chatBroadcastMessage.findMany({
        where: { mode: 'reply', ...clubScopeWhere(clubId) },
        select: { id: true, recipientIds: true },
      });
      const ids = replyRows
        .filter((row) => parseReplyMeta(row.recipientIds).senderUserId === userId)
        .map((row) => row.id);
      if (ids.length > 0) {
        await prisma.chatBroadcastMessage.deleteMany({ where: { id: { in: ids } } });
      }
      return NextResponse.json({ success: true, deleted: ids.length });
    }

    const result = await prisma.chatBroadcastMessage.deleteMany({
      where: {
        ...clubScopeWhere(clubId),
        mode: { in: ['reply', 'repliers'] },
      },
    });

    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error('Chat broadcast repliers DELETE:', error);
    return NextResponse.json({ error: 'Failed to reset chat users inbox' }, { status: 500 });
  }
}
