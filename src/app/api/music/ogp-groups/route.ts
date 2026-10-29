import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithUser, requireAuthForNews, getOrCreateUserForSuperAdmin } from '../auth';

function mapGroupResponse(
  g: {
    id: string;
    userId: string;
    name: string;
    topic: string;
    customDescription: string | null;
    coverImage: string | null;
    savedAt: Date;
    expiresAt: Date | null;
    deletedAt: Date | null;
    visibilityUserTypes: string | null;
    visibilityCountries: string | null;
    visibilityLanguages: string | null;
    visibilitySports: string | null;
    user: { username: string; name: string | null; country: string | null } | null;
    items: Array<{
      musicOgpArticleId: string;
      sortOrder: number;
      addedAt: Date;
      musicOgpArticle: {
        id: string;
        title: string | null;
        image: string | null;
        description: string | null;
        url: string;
        siteName: string | null;
        type: string | null;
        customDescription: string | null;
        topic: string;
        languageCode: string | null;
        savedAt: Date;
        deletedAt: Date | null;
        user: { username: string; country: string | null } | null;
      };
    }>;
  },
  currentUserId: string,
  superAdminEffectiveUserId: string | null
) {
  const sortedItems = [...g.items].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.addedAt.getTime() - b.addedAt.getTime()
  );
  const first = sortedItems[0]?.musicOgpArticle ?? null;
  const createdByCurrentUser =
    g.userId === currentUserId ||
    (superAdminEffectiveUserId != null && g.userId === superAdminEffectiveUserId);

  const creatorName =
    (g.user?.name && g.user.name.trim()) || g.user?.username || null;

  const parseVis = (str: string | null | undefined): string[] => {
    if (str == null || str === '') return [];
    try {
      const a = JSON.parse(str);
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  };

  return {
    id: g.id,
    userId: g.userId,
    name: g.name,
    topic: g.topic,
    savedAt: g.savedAt.toISOString(),
    memberCount: sortedItems.length,
    memberIds: sortedItems.map((i) => i.musicOgpArticleId),
    creatorUsername: g.user?.username ?? null,
    creatorName,
    creatorCountry: g.user?.country ?? null,
    createdByCurrentUser,
    customDescription: g.customDescription ?? first?.customDescription ?? null,
    coverImage: g.coverImage ?? null,
    deletedAt: g.deletedAt?.toISOString() ?? null,
    visibilityUserTypes: parseVis(g.visibilityUserTypes),
    visibilityCountries: parseVis(g.visibilityCountries),
    visibilityLanguages: parseVis(g.visibilityLanguages),
    visibilitySports: parseVis(g.visibilitySports),
    expiresAt: g.expiresAt?.toISOString() ?? null,
    title: first?.title ?? g.name,
    image: g.coverImage ?? first?.image ?? null,
    description: first?.description ?? null,
    url: first?.url ?? '',
    siteName: first?.siteName ?? null,
    type: first?.type ?? null,
    languageCode: first?.languageCode ?? null,
    previewTopic: first?.topic ?? g.topic,
    previewCreatorUsername: first?.user?.username ?? g.user?.username ?? null,
  };
}

const groupInclude = {
  user: { select: { username: true, name: true, country: true } },
  items: {
    include: {
      musicOgpArticle: {
        include: {
          user: { select: { username: true, country: true } },
        },
      },
    },
  },
} as const;

/** GET /api/music/ogp-groups — list OGP Music groups (optionally by topic). */
export async function GET(request: NextRequest) {
  const auth = await requireAuthWithUser(request);
  if (auth instanceof NextResponse) return auth;

  let currentUserId = auth.userId;
  let superAdminEffectiveUserId: string | null = null;
  if (auth.isSuperAdmin) {
    superAdminEffectiveUserId = await getOrCreateUserForSuperAdmin(auth.userId);
    currentUserId = superAdminEffectiveUserId;
  }

  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic')?.trim() || null;

  try {
    const groups = await prisma.musicOgpGroup.findMany({
      where: topic ? { topic } : undefined,
      orderBy: { savedAt: 'desc' },
      include: groupInclude,
    });

    return NextResponse.json(
      groups.map((g) => mapGroupResponse(g, currentUserId, superAdminEffectiveUserId))
    );
  } catch (e) {
    console.error('GET /api/music/ogp-groups', e);
    return NextResponse.json({ error: 'Failed to load OGP music groups' }, { status: 500 });
  }
}

/**
 * POST /api/music/ogp-groups — create a group or merge into an existing one by name.
 * Body: { name, topic, articleIds: string[], confirmExisting?: boolean, coverImage?: string | null }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuthForNews(request);
  if (auth instanceof NextResponse) return auth;

  const userId = auth.userId;

  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    const confirmExisting = body.confirmExisting === true;
    const coverImage =
      typeof body.coverImage === 'string' && body.coverImage.trim()
        ? body.coverImage.trim()
        : null;
    const rawIds = Array.isArray(body.articleIds) ? body.articleIds : [];
    const articleIds: string[] = Array.from(
      new Set(
        rawIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim() !== '')
      )
    );

    if (!name) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }
    if (!topic) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }
    if (articleIds.length < 2) {
      return NextResponse.json(
        { error: 'Select at least two OGP Music items to create a group' },
        { status: 400 }
      );
    }

    const articles = await prisma.musicOgpArticle.findMany({
      where: { id: { in: articleIds } },
      select: { id: true },
    });
    if (articles.length !== articleIds.length) {
      return NextResponse.json({ error: 'One or more OGP Music were not found' }, { status: 400 });
    }

    const existing = await prisma.musicOgpGroup.findUnique({
      where: { userId_name: { userId, name } },
      include: groupInclude,
    });

    if (existing && !confirmExisting) {
      return NextResponse.json(
        {
          exists: true,
          message: `A group named "${name}" already exists. Confirm to add the selected OGP Music to it, or change the name.`,
          group: mapGroupResponse(existing, userId, null),
        },
        { status: 409 }
      );
    }

    const now = new Date();

    if (existing && confirmExisting) {
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < articleIds.length; i++) {
          const musicOgpArticleId = articleIds[i];
          const row = await tx.musicOgpGroupItem.findUnique({
            where: { groupId_musicOgpArticleId: { groupId: existing.id, musicOgpArticleId } },
          });
          if (row) {
            await tx.musicOgpGroupItem.update({
              where: { id: row.id },
              data: { addedAt: now, sortOrder: i },
            });
          } else {
            await tx.musicOgpGroupItem.create({
              data: { groupId: existing.id, musicOgpArticleId, sortOrder: i, addedAt: now },
            });
          }
        }
        await tx.musicOgpGroup.update({
          where: { id: existing.id },
          data: {
            topic,
            savedAt: now,
            ...(coverImage ? { coverImage } : {}),
          },
        });
      });

      const updated = await prisma.musicOgpGroup.findUniqueOrThrow({
        where: { id: existing.id },
        include: groupInclude,
      });
      return NextResponse.json({
        ok: true,
        merged: true,
        group: mapGroupResponse(updated, userId, null),
      });
    }

    const created = await prisma.musicOgpGroup.create({
      data: {
        userId,
        name,
        topic,
        coverImage,
        savedAt: now,
        items: {
          create: articleIds.map((musicOgpArticleId, i) => ({
            musicOgpArticleId,
            sortOrder: i,
            addedAt: now,
          })),
        },
      },
      include: groupInclude,
    });

    return NextResponse.json(
      { ok: true, merged: false, group: mapGroupResponse(created, userId, null) },
      { status: 201 }
    );
  } catch (e) {
    console.error('POST /api/music/ogp-groups', e);
    return NextResponse.json({ error: 'Failed to save OGP music group' }, { status: 500 });
  }
}
