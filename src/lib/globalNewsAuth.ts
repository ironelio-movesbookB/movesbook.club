import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** Bearer token must belong to an active super_admins row (Admin Management login). */
export async function requireTableSuperAdmin(
  request: NextRequest,
): Promise<{ superAdminId: string } | NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = verifyToken(authHeader.slice(7));
  if (!decoded?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const superAdmin = await prisma.superAdmin.findFirst({
    where: { id: decoded.userId, isActive: true },
    select: { id: true },
  });
  if (superAdmin) return { superAdminId: superAdmin.id };

  return NextResponse.json({ error: 'Super admin only' }, { status: 403 });
}

export type GlobalNewsFeedItem =
  | {
      kind: 'news';
      id: string;
      title: string | null;
      date: string;
      author: string | null;
      categoryName: string | null;
      method: string | null;
      image: string | null;
      briefDesc: string | null;
      internetLink: string | null;
      /** Creator user id for posted-by filters. */
      posterUserId: string | null;
      creatorCountry: string | null;
      expiresAt: string | null;
      deletedAt: string | null;
      inGlobalNews: true;
    }
  | {
      kind: 'ogp';
      id: string;
      title: string | null;
      date: string;
      topic: string;
      creatorUsername: string | null;
      image: string | null;
      url: string;
      description: string | null;
      customDescription: string | null;
      /** Creator user id for posted-by filters. */
      posterUserId: string | null;
      creatorCountry: string | null;
      expiresAt: string | null;
      deletedAt: string | null;
      inGlobalNews: true;
    }
  | {
      kind: 'ogp-group';
      id: string;
      title: string | null;
      date: string;
      topic: string;
      creatorUsername: string | null;
      image: string | null;
      url: string;
      description: string | null;
      customDescription: string | null;
      memberCount: number;
      /** Creator user id for posted-by filters. */
      posterUserId: string | null;
      creatorCountry: string | null;
      expiresAt: string | null;
      deletedAt: string | null;
      inGlobalNews: true;
    };

export type FetchGlobalNewsOptions = {
  /** When true, include soft-deleted OGP / OGP groups (for Show deleted filters). */
  includeDeleted?: boolean;
};

/** Merged News + OGP + OGP groups marked for Global News, newest first. */
export async function fetchGlobalNewsFeedItems(
  options: FetchGlobalNewsOptions = {},
): Promise<GlobalNewsFeedItem[]> {
  const includeDeleted = options.includeDeleted === true;

  const [newsRows, ogpRows, globalGroupIds] = await Promise.all([
    prisma.news.findMany({
      where: { inGlobalNews: true } as { inGlobalNews: boolean },
      orderBy: { date: 'desc' },
      include: {
        category: { select: { categoryName: true } },
      },
    }),
    prisma.ogpArticle.findMany({
      where: includeDeleted
        ? ({ inGlobalNews: true } as { inGlobalNews: boolean })
        : ({ inGlobalNews: true, deletedAt: null } as {
            inGlobalNews: boolean;
            deletedAt: null;
          }),
      orderBy: { savedAt: 'desc' },
      include: {
        user: { select: { username: true, country: true } },
      },
    }),
    // Raw id lookup so this works before/without a Prisma client regenerate for inGlobalNews.
    includeDeleted
      ? prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM ogp_news_groups
          WHERE inGlobalNews = true
          ORDER BY savedAt DESC
        `
      : prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM ogp_news_groups
          WHERE inGlobalNews = true AND deletedAt IS NULL
          ORDER BY savedAt DESC
        `,
  ]);

  const ogpGroupRows =
    globalGroupIds.length > 0
      ? await prisma.ogpNewsGroup.findMany({
          where: { id: { in: globalGroupIds.map((r) => r.id) } },
          orderBy: { savedAt: 'desc' },
          include: {
            user: { select: { username: true, country: true } },
            items: {
              orderBy: [{ sortOrder: 'asc' }, { addedAt: 'asc' }],
              take: 1,
              include: {
                ogpArticle: {
                  select: {
                    title: true,
                    image: true,
                    description: true,
                    customDescription: true,
                  },
                },
              },
            },
            _count: { select: { items: true } },
          },
        })
      : [];

  // News has userId but no Prisma User relation — resolve countries in one lookup.
  const newsUserIds = [
    ...new Set(newsRows.map((n) => n.userId).filter((id): id is string => Boolean(id))),
  ];
  const newsUsers =
    newsUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: newsUserIds } },
          select: { id: true, country: true },
        })
      : [];
  const newsCountryByUserId = new Map(
    newsUsers.map((u) => [u.id, u.country ?? null] as const),
  );

  const items: GlobalNewsFeedItem[] = [
    ...newsRows.map((n) => ({
      kind: 'news' as const,
      id: n.id,
      title: n.title,
      date: n.date.toISOString(),
      author: n.author ?? n.originalAuthor,
      categoryName: n.category?.categoryName ?? null,
      method: n.method,
      image: n.image,
      briefDesc: n.briefDesc,
      internetLink: n.internetLink,
      posterUserId: n.userId ?? null,
      creatorCountry: n.userId ? (newsCountryByUserId.get(n.userId) ?? null) : null,
      expiresAt: null,
      deletedAt: null,
      inGlobalNews: true as const,
    })),
    ...ogpRows.map((a) => ({
      kind: 'ogp' as const,
      id: a.id,
      title: a.title,
      date: a.savedAt.toISOString(),
      topic: a.topic,
      creatorUsername: a.user?.username ?? null,
      image: a.image,
      url: a.url,
      description: a.description,
      customDescription: a.customDescription,
      posterUserId: a.userId ?? null,
      creatorCountry: a.user?.country ?? null,
      expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
      deletedAt: a.deletedAt ? a.deletedAt.toISOString() : null,
      inGlobalNews: true as const,
    })),
    ...ogpGroupRows.map((g) => {
      const first = g.items[0]?.ogpArticle ?? null;
      return {
        kind: 'ogp-group' as const,
        id: g.id,
        title: first?.title ?? g.name,
        date: g.savedAt.toISOString(),
        topic: g.topic,
        creatorUsername: g.user?.username ?? null,
        image: g.coverImage ?? first?.image ?? null,
        url: `/news/group/${g.id}`,
        description: first?.description ?? null,
        customDescription: g.customDescription ?? first?.customDescription ?? null,
        memberCount: g._count.items,
        posterUserId: g.userId ?? null,
        creatorCountry: g.user?.country ?? null,
        expiresAt: g.expiresAt ? g.expiresAt.toISOString() : null,
        deletedAt: g.deletedAt ? g.deletedAt.toISOString() : null,
        inGlobalNews: true as const,
      };
    }),
  ];

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return items;
}
