import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  normalizeSupportImageUrls,
  parseSupportImageUrlsJson,
} from '@/lib/messages/supportImages';
import {
  defaultStatusForSupportCategory,
  isSupportWorkflowCategory,
  isSupportWorkflowStatus,
  type SupportWorkflowStatus,
} from '@/lib/messages/supportStatus';

export type UserThreadKind = 'REVIEW' | 'SUPPORT';
export type SupportCategory = 'feedback' | 'question' | 'suggestion' | 'problem' | 'bug_fixed';
export { MAX_SUPPORT_IMAGES, normalizeSupportImageUrls, parseSupportImageUrlsJson } from '@/lib/messages/supportImages';

const EXCERPT_LEN = 160;

export function excerptFromBody(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= EXCERPT_LEN) return t;
  return `${t.slice(0, EXCERPT_LEN)}…`;
}

function wrapAngle(s: string): string {
  const t = s.trim();
  if (!t) return '< Feedback >';
  if (t.startsWith('<')) return t;
  return `< ${t} >`;
}

/** Map filter status to DB values (workflow + legacy S/C/D). */
function buildStatusWhere(status: string): Prisma.UserMessageThreadWhereInput {
  if (status === 'pending') {
    return { OR: [{ status: 'pending' }, { status: 'S' }, { status: null }] };
  }
  if (status === 'solved') {
    return { OR: [{ status: 'solved' }, { status: 'C' }] };
  }
  if (status === 'unsolvable') {
    return { OR: [{ status: 'unsolvable' }, { status: 'D' }] };
  }
  return { status };
}

const SA_USERNAME_PREFIX = /^sa-/;

type AuthorFields = {
  firstName: string | null;
  surname: string | null;
  name: string;
  username: string;
  superAdminId?: string | null;
};

async function loadSuperAdminNames(ids: Array<string | null | undefined>) {
  const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (!unique.length) return new Map<string, { name: string | null; username: string }>();
  const rows = await prisma.superAdmin.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, username: true },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

function formatAuthor(
  u: AuthorFields,
  superAdminNames: Map<string, { name: string | null; username: string }>,
) {
  if (u.firstName || u.surname) {
    const full = [u.firstName, u.surname].filter(Boolean).join(' ').trim();
    if (full) return full;
  }
  const name = u.name?.trim();
  if (name && !SA_USERNAME_PREFIX.test(name)) return name;
  if (u.superAdminId) {
    const sa = superAdminNames.get(u.superAdminId);
    if (sa) return sa.name?.trim() || sa.username;
  }
  if (u.username && !SA_USERNAME_PREFIX.test(u.username)) return u.username;
  return name || u.username || 'Movesbook user';
}

function senderDisplayName(
  u: { name: string; username: string; superAdminId?: string | null },
  superAdminNames: Map<string, { name: string | null; username: string }>,
) {
  const name = u.name?.trim();
  if (name && !SA_USERNAME_PREFIX.test(name)) return name;
  if (u.superAdminId) {
    const sa = superAdminNames.get(u.superAdminId);
    if (sa) return sa.name?.trim() || sa.username;
  }
  if (u.username && !SA_USERNAME_PREFIX.test(u.username)) return u.username;
  return name || u.username || 'Movesbook user';
}

export type ThreadListSort = 'date_asc' | 'date_desc' | 'like' | 'dislike';

export type SupportFeedFilters = {
  category?: SupportCategory | '';
  languageCode?: string;
  mineOnly?: boolean;
  recentOnly?: boolean;
  currentPageOnly?: boolean;
  currentPath?: string;
  bugsOnly?: boolean;
  excludeBugs?: boolean;
  searchQuery?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  inappropriateOnly?: boolean;
  excludeInappropriate?: boolean;
  sort?: ThreadListSort | '';
  page?: number;
  pageSize?: number;
};

export type PaginatedFeedResult = {
  items: Array<{
    id: string;
    title: string;
    excerpt: string;
    updatedAt: string;
    messageCount: number;
    supportCategory: string | null;
    languageCode: string | null;
    author: string;
    authorImage: string | null;
    isMine: boolean;
    likeCount: number;
    dislikeCount: number;
    myReaction: 'L' | 'D' | null;
    status: string | null;
    imageUrls: string[];
    isInappropriate?: boolean;
    /** True when the latest message is from a non-staff user (staff should reply). */
    awaitingStaffReply?: boolean;
    threadKind?: UserThreadKind;
  }>;
  total: number;
  page: number;
  pageSize: number;
};

function resolveThreadListOrderBy(
  sort: ThreadListSort | '' | undefined,
): Prisma.UserMessageThreadOrderByWithRelationInput {
  switch (sort) {
    case 'date_asc':
      return { createdAt: 'asc' };
    case 'date_desc':
      return { createdAt: 'desc' };
    case 'like':
      return { likeCount: 'desc' };
    case 'dislike':
      return { dislikeCount: 'desc' };
    default:
      return { updatedAt: 'desc' };
  }
}

function buildCreatedAtRange(filters: {
  fromDate?: string;
  toDate?: string;
  recentOnly?: boolean;
}): Prisma.DateTimeFilter | null {
  const from = filters.fromDate?.trim() ? new Date(filters.fromDate) : null;
  const to = filters.toDate?.trim() ? new Date(filters.toDate) : null;
  if (to && !Number.isNaN(to.getTime())) {
    to.setHours(23, 59, 59, 999);
  }

  const createdAt: Prisma.DateTimeFilter = {};
  if (filters.recentOnly) {
    createdAt.gte = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  }
  if (from && !Number.isNaN(from.getTime())) {
    createdAt.gte = from;
  }
  if (to && !Number.isNaN(to.getTime())) {
    createdAt.lte = to;
  }
  return Object.keys(createdAt).length ? createdAt : null;
}

function buildSearchWhere(q: string): Prisma.UserMessageThreadWhereInput {
  const term = q.trim();
  if (!term) return {};
  return {
    OR: [
      { subject: { contains: term } },
      {
        user: {
          OR: [
            { name: { contains: term } },
            { username: { contains: term } },
            { firstName: { contains: term } },
            { surname: { contains: term } },
          ],
        },
      },
      { messages: { some: { body: { contains: term } } } },
    ],
  };
}

/** Latest message per thread: true when staff has not replied last. */
async function loadAwaitingStaffReplyByThreadId(
  threadIds: string[],
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (!threadIds.length) return map;
  const placeholders = threadIds.map(() => '?').join(',');
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ threadId: string; isStaff: number | boolean }>
    >(
      `SELECT um.threadId, um.isStaff
       FROM user_thread_messages um
       INNER JOIN (
         SELECT threadId, MAX(createdAt) AS maxCreated
         FROM user_thread_messages
         WHERE threadId IN (${placeholders})
         GROUP BY threadId
       ) latest ON um.threadId = latest.threadId AND um.createdAt = latest.maxCreated`,
      ...threadIds,
    );
    for (const row of rows) {
      map.set(String(row.threadId), !Boolean(row.isStaff));
    }
  } catch {
    /* ignore */
  }
  return map;
}

function mapSupportThreads(
  threads: Array<{
    id: string;
    subject: string;
    updatedAt: Date;
    supportCategory: string | null;
    languageCode: string | null;
    userId: string;
    likeCount?: number;
    dislikeCount?: number;
    status?: string | null;
    isInappropriate?: boolean;
    imageUrls?: string[] | string | null;
    user: AuthorFields & { superAdminId: string | null; image?: string | null };
    _count: { messages: number };
    messages: Array<{ body: string }>;
    likes?: Array<{ reaction: string }>;
  }>,
  viewerId: string,
  superAdminNames: Map<string, { name: string | null; username: string }>,
) {
  return threads.map((th) => ({
    id: th.id,
    title: wrapAngle(th.subject || 'Feedback'),
    excerpt: th.messages[0] ? excerptFromBody(th.messages[0].body) : '',
    updatedAt: th.updatedAt.toISOString(),
    messageCount: th._count.messages,
    supportCategory: th.supportCategory,
    languageCode: th.languageCode,
    author: formatAuthor(th.user, superAdminNames),
    authorImage: th.user.image ?? null,
    isMine: th.userId === viewerId,
    likeCount: th.likeCount ?? 0,
    dislikeCount: th.dislikeCount ?? 0,
    myReaction: (th.likes?.[0]?.reaction === 'L' || th.likes?.[0]?.reaction === 'D'
      ? th.likes[0].reaction
      : null) as 'L' | 'D' | null,
    status: th.status ?? null,
    isInappropriate: th.isInappropriate ?? false,
    imageUrls: Array.isArray(th.imageUrls)
      ? normalizeSupportImageUrls(th.imageUrls)
      : parseSupportImageUrlsJson(typeof th.imageUrls === 'string' ? th.imageUrls : null),
  }));
}

export async function listSupportFeed(
  viewerId: string,
  filters: SupportFeedFilters,
): Promise<PaginatedFeedResult> {
  await ensureSupportThreadExtras();

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, filters.pageSize ?? 5));

  const createdAtRange = buildCreatedAtRange(filters);

  const searchWhere = buildSearchWhere(filters.searchQuery || '');
  const pathWhere: Prisma.UserMessageThreadWhereInput | null =
    filters.currentPageOnly && filters.currentPath
      ? {
          OR: [
            { realPath: { contains: filters.currentPath } },
            { pathStaff: { contains: filters.currentPath } },
          ],
        }
      : null;

  const where: Prisma.UserMessageThreadWhereInput = {
    kind: 'SUPPORT',
    isPublic: true,
    ...(filters.mineOnly ? { userId: viewerId } : {}),
    ...(filters.bugsOnly
      ? {
          supportCategory: 'problem',
          errorMessage: { not: null },
          NOT: { errorMessage: '' },
        }
      : filters.category
        ? {
            supportCategory: filters.category,
            ...(filters.excludeBugs
              ? { OR: [{ errorMessage: null }, { errorMessage: '' }] }
              : {}),
          }
        : {}),
    ...(filters.languageCode ? { languageCode: filters.languageCode } : {}),
    ...(createdAtRange ? { createdAt: createdAtRange } : {}),
    ...(filters.inappropriateOnly ? { isInappropriate: true } : {}),
    ...(filters.excludeInappropriate ? { isInappropriate: false } : {}),
    ...(filters.status
      ? (buildStatusWhere(filters.status) as Prisma.UserMessageThreadWhereInput)
      : {}),
    ...(searchWhere.OR || pathWhere
      ? {
          AND: [
            ...(searchWhere.OR ? [searchWhere] : []),
            ...(pathWhere ? [pathWhere] : []),
          ],
        }
      : {}),
  };

  const [total, threads] = await Promise.all([
    prisma.userMessageThread.count({ where }),
    prisma.userMessageThread.findMany({
      where,
      orderBy: resolveThreadListOrderBy(filters.sort),
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
            superAdminId: true,
          },
        },
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { body: true, createdAt: true },
        },
      },
    }),
  ]);

  const threadIds = threads.map((th) => th.id);
  const extrasById = new Map<
    string,
    {
      likeCount: number;
      dislikeCount: number;
      status: string | null;
      myReaction: 'L' | 'D' | null;
      imageUrls: string[];
    }
  >();

  if (threadIds.length) {
    const placeholders = threadIds.map(() => '?').join(',');
    try {
      const extras = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          likeCount: number | null;
          dislikeCount: number | null;
          status: string | null;
          imageUrls?: string | null;
        }>
      >(
        `SELECT id, likeCount, dislikeCount, status, imageUrls FROM user_message_threads WHERE id IN (${placeholders})`,
        ...threadIds,
      );
      for (const row of extras) {
        extrasById.set(String(row.id), {
          likeCount: Number(row.likeCount ?? 0),
          dislikeCount: Number(row.dislikeCount ?? 0),
          status: row.status ?? null,
          myReaction: null,
          imageUrls: parseSupportImageUrlsJson(row.imageUrls ?? null),
        });
      }
      const myLikes = await prisma.$queryRawUnsafe<Array<{ threadId: string; reaction: string }>>(
        `SELECT threadId, reaction FROM user_message_thread_likes
         WHERE userId = ? AND threadId IN (${placeholders})`,
        viewerId,
        ...threadIds,
      );
      for (const row of myLikes) {
        const cur = extrasById.get(String(row.threadId));
        if (cur && (row.reaction === 'L' || row.reaction === 'D')) {
          cur.myReaction = row.reaction;
        }
      }
    } catch {
      /* columns/table may still be creating — retry without imageUrls */
      try {
        const extras = await prisma.$queryRawUnsafe<
          Array<{ id: string; likeCount: number | null; dislikeCount: number | null; status: string | null }>
        >(
          `SELECT id, likeCount, dislikeCount, status FROM user_message_threads WHERE id IN (${placeholders})`,
          ...threadIds,
        );
        for (const row of extras) {
          extrasById.set(String(row.id), {
            likeCount: Number(row.likeCount ?? 0),
            dislikeCount: Number(row.dislikeCount ?? 0),
            status: row.status ?? null,
            myReaction: null,
            imageUrls: [],
          });
        }
      } catch {
        /* ignore */
      }
    }
  }

  const superAdminNames = await loadSuperAdminNames(threads.map((th) => th.user.superAdminId));
  const awaitingById = await loadAwaitingStaffReplyByThreadId(threadIds);

  return {
    items: mapSupportThreads(
      threads.map((th) => {
        const extra = extrasById.get(th.id);
        return {
          ...th,
          likeCount: extra?.likeCount ?? 0,
          dislikeCount: extra?.dislikeCount ?? 0,
          status: extra?.status ?? null,
          likes: extra?.myReaction ? [{ reaction: extra.myReaction }] : [],
          imageUrls: extra?.imageUrls ?? [],
        };
      }),
      viewerId,
      superAdminNames,
    ).map((item) => ({
      ...item,
      awaitingStaffReply: awaitingById.get(item.id) ?? false,
    })),
    total,
    page,
    pageSize,
  };
}

export async function countUserSupportThreads(userId: string): Promise<number> {
  return prisma.userMessageThread.count({
    where: { userId, kind: 'SUPPORT' },
  });
}

export async function listBugFixedMemos(filters: {
  searchQuery?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedFeedResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, filters.pageSize ?? 5));

  const where: Prisma.UserMessageThreadWhereInput = {
    kind: 'SUPPORT',
    supportCategory: 'bug_fixed',
    isPublic: false,
    AND: [
      buildSearchWhere(filters.searchQuery || ''),
      ...(filters.status ? [buildStatusWhere(filters.status)] : []),
    ],
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
            superAdminId: true,
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

  const threadIds = threads.map((th) => th.id);
  const imageUrlsById = new Map<string, string[]>();
  if (threadIds.length) {
    const placeholders = threadIds.map(() => '?').join(',');
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string; imageUrls: string | null }>>(
        `SELECT id, imageUrls FROM user_message_threads WHERE id IN (${placeholders})`,
        ...threadIds,
      );
      for (const row of rows) {
        imageUrlsById.set(String(row.id), parseSupportImageUrlsJson(row.imageUrls ?? null));
      }
    } catch {
      /* imageUrls column may not exist yet */
    }
  }

  const superAdminNames = await loadSuperAdminNames(threads.map((th) => th.user.superAdminId));

  return {
    items: threads.map((th) => ({
      id: th.id,
      title: wrapAngle(th.subject || 'Bug fixed'),
      excerpt: th.messages[0] ? excerptFromBody(th.messages[0].body) : '',
      updatedAt: th.updatedAt.toISOString(),
      messageCount: th._count.messages,
      supportCategory: th.supportCategory,
      languageCode: th.languageCode,
      author: formatAuthor(th.user, superAdminNames),
      authorImage: null,
      isMine: true,
      likeCount: 0,
      dislikeCount: 0,
      myReaction: null as 'L' | 'D' | null,
      status: th.status,
      imageUrls: imageUrlsById.get(th.id) ?? [],
    })),
    total,
    page,
    pageSize,
  };
}

export async function listAllReviews(filters?: {
  searchQuery?: string;
  page?: number;
  pageSize?: number;
  userId?: string;
  viewerId?: string;
  fromDate?: string;
  toDate?: string;
  languageCode?: string;
  recentOnly?: boolean;
  currentPageOnly?: boolean;
  currentPath?: string;
  inappropriateOnly?: boolean;
  excludeInappropriate?: boolean;
  sort?: ThreadListSort | '';
}): Promise<PaginatedFeedResult> {
  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, filters?.pageSize ?? 5));

  const createdAtRange = buildCreatedAtRange({
    fromDate: filters?.fromDate,
    toDate: filters?.toDate,
    recentOnly: filters?.recentOnly,
  });

  const searchWhere = buildSearchWhere(filters?.searchQuery || '');
  const pathWhere: Prisma.UserMessageThreadWhereInput | null =
    filters?.currentPageOnly && filters.currentPath
      ? {
          OR: [
            { realPath: { contains: filters.currentPath } },
            { pathStaff: { contains: filters.currentPath } },
          ],
        }
      : null;

  const where: Prisma.UserMessageThreadWhereInput = {
    kind: 'REVIEW',
    ...(filters?.userId ? { userId: filters.userId } : {}),
    ...(filters?.languageCode ? { languageCode: filters.languageCode } : {}),
    ...(createdAtRange ? { createdAt: createdAtRange } : {}),
    ...(filters?.inappropriateOnly ? { isInappropriate: true } : {}),
    ...(filters?.excludeInappropriate ? { isInappropriate: false } : {}),
    ...(searchWhere.OR || pathWhere
      ? {
          AND: [
            ...(searchWhere.OR ? [searchWhere] : []),
            ...(pathWhere ? [pathWhere] : []),
          ],
        }
      : {}),
  };

  const [total, threads] = await Promise.all([
    prisma.userMessageThread.count({ where }),
    prisma.userMessageThread.findMany({
      where,
      orderBy: resolveThreadListOrderBy(filters?.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            surname: true,
            name: true,
            username: true,
            superAdminId: true,
          },
        },
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { body: true },
        },
      },
    }),
  ]);

  const viewerId = filters?.viewerId || filters?.userId || '';
  const superAdminNames = await loadSuperAdminNames(threads.map((th) => th.user.superAdminId));
  const threadIds = threads.map((th) => th.id);
  const awaitingById = await loadAwaitingStaffReplyByThreadId(threadIds);

  return {
    items: threads.map((th) => ({
      id: th.id,
      title: th.subject || 'Review discussion',
      excerpt: th.messages[0] ? excerptFromBody(th.messages[0].body) : '',
      updatedAt: th.updatedAt.toISOString(),
      messageCount: th._count.messages,
      supportCategory: th.supportCategory,
      languageCode: th.languageCode,
      author: formatAuthor(th.user, superAdminNames),
      authorImage: null,
      isMine: viewerId ? th.userId === viewerId : false,
      likeCount: th.likeCount ?? 0,
      dislikeCount: th.dislikeCount ?? 0,
      myReaction: null as 'L' | 'D' | null,
      status: null,
      imageUrls: [] as string[],
      isInappropriate: th.isInappropriate ?? false,
      awaitingStaffReply: awaitingById.get(th.id) ?? false,
    })),
    total,
    page,
    pageSize,
  };
}

/** Staff moderation: all inappropriate review + support threads (any category). */
export async function listInappropriateFeed(filters?: {
  searchQuery?: string;
  page?: number;
  pageSize?: number;
  languageCode?: string;
  fromDate?: string;
  toDate?: string;
  recentOnly?: boolean;
  sort?: ThreadListSort | '';
}): Promise<PaginatedFeedResult> {
  await ensureSupportThreadExtras();

  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, filters?.pageSize ?? 5));

  const createdAtRange = buildCreatedAtRange({
    fromDate: filters?.fromDate,
    toDate: filters?.toDate,
    recentOnly: filters?.recentOnly,
  });

  const searchWhere = buildSearchWhere(filters?.searchQuery || '');

  const where: Prisma.UserMessageThreadWhereInput = {
    isInappropriate: true,
    kind: { in: ['REVIEW', 'SUPPORT'] },
    ...(filters?.languageCode ? { languageCode: filters.languageCode } : {}),
    ...(createdAtRange ? { createdAt: createdAtRange } : {}),
    ...(searchWhere.OR ? searchWhere : {}),
  };

  const [total, threads] = await Promise.all([
    prisma.userMessageThread.count({ where }),
    prisma.userMessageThread.findMany({
      where,
      orderBy: resolveThreadListOrderBy(filters?.sort),
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
            superAdminId: true,
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

  const threadIds = threads.map((th) => th.id);
  const awaitingById = await loadAwaitingStaffReplyByThreadId(threadIds);
  const imageUrlsById = new Map<string, string[]>();

  if (threadIds.length) {
    const placeholders = threadIds.map(() => '?').join(',');
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string; imageUrls: string | null }>>(
        `SELECT id, imageUrls FROM user_message_threads WHERE id IN (${placeholders})`,
        ...threadIds,
      );
      for (const row of rows) {
        imageUrlsById.set(String(row.id), parseSupportImageUrlsJson(row.imageUrls ?? null));
      }
    } catch {
      /* column may be missing */
    }
  }

  const superAdminNames = await loadSuperAdminNames(threads.map((th) => th.user.superAdminId));

  return {
    items: threads.map((th) => {
      const isReview = th.kind === 'REVIEW';
      const title = isReview
        ? th.subject || 'Review discussion'
        : wrapAngle(th.subject || 'Feedback');
      return {
        id: th.id,
        title,
        excerpt: th.messages[0] ? excerptFromBody(th.messages[0].body) : '',
        updatedAt: th.updatedAt.toISOString(),
        messageCount: th._count.messages,
        supportCategory: th.supportCategory,
        languageCode: th.languageCode,
        author: formatAuthor(th.user, superAdminNames),
        authorImage: th.user.image ?? null,
        isMine: false,
        likeCount: th.likeCount ?? 0,
        dislikeCount: th.dislikeCount ?? 0,
        myReaction: null as 'L' | 'D' | null,
        status: th.status ?? null,
        imageUrls: imageUrlsById.get(th.id) ?? [],
        isInappropriate: true,
        awaitingStaffReply: awaitingById.get(th.id) ?? false,
        threadKind: th.kind,
      };
    }),
    total,
    page,
    pageSize,
  };
}

export async function listThreadsForUser(userId: string, kind: UserThreadKind) {
  const threads = await prisma.userMessageThread.findMany({
    where: { userId, kind },
    orderBy: { updatedAt: 'desc' },
    include: {
      user: {
        select: { firstName: true, surname: true, name: true, username: true, superAdminId: true },
      },
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { body: true },
      },
    },
  });

  const superAdminNames = await loadSuperAdminNames(threads.map((th) => th.user.superAdminId));

  return threads.map((th) => ({
    id: th.id,
    title: th.subject || (kind === 'REVIEW' ? 'Review discussion' : 'Support request'),
    excerpt: th.messages[0] ? excerptFromBody(th.messages[0].body) : '',
    updatedAt: th.updatedAt.toISOString(),
    messageCount: th._count.messages,
    supportCategory: th.supportCategory,
    languageCode: th.languageCode,
    author: formatAuthor(th.user, superAdminNames),
  }));
}

export async function createThreadWithFirstMessage(params: {
  userId: string;
  kind: UserThreadKind;
  subject?: string;
  body: string;
  languageCode?: string;
  pathStaff?: string;
  realPath?: string;
  errorMessage?: string;
  supportCategory?: string;
  imageUrls?: string[];
}) {
  await ensureSupportThreadExtras();
  const isSupport = params.kind === 'SUPPORT';
  const imageUrls = normalizeSupportImageUrls(params.imageUrls);
  return prisma.userMessageThread.create({
    data: {
      userId: params.userId,
      kind: params.kind,
      subject: params.subject?.trim() || '',
      languageCode: params.languageCode || null,
      pathStaff: params.pathStaff || null,
      realPath: params.realPath || null,
      errorMessage: params.errorMessage || null,
      supportCategory: params.supportCategory || null,
      isPublic: isSupport && params.supportCategory !== 'bug_fixed',
      messages: {
        create: {
          senderId: params.userId,
          isStaff: false,
          body: params.body.trim(),
        },
      },
    },
    include: { messages: true },
  }).then(async (created) => {
    if (isSupport) {
      const initialStatus = defaultStatusForSupportCategory(params.supportCategory);
      if (initialStatus) {
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE user_message_threads SET status = ? WHERE id = ?`,
            initialStatus,
            created.id,
          );
        } catch {
          /* optional until column exists */
        }
      }
    }
    if (imageUrls.length) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE user_message_threads SET imageUrls = ? WHERE id = ?`,
          JSON.stringify(imageUrls),
          created.id,
        );
      } catch (err) {
        console.error('Failed to save support imageUrls:', err);
      }
    }
    return created;
  });
}

export async function getThreadForUser(
  threadId: string,
  viewerId: string,
  isStaff: boolean,
  options?: { allowCommunityReview?: boolean },
) {
  const thread = await prisma.userMessageThread.findUnique({
    where: { id: threadId },
    include: {
      user: {
        select: { firstName: true, surname: true, name: true, username: true, superAdminId: true },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          sender: {
            select: { id: true, name: true, username: true, superAdminId: true },
          },
        },
      },
    },
  });

  if (!thread) return null;

  const isOwner = thread.userId === viewerId;
  const canRead =
    isOwner ||
    isStaff ||
    (thread.kind === 'SUPPORT' && thread.isPublic) ||
    (thread.kind === 'REVIEW' && options?.allowCommunityReview) ||
    (thread.supportCategory === 'bug_fixed' && isStaff);

  if (!canRead) return null;

  const superAdminIds = [
    thread.user.superAdminId,
    ...thread.messages.map((m) => m.sender?.superAdminId),
  ];
  const superAdminNames = await loadSuperAdminNames(superAdminIds);
  const authorName = formatAuthor(thread.user, superAdminNames);

  let imageUrls: string[] = [];
  let status: string | null = thread.status ?? null;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ imageUrls: string | null; status: string | null }>>(
      `SELECT imageUrls, status FROM user_message_threads WHERE id = ? LIMIT 1`,
      threadId,
    );
    imageUrls = parseSupportImageUrlsJson(rows[0]?.imageUrls ?? null);
    if (rows[0]?.status != null) status = rows[0].status;
  } catch {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ imageUrls: string | null }>>(
        `SELECT imageUrls FROM user_message_threads WHERE id = ? LIMIT 1`,
        threadId,
      );
      imageUrls = parseSupportImageUrlsJson(rows[0]?.imageUrls ?? null);
    } catch {
      imageUrls = [];
    }
  }

  return {
    thread: {
      id: thread.id,
      subject: thread.subject,
      kind: thread.kind,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      isOwner,
      languageCode: thread.languageCode,
      pathStaff: thread.pathStaff,
      realPath: thread.realPath,
      supportCategory: thread.supportCategory,
      errorMessage: thread.errorMessage,
      authorName,
      imageUrls,
      status,
    },
    messages: thread.messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      isStaff: m.isStaff,
      sender: m.sender
        ? {
            id: m.sender.id,
            name: senderDisplayName(m.sender, superAdminNames),
            username: m.sender.username,
          }
        : null,
    })),
  };
}

/** Staff-only: update workflow status for supported assistance categories. */
export async function updateSupportThreadStatus(
  threadId: string,
  status: SupportWorkflowStatus,
): Promise<{ id: string; status: string } | null> {
  await ensureSupportThreadExtras();
  const thread = await prisma.userMessageThread.findUnique({ where: { id: threadId } });
  if (!thread || thread.kind !== 'SUPPORT') return null;
  if (!isSupportWorkflowCategory(thread.supportCategory)) return null;
  if (!isSupportWorkflowStatus(status)) return null;

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE user_message_threads SET status = ?, updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ?`,
      status,
      threadId,
    );
  } catch {
    await prisma.userMessageThread.update({
      where: { id: threadId },
      data: { status },
    });
  }

  return { id: threadId, status };
}

/** Staff-only: mark thread as inappropriate / restore. */
export async function updateThreadInappropriate(
  threadId: string,
  isInappropriate: boolean,
): Promise<{ id: string; isInappropriate: boolean } | null> {
  const thread = await prisma.userMessageThread.findUnique({ where: { id: threadId } });
  if (!thread) return null;
  const updated = await prisma.userMessageThread.update({
    where: { id: threadId },
    data: { isInappropriate },
    select: { id: true, isInappropriate: true },
  });
  return updated;
}

export async function deleteMessageThread(threadId: string): Promise<boolean> {
  const thread = await prisma.userMessageThread.findUnique({ where: { id: threadId } });
  if (!thread) return false;
  await prisma.userMessageThread.delete({ where: { id: threadId } });
  return true;
}

function parseBulkDeleteDateRange(fromDate: string, toDate: string): { from: Date; to: Date } | null {
  const from = fromDate?.trim() ? new Date(fromDate) : null;
  const to = toDate?.trim() ? new Date(toDate) : null;
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export async function bulkDeleteSupportThreadsByDate(params: {
  fromDate: string;
  toDate: string;
  category?: SupportCategory | '';
  bugsOnly?: boolean;
  excludeBugs?: boolean;
}): Promise<number> {
  const range = parseBulkDeleteDateRange(params.fromDate, params.toDate);
  if (!range) return 0;

  const where: Prisma.UserMessageThreadWhereInput = {
    kind: 'SUPPORT',
    createdAt: { gte: range.from, lte: range.to },
    ...(params.bugsOnly
      ? {
          supportCategory: 'problem',
          errorMessage: { not: null },
          NOT: { errorMessage: '' },
        }
      : params.category
        ? {
            supportCategory: params.category,
            ...(params.excludeBugs
              ? { OR: [{ errorMessage: null }, { errorMessage: '' }] }
              : {}),
          }
        : {}),
  };

  const result = await prisma.userMessageThread.deleteMany({ where });
  return result.count;
}

export async function bulkDeleteReviewThreadsByDate(params: {
  fromDate: string;
  toDate: string;
}): Promise<number> {
  const range = parseBulkDeleteDateRange(params.fromDate, params.toDate);
  if (!range) return 0;

  const result = await prisma.userMessageThread.deleteMany({
    where: {
      kind: 'REVIEW',
      createdAt: { gte: range.from, lte: range.to },
    },
  });
  return result.count;
}

export async function addReplyToThread(params: {
  threadId: string;
  senderId: string | null;
  isStaff: boolean;
  body: string;
}) {
  const thread = await prisma.userMessageThread.findUnique({ where: { id: params.threadId } });
  if (!thread) return null;

  const msg = await prisma.userThreadMessage.create({
    data: {
      threadId: params.threadId,
      senderId: params.senderId,
      isStaff: params.isStaff,
      body: params.body.trim(),
    },
  });

  await prisma.userMessageThread.update({
    where: { id: params.threadId },
    data: { updatedAt: new Date() },
  });

  return msg;
}

export function canReplyToThread(
  thread: { userId: string; kind: string; isPublic: boolean },
  viewerId: string,
  isStaff: boolean,
): boolean {
  if (isStaff) return true;
  if (thread.userId === viewerId) return true;
  if (thread.kind === 'SUPPORT' && thread.isPublic) return true;
  return false;
}

let supportExtrasEnsured = false;

/** Ensure like/status columns + likes table exist (safe for live DBs that skip migrate). */
export async function ensureSupportThreadExtras(): Promise<void> {
  if (supportExtrasEnsured) return;
  if (!(process.env.DATABASE_URL || '').startsWith('mysql')) {
    supportExtrasEnsured = true;
    return;
  }
  try {
    const cols = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_message_threads'`,
    );
    const names = new Set(cols.map((c) => c.COLUMN_NAME));
    if (!names.has('status')) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE user_message_threads ADD COLUMN status VARCHAR(32) NULL`,
      );
    } else {
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE user_message_threads MODIFY COLUMN status VARCHAR(32) NULL`,
        );
      } catch {
        /* already wide enough or no permission */
      }
    }
    if (!names.has('likeCount')) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE user_message_threads ADD COLUMN likeCount INT NOT NULL DEFAULT 0`,
      );
    }
    if (!names.has('dislikeCount')) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE user_message_threads ADD COLUMN dislikeCount INT NOT NULL DEFAULT 0`,
      );
    }
    if (!names.has('imageUrls')) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE user_message_threads ADD COLUMN imageUrls TEXT NULL`,
      );
    }
    if (!names.has('isInappropriate')) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE user_message_threads ADD COLUMN isInappropriate BOOLEAN NOT NULL DEFAULT 0`,
      );
    }

    const tables = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_message_thread_likes' LIMIT 1`,
    );
    if (!tables.length) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE user_message_thread_likes (
          id VARCHAR(191) NOT NULL,
          threadId VARCHAR(191) NOT NULL,
          userId VARCHAR(191) NOT NULL,
          reaction VARCHAR(1) NOT NULL,
          createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updatedAt DATETIME(3) NOT NULL,
          PRIMARY KEY (id),
          UNIQUE INDEX user_message_thread_likes_threadId_userId_key (threadId, userId),
          INDEX user_message_thread_likes_userId_idx (userId),
          CONSTRAINT user_message_thread_likes_threadId_fkey
            FOREIGN KEY (threadId) REFERENCES user_message_threads(id) ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT user_message_thread_likes_userId_fkey
            FOREIGN KEY (userId) REFERENCES users_new(id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    }
    supportExtrasEnsured = true;
  } catch (err) {
    console.error('ensureSupportThreadExtras failed:', err);
  }
}

export type ThreadReactionResult = {
  likeCount: number;
  dislikeCount: number;
  myReaction: 'L' | 'D' | null;
};

/** Toggle like/dislike. Same reaction again removes it (−1). Opposite switches. */
export async function toggleThreadReaction(
  threadId: string,
  userId: string,
  reaction: 'L' | 'D',
): Promise<ThreadReactionResult | null> {
  await ensureSupportThreadExtras();

  const threads = await prisma.$queryRawUnsafe<
    Array<{ id: string; likeCount: number | null; dislikeCount: number | null }>
  >(`SELECT id, likeCount, dislikeCount FROM user_message_threads WHERE id = ? LIMIT 1`, threadId);
  const thread = threads[0];
  if (!thread) return null;

  const existingRows = await prisma.$queryRawUnsafe<Array<{ id: string; reaction: string }>>(
    `SELECT id, reaction FROM user_message_thread_likes WHERE threadId = ? AND userId = ? LIMIT 1`,
    threadId,
    userId,
  );
  const existing = existingRows[0];

  let likeCount = Number(thread.likeCount ?? 0);
  let dislikeCount = Number(thread.dislikeCount ?? 0);
  let myReaction: 'L' | 'D' | null = null;

  if (existing) {
    if (existing.reaction === reaction) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM user_message_thread_likes WHERE id = ?`,
        existing.id,
      );
      if (reaction === 'L') likeCount = Math.max(0, likeCount - 1);
      else dislikeCount = Math.max(0, dislikeCount - 1);
      myReaction = null;
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE user_message_thread_likes SET reaction = ?, updatedAt = NOW(3) WHERE id = ?`,
        reaction,
        existing.id,
      );
      if (reaction === 'L') {
        likeCount += 1;
        dislikeCount = Math.max(0, dislikeCount - 1);
      } else {
        dislikeCount += 1;
        likeCount = Math.max(0, likeCount - 1);
      }
      myReaction = reaction;
    }
  } else {
    const id = `uml_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO user_message_thread_likes (id, threadId, userId, reaction, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, NOW(3), NOW(3))`,
      id,
      threadId,
      userId,
      reaction,
    );
    if (reaction === 'L') likeCount += 1;
    else dislikeCount += 1;
    myReaction = reaction;
  }

  await prisma.$executeRawUnsafe(
    `UPDATE user_message_threads SET likeCount = ?, dislikeCount = ? WHERE id = ?`,
    likeCount,
    dislikeCount,
    threadId,
  );

  return { likeCount, dislikeCount, myReaction };
}
