import { prisma } from '@/lib/prisma';
import {
  createThreadWithFirstMessage,
  deleteMessageThread,
  excerptFromBody,
  getThreadForUser,
} from '@/lib/messages/userThreads';

export const CLUB_MESSAGE_CATEGORY = 'club_message';

/** staff = club admin or club staff; member = club member */
export type ClubPartyType = 'staff' | 'member';

export function clubMessagePathStaff(clubId: string): string {
  return `club:${clubId}`;
}

export function parseClubIdFromPathStaff(pathStaff: string | null | undefined): string | null {
  if (!pathStaff) return null;
  const m = /^club:(.+)$/.exec(pathStaff.trim());
  return m?.[1] || null;
}

function isPartyType(value: unknown): value is ClubPartyType {
  return value === 'staff' || value === 'member';
}

let clubMessageColumnsEnsured = false;

/** Recipient columns live outside the Prisma model (safe for live DBs that skip migrate). */
async function ensureClubMessageColumns(): Promise<void> {
  if (clubMessageColumnsEnsured) return;
  if (!(process.env.DATABASE_URL || '').startsWith('mysql')) {
    clubMessageColumnsEnsured = true;
    return;
  }
  try {
    const cols = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_message_threads'`,
    );
    const names = new Set(cols.map((c) => c.COLUMN_NAME));
    if (!names.has('recipientUserId')) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE user_message_threads ADD COLUMN recipientUserId VARCHAR(191) NULL`,
      );
    }
    if (!names.has('recipientType')) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE user_message_threads ADD COLUMN recipientType VARCHAR(16) NULL`,
      );
    }
    if (!names.has('senderType')) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE user_message_threads ADD COLUMN senderType VARCHAR(16) NULL`,
      );
    }
    if (!names.has('deletedByRecipient')) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE user_message_threads ADD COLUMN deletedByRecipient TINYINT(1) NOT NULL DEFAULT 0`,
      );
    }
    clubMessageColumnsEnsured = true;
  } catch (err) {
    console.error('ensureClubMessageColumns failed:', err);
  }
}

type ThreadMeta = {
  id: string;
  userId: string;
  pathStaff: string | null;
  recipientUserId: string | null;
  recipientType: ClubPartyType | null;
  senderType: ClubPartyType | null;
  deletedByRecipient: boolean;
};

async function loadThreadMeta(threadId: string): Promise<ThreadMeta | null> {
  await ensureClubMessageColumns();
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      userId: string;
      pathStaff: string | null;
      supportCategory: string | null;
      recipientUserId: string | null;
      recipientType: string | null;
      senderType: string | null;
      deletedByRecipient: number | boolean | null;
    }>
  >(
    `SELECT id, userId, pathStaff, supportCategory, recipientUserId, recipientType, senderType, deletedByRecipient
     FROM user_message_threads WHERE id = ? LIMIT 1`,
    threadId,
  );
  const row = rows[0];
  if (!row || row.supportCategory !== CLUB_MESSAGE_CATEGORY) return null;
  return {
    id: String(row.id),
    userId: String(row.userId),
    pathStaff: row.pathStaff,
    recipientUserId: row.recipientUserId ? String(row.recipientUserId) : null,
    recipientType: isPartyType(row.recipientType) ? row.recipientType : null,
    senderType: isPartyType(row.senderType) ? row.senderType : null,
    deletedByRecipient: Boolean(Number(row.deletedByRecipient ?? 0)),
  };
}

export async function userCanAccessClubMessages(
  userId: string,
  clubId: string,
): Promise<{ ok: boolean; isClubAdmin: boolean; isOwner: boolean; isMember: boolean }> {
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
  return { ok: isClubAdmin || isMember, isClubAdmin, isOwner: Boolean(owned), isMember };
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

type PersonRow = {
  id: string;
  name: string | null;
  username: string | null;
  firstName?: string | null;
  surname?: string | null;
  image: string | null;
};

const personSelect = {
  id: true,
  name: true,
  username: true,
  firstName: true,
  surname: true,
  image: true,
} as const;

function formatPerson(user: PersonRow | null | undefined): string {
  if (!user) return 'Member';
  const full = [user.firstName, user.surname].filter(Boolean).join(' ').trim();
  return full || user.name || user.username || 'Member';
}

function toPersonDto(user: PersonRow | null | undefined) {
  if (!user) return null;
  return {
    id: user.id,
    name: formatPerson(user),
    username: user.username,
    image: user.image ?? null,
  };
}

/**
 * Recipients a viewer may write to in a club.
 * staff = club admin + club staff; member = club members (club admin/staff only).
 */
export async function listClubRecipients(params: {
  viewerId: string;
  clubId: string;
  type: ClubPartyType;
}) {
  const access = await userCanAccessClubMessages(params.viewerId, params.clubId);
  if (!access.ok) return [];
  if (params.type === 'member' && !access.isClubAdmin) return [];

  let users: PersonRow[] = [];
  if (params.type === 'staff') {
    const [club, staff] = await Promise.all([
      prisma.club.findUnique({
        where: { id: params.clubId },
        select: { admin: { select: personSelect } },
      }),
      prisma.clubStaff.findMany({
        where: { clubId: params.clubId },
        select: { user: { select: personSelect } },
      }),
    ]);
    users = [...(club?.admin ? [club.admin] : []), ...staff.map((s) => s.user)];
  } else {
    const members = await prisma.clubMember.findMany({
      where: { clubId: params.clubId },
      select: { member: { select: personSelect } },
    });
    users = members.map((m) => m.member);
  }

  const seen = new Set<string>();
  return users
    .filter((u) => {
      if (!u || u.id === params.viewerId || seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    })
    .map((u) => toPersonDto(u)!)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listClubStaffMessages(params: {
  viewerId: string;
  /** Empty = all clubs of the viewer */
  clubId?: string | null;
  /** Type of the other party in the conversation */
  partyType?: ClubPartyType | null;
  /** Other party of the conversation */
  partyUserId?: string | null;
  page?: number;
  pageSize?: number;
}) {
  await ensureClubMessageColumns();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, params.pageSize ?? 10));

  const clubs = await listAccessibleClubsForMessages(params.viewerId);
  const clubIds = params.clubId
    ? clubs.filter((c) => c.id === params.clubId).map((c) => c.id)
    : clubs.map((c) => c.id);
  if (clubIds.length === 0) {
    return { items: [], total: 0, page, pageSize, viewerId: params.viewerId };
  }
  const ownedPaths = clubs.filter((c) => c.role === 'admin').map((c) => clubMessagePathStaff(c.id));
  const paths = clubIds.map(clubMessagePathStaff);

  const v = params.viewerId;
  const conditions: string[] = [
    `supportCategory = ?`,
    `pathStaff IN (${paths.map(() => '?').join(',')})`,
  ];
  const args: unknown[] = [CLUB_MESSAGE_CATEGORY, ...paths];

  // Only conversations between the viewer and the other party
  const visibility = [`userId = ?`, `(recipientUserId = ? AND deletedByRecipient = 0)`];
  args.push(v, v);
  if (ownedPaths.length) {
    visibility.push(
      `(recipientUserId IS NULL AND pathStaff IN (${ownedPaths.map(() => '?').join(',')}))`,
    );
    args.push(...ownedPaths);
  }
  conditions.push(`(${visibility.join(' OR ')})`);

  if (params.partyType) {
    conditions.push(
      `((userId = ? AND recipientType = ?) OR (userId <> ? AND COALESCE(senderType, 'member') = ?))`,
    );
    args.push(v, params.partyType, v, params.partyType);
  }
  if (params.partyUserId) {
    conditions.push(`(userId = ? OR recipientUserId = ?)`);
    args.push(params.partyUserId, params.partyUserId);
  }

  const whereSql = conditions.join(' AND ');
  const [countRows, idRows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
      `SELECT COUNT(*) AS total FROM user_message_threads WHERE ${whereSql}`,
      ...args,
    ),
    prisma.$queryRawUnsafe<
      Array<{
        id: string;
        recipientUserId: string | null;
        recipientType: string | null;
        senderType: string | null;
        deletedByRecipient: number | boolean | null;
      }>
    >(
      `SELECT id, recipientUserId, recipientType, senderType, deletedByRecipient
       FROM user_message_threads WHERE ${whereSql}
       ORDER BY updatedAt DESC LIMIT ? OFFSET ?`,
      ...args,
      pageSize,
      (page - 1) * pageSize,
    ),
  ]);
  const total = Number(countRows[0]?.total ?? 0);
  const ids = idRows.map((r) => String(r.id));
  if (ids.length === 0) return { items: [], total, page, pageSize, viewerId: v };

  const metaById = new Map(idRows.map((r) => [String(r.id), r]));
  const recipientIds = Array.from(
    new Set(idRows.map((r) => r.recipientUserId).filter((x): x is string => Boolean(x))),
  );

  const [threads, recipients] = await Promise.all([
    prisma.userMessageThread.findMany({
      where: { id: { in: ids } },
      include: {
        user: { select: personSelect },
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { body: true },
        },
      },
    }),
    recipientIds.length
      ? prisma.user.findMany({ where: { id: { in: recipientIds } }, select: personSelect })
      : Promise.resolve([] as PersonRow[]),
  ]);
  const threadById = new Map(threads.map((t) => [t.id, t]));
  const recipientById = new Map(recipients.map((u) => [u.id, u]));
  const clubNameById = new Map(clubs.map((c) => [c.id, c.name]));

  const items = ids
    .map((id) => {
      const th = threadById.get(id);
      const meta = metaById.get(id);
      if (!th || !meta) return null;
      const clubId = parseClubIdFromPathStaff(th.pathStaff);
      const isCreator = th.userId === v;
      return {
        id: th.id,
        title: th.subject?.trim() || 'Message',
        excerpt: th.messages[0] ? excerptFromBody(th.messages[0].body) : '',
        updatedAt: th.updatedAt.toISOString(),
        replyCount: Math.max(0, th._count.messages - 1),
        clubId,
        clubName: clubId ? clubNameById.get(clubId) || '' : '',
        author: toPersonDto(th.user),
        recipient: meta.recipientUserId
          ? toPersonDto(recipientById.get(String(meta.recipientUserId)))
          : null,
        recipientType: isPartyType(meta.recipientType) ? meta.recipientType : null,
        isCreator,
        deletedByRecipient: Boolean(Number(meta.deletedByRecipient ?? 0)),
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return { items, total, page, pageSize, viewerId: v };
}

export async function createClubStaffMessage(params: {
  userId: string;
  clubId: string;
  recipientType: ClubPartyType;
  recipientUserId: string;
  subject?: string;
  body: string;
}) {
  const access = await userCanAccessClubMessages(params.userId, params.clubId);
  if (!access.ok) throw new Error('Forbidden');

  const allowed = await listClubRecipients({
    viewerId: params.userId,
    clubId: params.clubId,
    type: params.recipientType,
  });
  if (!allowed.some((r) => r.id === params.recipientUserId)) {
    throw new Error('Invalid recipient');
  }

  await ensureClubMessageColumns();
  const thread = await createThreadWithFirstMessage({
    userId: params.userId,
    kind: 'SUPPORT',
    subject: params.subject?.trim() || 'Message',
    body: params.body,
    supportCategory: CLUB_MESSAGE_CATEGORY,
    pathStaff: clubMessagePathStaff(params.clubId),
  });
  await prisma.$executeRawUnsafe(
    `UPDATE user_message_threads
     SET recipientUserId = ?, recipientType = ?, senderType = ?, deletedByRecipient = 0
     WHERE id = ?`,
    params.recipientUserId,
    params.recipientType,
    access.isClubAdmin ? 'staff' : 'member',
    thread.id,
  );
  return thread;
}

/** Viewer role in a club message: creator, recipient, or none. */
async function resolveRole(
  meta: ThreadMeta,
  viewerId: string,
): Promise<'creator' | 'recipient' | null> {
  if (meta.userId === viewerId) return 'creator';
  if (meta.recipientUserId) {
    return meta.recipientUserId === viewerId && !meta.deletedByRecipient ? 'recipient' : null;
  }
  // Legacy message without recipient: addressed to the club owner
  const clubId = parseClubIdFromPathStaff(meta.pathStaff);
  if (!clubId || meta.deletedByRecipient) return null;
  const access = await userCanAccessClubMessages(viewerId, clubId);
  return access.isOwner ? 'recipient' : null;
}

export async function getClubStaffMessageThread(threadId: string, viewerId: string) {
  const meta = await loadThreadMeta(threadId);
  if (!meta) return null;
  const role = await resolveRole(meta, viewerId);
  if (!role) return null;

  const detail = await getThreadForUser(threadId, viewerId, false, { allowClubMessage: true });
  if (!detail) return null;

  const recipient = meta.recipientUserId
    ? await prisma.user.findUnique({ where: { id: meta.recipientUserId }, select: personSelect })
    : null;
  const firstMessageId = detail.messages[0]?.id ?? null;

  return {
    ...detail,
    clubId: parseClubIdFromPathStaff(meta.pathStaff),
    viewerId,
    role,
    recipient: toPersonDto(recipient),
    recipientType: meta.recipientType,
    deletedByRecipient: meta.deletedByRecipient,
    firstMessageId,
    canReply: !meta.deletedByRecipient,
  };
}

/**
 * Creator: removes the message and every reply for both sides.
 * Recipient: removes every reply; creator keeps title + body (greyed).
 */
export async function deleteClubStaffMessage(
  threadId: string,
  viewerId: string,
): Promise<'deleted' | 'hidden' | false> {
  const meta = await loadThreadMeta(threadId);
  if (!meta) return false;
  const role = await resolveRole(meta, viewerId);
  if (!role) return false;

  if (role === 'creator') {
    const ok = await deleteMessageThread(threadId);
    return ok ? 'deleted' : false;
  }

  const first = await prisma.userThreadMessage.findFirst({
    where: { threadId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  await prisma.userThreadMessage.deleteMany({
    where: { threadId, ...(first ? { NOT: { id: first.id } } : {}) },
  });
  await prisma.$executeRawUnsafe(
    `UPDATE user_message_threads SET deletedByRecipient = 1 WHERE id = ?`,
    threadId,
  );
  return 'hidden';
}

/** Only the author of a reply can delete it; the opening message cannot be deleted this way. */
export async function deleteClubStaffReply(messageId: string, viewerId: string): Promise<boolean> {
  const msg = await prisma.userThreadMessage.findUnique({
    where: { id: messageId },
    select: { id: true, threadId: true, senderId: true },
  });
  if (!msg || msg.senderId !== viewerId) return false;

  const meta = await loadThreadMeta(msg.threadId);
  if (!meta) return false;
  const role = await resolveRole(meta, viewerId);
  if (!role) return false;

  const first = await prisma.userThreadMessage.findFirst({
    where: { threadId: msg.threadId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (first?.id === msg.id) return false;

  await prisma.userThreadMessage.delete({ where: { id: msg.id } });
  return true;
}

export async function canReplyToClubStaffMessage(
  thread: { id: string; supportCategory: string | null },
  viewerId: string,
): Promise<boolean> {
  if (thread.supportCategory !== CLUB_MESSAGE_CATEGORY) return false;
  const meta = await loadThreadMeta(thread.id);
  if (!meta || meta.deletedByRecipient) return false;
  return (await resolveRole(meta, viewerId)) !== null;
}
