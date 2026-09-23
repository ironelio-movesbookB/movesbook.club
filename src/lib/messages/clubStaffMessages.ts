import { prisma } from '@/lib/prisma';
import {
  createThreadWithFirstMessage,
  deleteMessageThread,
  excerptFromBody,
  getThreadForUser,
} from '@/lib/messages/userThreads';

export const CLUB_MESSAGE_CATEGORY = 'club_message';

export function clubMessagePathStaff(clubId: string): string {
  return `club:${clubId}`;
}

export function parseClubIdFromPathStaff(pathStaff: string | null | undefined): string | null {
  if (!pathStaff) return null;
  const m = /^club:(.+)$/.exec(pathStaff.trim());
  return m?.[1] || null;
}

export async function userCanAccessClubMessages(
  userId: string,
  clubId: string,
): Promise<{ ok: boolean; isClubAdmin: boolean; isMember: boolean }> {
  const [owned, staff, member] = await Promise.all([
    prisma.club.findFirst({
      where: { id: clubId, adminId: userId },
      select: { id: true },
    }),
    prisma.clubStaff.findFirst({
      where: { clubId, userId },
      select: { id: true },
    }),
    prisma.clubMember.findFirst({
      where: { clubId, memberId: userId },
      select: { id: true },
    }),
  ]);
  const isClubAdmin = Boolean(owned || staff);
  const isMember = Boolean(member);
  return { ok: isClubAdmin || isMember, isClubAdmin, isMember };
}

export async function listAccessibleClubsForMessages(userId: string) {
  const [owned, staff, memberships] = await Promise.all([
    prisma.club.findMany({
      where: { adminId: userId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.clubStaff.findMany({
      where: { userId },
      select: { club: { select: { id: true, name: true } } },
    }),
    prisma.clubMember.findMany({
      where: { memberId: userId },
      select: { club: { select: { id: true, name: true } } },
    }),
  ]);

  const map = new Map<string, { id: string; name: string; role: 'admin' | 'staff' | 'member' }>();
  for (const c of owned) {
    map.set(c.id, { id: c.id, name: c.name, role: 'admin' });
  }
  for (const row of staff) {
    if (!map.has(row.club.id)) {
      map.set(row.club.id, { id: row.club.id, name: row.club.name, role: 'staff' });
    }
  }
  for (const row of memberships) {
    if (!map.has(row.club.id)) {
      map.set(row.club.id, { id: row.club.id, name: row.club.name, role: 'member' });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function formatAuthor(user: {
  firstName?: string | null;
  surname?: string | null;
  name?: string | null;
  username?: string | null;
}): string {
  const full = [user.firstName, user.surname].filter(Boolean).join(' ').trim();
  return full || user.name || user.username || 'Member';
}

export async function listClubStaffMessages(params: {
  clubId: string;
  viewerId: string;
  /** Club admin/staff: all member messages. Member: own only unless false. */
  receivedView: boolean;
  mineOnly?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, params.pageSize ?? 10));
  const pathStaff = clubMessagePathStaff(params.clubId);

  const access = await userCanAccessClubMessages(params.viewerId, params.clubId);
  if (!access.ok) {
    return { items: [], total: 0, page, pageSize, access };
  }

  const mineOnly =
    params.mineOnly === true ||
    (!params.receivedView && !access.isClubAdmin && params.mineOnly !== false);

  const where = {
    kind: 'SUPPORT' as const,
    supportCategory: CLUB_MESSAGE_CATEGORY,
    pathStaff,
    ...(mineOnly ? { userId: params.viewerId } : {}),
  };

  const [total, threads] = await Promise.all([
    prisma.userMessageThread.count({ where }),
    prisma.userMessageThread.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            firstName: true,
            surname: true,
            image: true,
          },
        },
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { body: true },
        },
      },
    }),
  ]);

  return {
    access,
    total,
    page,
    pageSize,
    items: threads.map((th) => ({
      id: th.id,
      title: th.subject?.trim() || 'Message for club staff',
      excerpt: th.messages[0] ? excerptFromBody(th.messages[0].body) : '',
      updatedAt: th.updatedAt.toISOString(),
      messageCount: th._count.messages,
      replyCount: Math.max(0, th._count.messages - 1),
      author: formatAuthor(th.user),
      authorUsername: th.user.username,
      authorImage: th.user.image ?? null,
      isOwner: th.userId === params.viewerId,
    })),
  };
}

export async function createClubStaffMessage(params: {
  userId: string;
  clubId: string;
  subject?: string;
  body: string;
}) {
  const access = await userCanAccessClubMessages(params.userId, params.clubId);
  if (!access.ok) throw new Error('Forbidden');

  return createThreadWithFirstMessage({
    userId: params.userId,
    kind: 'SUPPORT',
    subject: params.subject?.trim() || 'Message for club staff',
    body: params.body,
    supportCategory: CLUB_MESSAGE_CATEGORY,
    pathStaff: clubMessagePathStaff(params.clubId),
  });
}

export async function getClubStaffMessageThread(
  threadId: string,
  viewerId: string,
) {
  const thread = await prisma.userMessageThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      userId: true,
      supportCategory: true,
      pathStaff: true,
    },
  });
  if (!thread || thread.supportCategory !== CLUB_MESSAGE_CATEGORY) return null;

  const clubId = parseClubIdFromPathStaff(thread.pathStaff);
  if (!clubId) return null;

  const access = await userCanAccessClubMessages(viewerId, clubId);
  if (!access.ok) return null;
  if (!access.isClubAdmin && thread.userId !== viewerId) return null;

  const detail = await getThreadForUser(threadId, viewerId, false, {
    allowClubMessage: true,
  });
  if (!detail) return null;
  return { ...detail, clubId, access };
}

export async function deleteClubStaffMessage(threadId: string, viewerId: string) {
  const thread = await prisma.userMessageThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      userId: true,
      supportCategory: true,
      pathStaff: true,
    },
  });
  if (!thread || thread.supportCategory !== CLUB_MESSAGE_CATEGORY) return false;

  const clubId = parseClubIdFromPathStaff(thread.pathStaff);
  if (!clubId) return false;

  const access = await userCanAccessClubMessages(viewerId, clubId);
  if (!access.ok) return false;
  if (!access.isClubAdmin && thread.userId !== viewerId) return false;

  return deleteMessageThread(threadId);
}

export async function canReplyToClubStaffMessage(
  thread: { userId: string; supportCategory: string | null; pathStaff: string | null },
  viewerId: string,
): Promise<boolean> {
  if (thread.supportCategory !== CLUB_MESSAGE_CATEGORY) return false;
  const clubId = parseClubIdFromPathStaff(thread.pathStaff);
  if (!clubId) return false;
  const access = await userCanAccessClubMessages(viewerId, clubId);
  if (!access.ok) return false;
  return access.isClubAdmin || thread.userId === viewerId;
}
