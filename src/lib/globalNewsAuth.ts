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
      inGlobalNews: true;
    };

/** Merged News + OGP + OGP groups marked for Global News, newest first. */
export async function fetchGlobalNewsFeedItems(): Promise<GlobalNewsFeedItem[]> {
  const [newsRows, ogpRows, globalGroupIds] = await Promise.all([
    prisma.news.findMany({
      where: { inGlobalNews: true } as { inGlobalNews: boolean },
      orderBy: { date: 'desc' },
      include: {
        category: { select: { categoryName: true } },
      },
    }),
    prisma.ogpArticle.findMany({
      where: { inGlobalNews: true, deletedAt: null } as {
        inGlobalNews: boolean;
        deletedAt: null;
      },
      orderBy: { savedAt: 'desc' },
      include: {
        user: { select: { username: true } },
      },
    }),
    // Raw id lookup so this works before/without a Prisma client regenerate for inGlobalNews.
    prisma.$queryRaw<Array<{ id: string }>>`
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
            user: { select: { username: true } },
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
        inGlobalNews: true as const,
      };
    }),
  ];

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return items;
}
