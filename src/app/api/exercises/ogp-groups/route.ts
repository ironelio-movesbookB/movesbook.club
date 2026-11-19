import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  requireAuthWithUser,
  requireAuthForNews,
  getOrCreateUserForSuperAdmin,
  getSuperAdminCreatorIds,
} from '../auth';
import { requireCategory } from '../category';

function mapGroupResponse(
  g: {
    id: string;
    userId: string;
    name: string;
    category: string;
    topic: string;
    customDescription: string | null;
    coverImage: string | null;
    savedAt: Date;
    expiresAt: Date | null;
    deletedAt: Date | null;
    inGlobalNews?: boolean;
    visibilityUserTypes: string | null;
    visibilityCountries: string | null;
    visibilityLanguages: string | null;
    visibilitySports: string | null;
    user: { username: string; name: string | null; country: string | null } | null;
    items: Array<{
      exerciseOgpArticleId: string;
      sortOrder: number;
      addedAt: Date;
      exerciseOgpArticle: {
        id: string;
        title: string | null;
        image: string | null;
        description: string | null;
        url: string;
        siteName: string | null;
        type: string | null;
        customDescription: string | null;
        topic: string;
        category: string;
        languageCode: string | null;
        savedAt: Date;
        deletedAt: Date | null;
        user: { username: string; country: string | null } | null;
      };
    }>;
  },
  currentUserId: string,
  superAdminEffectiveUserId: string | null,
  createdBySuperAdmin = false
) {
  const sortedItems = [...g.items].sort((a, b) => a.sortOrder - b.sortOrder || a.addedAt.getTime() - b.addedAt.getTime());
  const first = sortedItems[0]?.exerciseOgpArticle ?? null;
  const createdByCurrentUser =
    g.userId === currentUserId ||
    (superAdminEffectiveUserId != null && g.userId === superAdminEffectiveUserId);

  const creatorName =
    (g.user?.name && g.user.name.trim()) ||
    g.user?.username ||
    null;

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
    category: g.category,
    topic: g.topic,
    savedAt: g.savedAt.toISOString(),
    memberCount: sortedItems.length,
    memberIds: sortedItems.map((i) => i.exerciseOgpArticleId),
    creatorUsername: g.user?.username ?? null,
    creatorName,
    creatorCountry: g.user?.country ?? null,
    createdByCurrentUser,
    createdBySuperAdmin,
    customDescription: g.customDescription ?? first?.customDescription ?? null,
    coverImage: g.coverImage ?? null,
    deletedAt: g.deletedAt?.toISOString() ?? null,
    inGlobalNews: g.inGlobalNews === true,
    visibilityUserTypes: parseVis(g.visibilityUserTypes),
    visibilityCountries: parseVis(g.visibilityCountries),
    visibilityLanguages: parseVis(g.visibilityLanguages),
    visibilitySports: parseVis(g.visibilitySports),
    expiresAt: g.expiresAt?.toISOString() ?? null,
    // Custom cover when set; otherwise preview from the 1st OGP in the group
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
      exerciseOgpArticle: {
        include: {
          user: { select: { username: true, country: true } },
        },
      },
    },
  },
} as const;

/** GET /api/exercises/ogp-groups — list OGP Exercise groups (requires category; optionally by topic). */
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
  const category = requireCategory(searchParams.get('category'));
  if (category instanceof NextResponse) return category;
  const topic = searchParams.get('topic')?.trim() || null;

  try {
    const groups = await prisma.exerciseOgpGroup.findMany({
      where: topic ? { category, topic } : { category },
      orderBy: { savedAt: 'desc' },
      include: groupInclude,
    });

    // Enrich with inGlobalNews (column may exist before Prisma client is regenerated).
    let globalFlags: Array<{ id: string; inGlobalNews: number | boolean }> = [];
    if (groups.length > 0) {
      try {
        globalFlags = await prisma.$queryRaw<Array<{ id: string; inGlobalNews: number | boolean }>>`
          SELECT id, inGlobalNews FROM exercise_ogp_groups
          WHERE id IN (${Prisma.join(groups.map((g) => g.id))})
        `;
      } catch (e) {
        console.warn('GET /api/exercises/ogp-groups: inGlobalNews column read failed', e);
      }
    }
    const globalById = new Map(
      globalFlags.map((r) => [r.id, r.inGlobalNews === true || r.inGlobalNews === 1]),
    );
    const superAdminCreatorIds = await getSuperAdminCreatorIds();

    return NextResponse.json(
      groups.map((g) =>
        mapGroupResponse(
          { ...g, inGlobalNews: globalById.get(g.id) === true },
          currentUserId,
          superAdminEffectiveUserId,
          superAdminCreatorIds.includes(g.userId),
        ),
      ),
    );
  } catch (e) {
    console.error('GET /api/exercises/ogp-groups', e);
    return NextResponse.json({ error: 'Failed to load OGP exercise groups' }, { status: 500 });
  }
}

/**
 * POST /api/exercises/ogp-groups — create a group or merge into an existing one by name+category.
 * Body: { name, category, topic, articleIds: string[], confirmExisting?: boolean, coverImage?: string | null }
 * If name exists and confirmExisting is not true → 409 { exists: true, group }
 */
export async function POST(request: NextRequest) {
  // requireAuthForNews already resolves SuperAdmin → users_new id.
  const auth = await requireAuthForNews(request);
  if (auth instanceof NextResponse) return auth;

  if ((auth.userType ?? '').toUpperCase() === 'ATHLETE') {
    return NextResponse.json(
      { error: 'Athletes cannot create OGP exercises' },
      { status: 403 }
    );
  }

  const userId = auth.userId;

  try {
    const body = await request.json();
    const category = requireCategory(body.category);
    if (category instanceof NextResponse) return category;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    const confirmExisting = body.confirmExisting === true;
    const coverImage =
      typeof body.coverImage === 'string' && body.coverImage.trim()
        ? body.coverImage.trim()
        : null;
    const rawIds = Array.isArray(body.articleIds) ? body.articleIds : [];
    const articleIds = [
      ...new Set(
        rawIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim() !== '')
      ),
    ];

    if (!name) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }
    if (!topic) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }
    if (articleIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one OGP Exercise' }, { status: 400 });
    }

    const articles = await prisma.exerciseOgpArticle.findMany({
      where: { id: { in: articleIds }, category },
      select: { id: true },
    });
    if (articles.length !== articleIds.length) {
      return NextResponse.json({ error: 'One or more OGP Exercises were not found' }, { status: 400 });
    }

    const existing = await prisma.exerciseOgpGroup.findUnique({
      where: { userId_category_name: { userId, category, name } },
      include: groupInclude,
    });

    if (existing && !confirmExisting) {
      return NextResponse.json(
        {
          exists: true,
          message: `A group named "${name}" already exists. Confirm to add the selected OGP Exercises to it, or change the name.`,
          group: mapGroupResponse(existing, userId, null, auth.isSuperAdmin),
        },
        { status: 409 }
      );
    }

    const now = new Date();

    if (existing && confirmExisting) {
      // Merge: update dates for existing members; add new ones. Preserve selection order.
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < articleIds.length; i++) {
          const exerciseOgpArticleId = articleIds[i];
          const row = await tx.exerciseOgpGroupItem.findUnique({
            where: { groupId_exerciseOgpArticleId: { groupId: existing.id, exerciseOgpArticleId } },
          });
          if (row) {
            await tx.exerciseOgpGroupItem.update({
              where: { id: row.id },
              data: { addedAt: now, sortOrder: i },
            });
          } else {
            await tx.exerciseOgpGroupItem.create({
              data: { groupId: existing.id, exerciseOgpArticleId, sortOrder: i, addedAt: now },
            });
          }
        }
        await tx.exerciseOgpGroup.update({
          where: { id: existing.id },
          data: {
            topic,
            savedAt: now,
            ...(coverImage ? { coverImage } : {}),
          },
        });
      });

      const updated = await prisma.exerciseOgpGroup.findUniqueOrThrow({
        where: { id: existing.id },
        include: groupInclude,
      });
      return NextResponse.json({
        ok: true,
        merged: true,
        group: mapGroupResponse(updated, userId, null, auth.isSuperAdmin),
      });
    }

    const created = await prisma.exerciseOgpGroup.create({
      data: {
        userId,
        name,
        category,
        topic,
        coverImage,
        savedAt: now,
        items: {
          create: articleIds.map((exerciseOgpArticleId, i) => ({
            exerciseOgpArticleId,
            sortOrder: i,
            addedAt: now,
          })),
        },
      },
      include: groupInclude,
    });

    return NextResponse.json(
      {
        ok: true,
        merged: false,
        group: mapGroupResponse(created, userId, null, auth.isSuperAdmin),
      },
      { status: 201 }
    );
  } catch (e) {
    console.error('POST /api/exercises/ogp-groups', e);
    return NextResponse.json({ error: 'Failed to save OGP exercise group' }, { status: 500 });
  }
}
