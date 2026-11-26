import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTableSuperAdmin } from '@/lib/globalNewsAuth';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/news/entity?type=club|team|coach|group&id=...&feed=global|news|ogp
 *
 * Super admin "News from clubs": read-only view of the News / OGP News of a
 * selected club, team, coach or group.
 *  - club:  items shared into the club (club_shared_* tables); "global" = promoted to Club Global News.
 *  - coach: News / OGP News / OGP groups created by the coach user.
 *  - team / group: News / OGP News / OGP groups created by the team / group admin.
 *    "global" = the owner's items shared in Movesbook Global News.
 */

type EntityType = 'club' | 'team' | 'coach' | 'group';
type FeedType = 'global' | 'news' | 'ogp';

export type EntityNewsItem =
  | {
      kind: 'news';
      id: string;
      title: string | null;
      date: string;
      image: string | null;
      author: string | null;
      categoryName: string | null;
      method: string | null;
      briefDesc: string | null;
      internetLink: string | null;
    }
  | {
      kind: 'ogp' | 'ogp-group';
      id: string;
      title: string | null;
      date: string;
      image: string | null;
      topic: string;
      creatorUsername: string | null;
      url: string;
      description: string | null;
      customDescription: string | null;
      memberCount?: number;
      expiresAt: string | null;
    };

const ENTITY_TYPES: EntityType[] = ['club', 'team', 'coach', 'group'];
const FEED_TYPES: FeedType[] = ['global', 'news', 'ogp'];
const MAX_ITEMS = 300;

const newsSelect = {
  id: true,
  title: true,
  date: true,
  image: true,
  author: true,
  originalAuthor: true,
  method: true,
  briefDesc: true,
  internetLink: true,
  category: { select: { categoryName: true } },
} satisfies Prisma.NewsSelect;

type NewsRow = {
  id: string;
  title: string | null;
  date: Date;
  image: string | null;
  author: string | null;
  originalAuthor: string | null;
  method: string | null;
  briefDesc: string | null;
  internetLink: string | null;
  category: { categoryName: string } | null;
};

function mapNews(n: NewsRow): EntityNewsItem {
  return {
    kind: 'news',
    id: n.id,
    title: n.title,
    date: n.date.toISOString(),
    image: n.image,
    author: n.author ?? n.originalAuthor,
    categoryName: n.category?.categoryName ?? null,
    method: n.method,
    briefDesc: n.briefDesc,
    internetLink: n.internetLink,
  };
}

const ogpSelect = {
  id: true,
  title: true,
  savedAt: true,
  image: true,
  topic: true,
  url: true,
  description: true,
  customDescription: true,
  expiresAt: true,
  deletedAt: true,
  user: { select: { username: true } },
} satisfies Prisma.OgpArticleSelect;

type OgpRow = {
  id: string;
  title: string | null;
  savedAt: Date;
  image: string | null;
  topic: string;
  url: string;
  description: string | null;
  customDescription: string | null;
  expiresAt: Date | null;
  user: { username: string } | null;
};

function mapOgp(a: OgpRow): EntityNewsItem {
  return {
    kind: 'ogp',
    id: a.id,
    title: a.title,
    date: a.savedAt.toISOString(),
    image: a.image,
    topic: a.topic,
    creatorUsername: a.user?.username ?? null,
    url: a.url,
    description: a.description,
    customDescription: a.customDescription,
    expiresAt: a.expiresAt?.toISOString() ?? null,
  };
}

const groupSelect = {
  id: true,
  name: true,
  topic: true,
  savedAt: true,
  coverImage: true,
  customDescription: true,
  expiresAt: true,
  deletedAt: true,
  user: { select: { username: true } },
  items: {
    orderBy: [{ sortOrder: 'asc' }, { addedAt: 'asc' }],
    take: 1,
    select: {
      ogpArticle: {
        select: { title: true, image: true, description: true, url: true, customDescription: true },
      },
    },
  },
  _count: { select: { items: true } },
} satisfies Prisma.OgpNewsGroupSelect;

type GroupRow = {
  id: string;
  name: string;
  topic: string;
  savedAt: Date;
  coverImage: string | null;
  customDescription: string | null;
  expiresAt: Date | null;
  user: { username: string } | null;
  items: {
    ogpArticle: {
      title: string | null;
      image: string | null;
      description: string | null;
      url: string;
      customDescription: string | null;
    };
  }[];
  _count: { items: number };
};

function mapGroup(g: GroupRow): EntityNewsItem {
  const first = g.items[0]?.ogpArticle ?? null;
  return {
    kind: 'ogp-group',
    id: g.id,
    title: g.name || first?.title || null,
    date: g.savedAt.toISOString(),
    image: g.coverImage ?? first?.image ?? null,
    topic: g.topic,
    creatorUsername: g.user?.username ?? null,
    url: first?.url ?? '',
    description: first?.description ?? null,
    customDescription: g.customDescription ?? first?.customDescription ?? null,
    memberCount: g._count.items,
    expiresAt: g.expiresAt?.toISOString() ?? null,
  };
}

async function loadClubFeed(clubId: string, feed: FeedType): Promise<EntityNewsItem[]> {
  const shareWhere = feed === 'global' ? { clubId, inClubGlobalNews: true } : { clubId };
  const wantNews = feed !== 'ogp';
  const wantOgp = feed !== 'news';

  const [newsShares, ogpShares, groupShares] = await Promise.all([
    wantNews
      ? prisma.clubSharedNews.findMany({
          where: shareWhere,
          orderBy: { createdAt: 'desc' },
          take: MAX_ITEMS,
          select: { news: { select: newsSelect } },
        })
      : Promise.resolve([]),
    wantOgp
      ? prisma.clubSharedOgpArticle.findMany({
          where: { ...shareWhere, ogpArticle: { deletedAt: null } },
          orderBy: { createdAt: 'desc' },
          take: MAX_ITEMS,
          select: { ogpArticle: { select: ogpSelect } },
        })
      : Promise.resolve([]),
    wantOgp
      ? prisma.clubSharedOgpGroup.findMany({
          where: { ...shareWhere, ogpNewsGroup: { deletedAt: null } },
          orderBy: { createdAt: 'desc' },
          take: MAX_ITEMS,
          select: { ogpNewsGroup: { select: groupSelect } },
        })
      : Promise.resolve([]),
  ]);

  return [
    ...newsShares.map((r) => mapNews(r.news)),
    ...ogpShares.map((r) => mapOgp(r.ogpArticle)),
    ...groupShares.map((r) => mapGroup(r.ogpNewsGroup)),
  ];
}

async function loadUserFeed(userId: string, feed: FeedType): Promise<EntityNewsItem[]> {
  const globalOnly = feed === 'global';
  const wantNews = feed !== 'ogp';
  const wantOgp = feed !== 'news';

  const [news, ogp, groups] = await Promise.all([
    wantNews
      ? prisma.news.findMany({
          where: { userId, ...(globalOnly ? { inGlobalNews: true } : {}) },
          orderBy: { date: 'desc' },
          take: MAX_ITEMS,
          select: newsSelect,
        })
      : Promise.resolve([]),
    wantOgp
      ? prisma.ogpArticle.findMany({
          where: { userId, deletedAt: null, ...(globalOnly ? { inGlobalNews: true } : {}) },
          orderBy: { savedAt: 'desc' },
          take: MAX_ITEMS,
          select: ogpSelect,
        })
      : Promise.resolve([]),
    wantOgp
      ? prisma.ogpNewsGroup.findMany({
          where: { userId, deletedAt: null, ...(globalOnly ? { inGlobalNews: true } : {}) },
          orderBy: { savedAt: 'desc' },
          take: MAX_ITEMS,
          select: groupSelect,
        })
      : Promise.resolve([]),
  ]);

  return [...news.map(mapNews), ...ogp.map(mapOgp), ...groups.map(mapGroup)];
}

export async function GET(request: NextRequest) {
  const auth = await requireTableSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const params = request.nextUrl.searchParams;
  const type = params.get('type') as EntityType | null;
  const id = params.get('id')?.trim() ?? '';
  const feed = (params.get('feed') ?? 'global') as FeedType;

  if (!type || !ENTITY_TYPES.includes(type) || !id) {
    return NextResponse.json({ error: 'Invalid type or id' }, { status: 400 });
  }
  if (!FEED_TYPES.includes(feed)) {
    return NextResponse.json({ error: 'Invalid feed' }, { status: 400 });
  }

  try {
    let entity: { id: string; type: EntityType; name: string; ownerUsername: string | null } | null =
      null;
    let items: EntityNewsItem[] = [];

    if (type === 'club') {
      const club = await prisma.club.findUnique({
        where: { id },
        select: { id: true, name: true, admin: { select: { username: true } } },
      });
      if (club) {
        entity = { id: club.id, type, name: club.name, ownerUsername: club.admin?.username ?? null };
        items = await loadClubFeed(club.id, feed);
      }
    } else if (type === 'team' || type === 'group') {
      const row =
        type === 'team'
          ? await prisma.team.findUnique({
              where: { id },
              select: { id: true, name: true, adminId: true, admin: { select: { username: true } } },
            })
          : await prisma.group.findUnique({
              where: { id },
              select: { id: true, name: true, adminId: true, admin: { select: { username: true } } },
            });
      if (row) {
        entity = { id: row.id, type, name: row.name, ownerUsername: row.admin?.username ?? null };
        items = await loadUserFeed(row.adminId, feed);
      }
    } else {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, username: true },
      });
      if (user) {
        entity = {
          id: user.id,
          type,
          name: user.name?.trim() || user.username,
          ownerUsername: user.username,
        };
        items = await loadUserFeed(user.id, feed);
      }
    }

    if (!entity) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ entity, feed, items });
  } catch (e) {
    console.error('GET /api/admin/news/entity', e);
    return NextResponse.json({ error: 'Failed to load news' }, { status: 500 });
  }
}
