import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAuthWithUser, requireAuthForNews, getOrCreateUserForSuperAdmin, getSuperAdminCreatorIds } from '../auth';
import { requireCategory } from '../category';

function parseJsonArray(str: string | null | undefined): string[] {
  if (str == null || str === '') return [];
  try {
    const a = JSON.parse(str);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

/** Load typology / sportEquipment even if Prisma client is stale (before regenerate). */
async function loadExerciseOgpExtraFields(
  ids: string[]
): Promise<Map<string, { typology: string | null; sportEquipment: string | null }>> {
  const map = new Map<string, { typology: string | null; sportEquipment: string | null }>();
  if (ids.length === 0) return map;
  try {
    const rows = await prisma.$queryRaw<
      { id: string; typology: string | null; sportEquipment: string | null }[]
    >`
      SELECT id, typology, sportEquipment FROM exercise_ogp_articles WHERE id IN (${Prisma.join(ids)})
    `;
    for (const row of rows) {
      map.set(row.id, {
        typology: row.typology ?? null,
        sportEquipment: row.sportEquipment ?? null,
      });
    }
  } catch (e) {
    // Fallback if sportEquipment column does not exist yet.
    try {
      const rows = await prisma.$queryRaw<{ id: string; typology: string | null }[]>`
        SELECT id, typology FROM exercise_ogp_articles WHERE id IN (${Prisma.join(ids)})
      `;
      for (const row of rows) {
        map.set(row.id, { typology: row.typology ?? null, sportEquipment: null });
      }
    } catch (e2) {
      console.warn('GET /api/exercises/ogp: typology/sportEquipment column read failed', e2 ?? e);
    }
  }
  return map;
}

/** Load inGlobalNews even if Prisma client is stale (before regenerate). */
async function loadExerciseOgpGlobalFlags(ids: string[]): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (ids.length === 0) return map;
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string; inGlobalNews: number | boolean }>>`
      SELECT id, inGlobalNews FROM exercise_ogp_articles WHERE id IN (${Prisma.join(ids)})
    `;
    for (const row of rows) {
      map.set(row.id, row.inGlobalNews === true || row.inGlobalNews === 1);
    }
  } catch (e) {
    console.warn('GET /api/exercises/ogp: inGlobalNews column read failed', e);
  }
  return map;
}

/** Load sharedInMovesbookLibrary even if Prisma client is stale (before regenerate). */
async function loadExerciseOgpSharedLibraryFlags(ids: string[]): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (ids.length === 0) return map;
  try {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; sharedInMovesbookLibrary: number | boolean }>
    >`
      SELECT id, sharedInMovesbookLibrary FROM exercise_ogp_articles WHERE id IN (${Prisma.join(ids)})
    `;
    for (const row of rows) {
      map.set(
        row.id,
        row.sharedInMovesbookLibrary === true || row.sharedInMovesbookLibrary === 1
      );
    }
  } catch (e) {
    console.warn('GET /api/exercises/ogp: sharedInMovesbookLibrary column read failed', e);
  }
  return map;
}

/**
 * Same rules as non-admin branch in GET: what OGPs can this user see (excluding admin bypass).
 * Others' exercises are limited to Movesbook/super-admin creators and Global Exercises
 * (`inGlobalNews`) promoted by super-admin after a user shared them into the library.
 */
function ogpVisibleToViewer(
  a: {
    userId: string;
    deletedAt: Date | null;
    expiresAt: Date | null;
    visibilityUserTypes: string | null;
    visibilityCountries: string | null;
    visibilityLanguages: string | null;
    visibilitySports: string | null;
  },
  viewer: { userId: string; userType: string; country: string | null; userSports: string[]; languageCode: string },
  opts?: { createdBySuperAdmin?: boolean; inGlobalNews?: boolean }
): boolean {
  const isCreator = a.userId === viewer.userId;
  if (isCreator) return true;
  const now = new Date();
  if (a.deletedAt) return false;
  if (a.expiresAt && a.expiresAt < now) return false;
  // Other users: only Movesbook/super-admin posts or super-admin–approved Global Exercises.
  if (opts?.createdBySuperAdmin !== true && opts?.inGlobalNews !== true) return false;
  const vUserTypes = parseJsonArray(a.visibilityUserTypes);
  const vCountries = parseJsonArray(a.visibilityCountries);
  const vLanguages = parseJsonArray(a.visibilityLanguages);
  const vSports = parseJsonArray(a.visibilitySports);
  const hasNoVisibilitySet =
    vUserTypes.length === 0 &&
    vCountries.length === 0 &&
    vLanguages.length === 0 &&
    vSports.length === 0 &&
    !a.expiresAt;
  if (hasNoVisibilitySet) return true;
  if (vUserTypes.length > 0 && !vUserTypes.includes(viewer.userType)) return false;
  if (vCountries.length > 0 && !vCountries.includes(viewer.country ?? '')) return false;
  if (vLanguages.length > 0) {
    const lang = viewer.languageCode.slice(0, 2).toLowerCase();
    if (!vLanguages.some((l: string) => l.toLowerCase() === lang)) return false;
  }
  if (vSports.length > 0 && !vSports.some((s: string) => viewer.userSports.includes(s))) return false;
  return true;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithUser(request);
  if (auth instanceof NextResponse) return auth;
  const { userId, userType, country, isAdmin } = auth;
  // Super admin (super_admins table) and userType ADMIN are excepted from visibility: they see all articles.
  const { searchParams } = new URL(request.url);
  const category = requireCategory(searchParams.get('category'));
  if (category instanceof NextResponse) return category;
  const topic = searchParams.get('topic');
  const viewAsUsername = searchParams.get('viewAsUsername')?.trim();

  // When super admin, resolve their users_new id so we can mark articles they created as createdByCurrentUser.
  let superAdminEffectiveUserId: string | null = null;
  if (auth.isSuperAdmin) {
    superAdminEffectiveUserId = await getOrCreateUserForSuperAdmin(auth.userId);
  }

  try {
    /** Super admin only: return OGPs visible to the given username (same rules as normal users), all topics in category. */
    if (viewAsUsername) {
      if (!auth.isSuperAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const targetUser = await prisma.user.findFirst({
        where: { username: viewAsUsername },
        select: {
          id: true,
          userType: true,
          country: true,
          settings: { select: { language: true } },
        },
      });
      if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      const sportsRows = await prisma.userMainSport.findMany({
        where: { userId: targetUser.id },
        select: { sport: true },
      });
      const userSports = sportsRows.map((s) => s.sport);
      const languageCode = ((targetUser.settings?.language ?? 'en').slice(0, 2).toLowerCase() || 'en') as string;
      const viewer = {
        userId: targetUser.id,
        userType: targetUser.userType,
        country: targetUser.country,
        userSports,
        languageCode,
      };

      const list = (await prisma.exerciseOgpArticle.findMany({
        where: { category } as any,
        orderBy: { savedAt: 'desc' },
        include: {
          deletedBy: { select: { name: true, username: true } },
          user: { select: { username: true, country: true } },
        } as never,
      })) as Array<
        Awaited<ReturnType<typeof prisma.exerciseOgpArticle.findMany>>[number] & {
          deletedByUserId: string | null;
          deletedBy: { name: string | null; username: string } | null;
          user: { username: string; country: string | null } | null;
        }
      >;

      const superAdminCreatorIds = await getSuperAdminCreatorIds();
      const globalById = await loadExerciseOgpGlobalFlags(list.map((a) => a.id));
      const filtered = list.filter((a) =>
        ogpVisibleToViewer(a, viewer, {
          createdBySuperAdmin: superAdminCreatorIds.includes(a.userId),
          inGlobalNews:
            globalById.get(a.id) === true ||
            (a as { inGlobalNews?: boolean }).inGlobalNews === true,
        })
      );
      const extraById = await loadExerciseOgpExtraFields(filtered.map((a) => a.id));
      const sharedLibraryById = await loadExerciseOgpSharedLibraryFlags(filtered.map((a) => a.id));
      const articles = filtered.map((a) => ({
        id: a.id,
        userId: a.userId,
        category: a.category,
        creatorUsername: a.user?.username ?? null,
        creatorCountry: a.user?.country ?? null,
        createdByCurrentUser: a.userId === targetUser.id,
        createdBySuperAdmin: superAdminCreatorIds.includes(a.userId),
        title: a.title,
        image: a.image,
        description: a.description,
        url: a.url,
        siteName: a.siteName,
        type: a.type,
        typology:
          extraById.get(a.id)?.typology ??
          (a as { typology?: string | null }).typology ??
          null,
        sportEquipment:
          extraById.get(a.id)?.sportEquipment ??
          (a as { sportEquipment?: string | null }).sportEquipment ??
          null,
        customDescription: a.customDescription,
        topic: a.topic,
        languageCode: a.languageCode ?? null,
        savedAt: a.savedAt.toISOString(),
        inGlobalNews:
          globalById.get(a.id) === true ||
          (a as { inGlobalNews?: boolean }).inGlobalNews === true,
        sharedInMovesbookLibrary:
          sharedLibraryById.get(a.id) === true ||
          (a as { sharedInMovesbookLibrary?: boolean }).sharedInMovesbookLibrary === true,
        visibilityUserTypes: parseJsonArray(a.visibilityUserTypes),
        visibilityCountries: parseJsonArray(a.visibilityCountries),
        visibilityLanguages: parseJsonArray(a.visibilityLanguages),
        visibilitySports: parseJsonArray(a.visibilitySports),
        expiresAt: a.expiresAt?.toISOString() ?? null,
        ...(a.deletedAt && {
          deletedAt: a.deletedAt.toISOString(),
          deletedByUserId: a.deletedByUserId ?? undefined,
          deletedByName: a.deletedBy ? (a.deletedBy.name || a.deletedBy.username) : undefined,
        }),
      }));
      return NextResponse.json({
        articles,
        viewAsUserId: targetUser.id,
        viewAsUserCountry: targetUser.country ?? null,
      });
    }

    const where = isAdmin
      ? ({ category } as any)
      : // Normal users: load all non-deleted OGPs in category PLUS all OGPs they created (even if deleted).
        ({
          category,
          OR: [{ deletedAt: null }, { userId }],
        } as any);
    if (topic != null && topic !== '') (where as any).topic = topic;

    const list = (await prisma.exerciseOgpArticle.findMany({
      where,
      orderBy: { savedAt: 'desc' },
      include: {
        deletedBy: { select: { name: true, username: true } },
        user: { select: { username: true, country: true } },
      } as never,
    })) as Array<
      Awaited<ReturnType<typeof prisma.exerciseOgpArticle.findMany>>[number] & {
        deletedByUserId: string | null;
        deletedBy: { name: string | null; username: string } | null;
        user: { username: string; country: string | null } | null;
      }
    >;

    let userSports: string[] = [];
    if (!isAdmin) {
      const sportsRows = await prisma.userMainSport.findMany({
        where: { userId },
        select: { sport: true },
      });
      userSports = sportsRows.map((s) => s.sport);
    }

    const now = new Date();
    const superAdminCreatorIds = await getSuperAdminCreatorIds();
    const globalByIdAll = isAdmin
      ? new Map<string, boolean>()
      : await loadExerciseOgpGlobalFlags(list.map((a) => a.id));
    const filtered = list.filter((a) => {
      const isCreator = a.userId === userId;

      // Admin / super admin: see everything (including deleted and expired).
      if (isAdmin) return true;

      // Normal user (creator): always see own OGPs, including deleted / expired / without settings.
      if (isCreator) return true;

      // Non-admin viewing others' OGPs: only Movesbook/super-admin or Global Exercises.
      if (a.deletedAt) return false;
      if (a.expiresAt && a.expiresAt < now) return false;
      const createdBySuperAdmin = superAdminCreatorIds.includes(a.userId);
      const inGlobalNews =
        globalByIdAll.get(a.id) === true ||
        (a as { inGlobalNews?: boolean }).inGlobalNews === true;
      if (!createdBySuperAdmin && !inGlobalNews) return false;
      const vUserTypes = parseJsonArray(a.visibilityUserTypes);
      const vCountries = parseJsonArray(a.visibilityCountries);
      const vLanguages = parseJsonArray(a.visibilityLanguages);
      const vSports = parseJsonArray(a.visibilitySports);
      const hasNoVisibilitySet =
        vUserTypes.length === 0 &&
        vCountries.length === 0 &&
        vLanguages.length === 0 &&
        vSports.length === 0 &&
        !a.expiresAt;
      if (hasNoVisibilitySet) return true;
      if (vUserTypes.length > 0 && !vUserTypes.includes(userType)) return false;
      if (vCountries.length > 0 && !vCountries.includes(country ?? '')) return false;
      if (vLanguages.length > 0) {
        const userLang = (request.headers.get('accept-language') || 'en').slice(0, 2).toLowerCase();
        if (!vLanguages.some((l: string) => l.toLowerCase() === userLang)) return false;
      }
      if (vSports.length > 0 && !vSports.some((s: string) => userSports.includes(s))) return false;
      return true;
    });
    const extraById = await loadExerciseOgpExtraFields(filtered.map((a) => a.id));
    const globalById = isAdmin
      ? await loadExerciseOgpGlobalFlags(filtered.map((a) => a.id))
      : globalByIdAll;
    const sharedLibraryById = await loadExerciseOgpSharedLibraryFlags(filtered.map((a) => a.id));

    const articles = filtered.map((a) => ({
      id: a.id,
      userId: a.userId,
      category: a.category,
      creatorUsername: a.user?.username ?? null,
      creatorCountry: a.user?.country ?? null,
      ...(superAdminEffectiveUserId != null && { createdByCurrentUser: a.userId === superAdminEffectiveUserId }),
      createdBySuperAdmin: superAdminCreatorIds.includes(a.userId),
      title: a.title,
      image: a.image,
      description: a.description,
      url: a.url,
      siteName: a.siteName,
      type: a.type,
      typology:
        extraById.get(a.id)?.typology ??
        (a as { typology?: string | null }).typology ??
        null,
      sportEquipment:
        extraById.get(a.id)?.sportEquipment ??
        (a as { sportEquipment?: string | null }).sportEquipment ??
        null,
      customDescription: a.customDescription,
      topic: a.topic,
      languageCode: a.languageCode ?? null,
      savedAt: a.savedAt.toISOString(),
      inGlobalNews:
        globalById.get(a.id) === true ||
        (a as { inGlobalNews?: boolean }).inGlobalNews === true,
      sharedInMovesbookLibrary:
        sharedLibraryById.get(a.id) === true ||
        (a as { sharedInMovesbookLibrary?: boolean }).sharedInMovesbookLibrary === true,
      visibilityUserTypes: parseJsonArray(a.visibilityUserTypes),
      visibilityCountries: parseJsonArray(a.visibilityCountries),
      visibilityLanguages: parseJsonArray(a.visibilityLanguages),
      visibilitySports: parseJsonArray(a.visibilitySports),
      expiresAt: a.expiresAt?.toISOString() ?? null,
      ...(a.deletedAt && {
        deletedAt: a.deletedAt.toISOString(),
        deletedByUserId: a.deletedByUserId ?? undefined,
        deletedByName: a.deletedBy ? (a.deletedBy.name || a.deletedBy.username) : undefined,
      }),
    }));
    return NextResponse.json(articles);
  } catch (e) {
    console.error('GET /api/exercises/ogp', e);
    return NextResponse.json({ error: 'Failed to load articles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthForNews(request);
  if (auth instanceof NextResponse) return auth;
  const { userId, userType, isSuperAdmin } = auth;

  if ((userType ?? '').toUpperCase() === 'ATHLETE') {
    return NextResponse.json(
      { error: 'Athletes cannot create OGP exercises' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const category = requireCategory(body.category);
    if (category instanceof NextResponse) return category;
    const {
      title,
      image,
      description,
      url,
      siteName,
      type,
      typology,
      sportEquipment,
      customDescription,
      topic,
      languageCode,
      expiresAt,
      visibilityUserTypes,
      visibilityCountries,
      visibilityLanguages,
      visibilitySports,
    } = body;
    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    const topicName = typeof topic === 'string' && topic.trim() ? topic.trim() : 'General';
    const typologyName =
      typeof typology === 'string' && typology.trim() ? typology.trim() : null;
    const sportEquipmentName =
      typeof sportEquipment === 'string' && sportEquipment.trim() ? sportEquipment.trim() : null;
    const baseCreateData = {
      userId,
      category,
      title: title ?? null,
      image: image ?? null,
      description: description ?? null,
      url: url.trim(),
      siteName: siteName ?? null,
      type: type ?? null,
      customDescription: customDescription ?? null,
      topic: topicName,
      languageCode: typeof languageCode === 'string' && languageCode.trim() ? languageCode.trim() : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      visibilityUserTypes: Array.isArray(visibilityUserTypes) ? JSON.stringify(visibilityUserTypes) : null,
      visibilityCountries: Array.isArray(visibilityCountries) ? JSON.stringify(visibilityCountries) : null,
      visibilityLanguages: Array.isArray(visibilityLanguages) ? JSON.stringify(visibilityLanguages) : null,
      visibilitySports: Array.isArray(visibilitySports) ? JSON.stringify(visibilitySports) : null,
      ...(typologyName ? ({ typology: typologyName } as { typology: string }) : {}),
      ...(sportEquipmentName
        ? ({ sportEquipment: sportEquipmentName } as { sportEquipment: string })
        : {}),
    } as Parameters<typeof prisma.exerciseOgpArticle.create>[0]['data'];

    let created: Awaited<ReturnType<typeof prisma.exerciseOgpArticle.create>>;
    try {
      created = await prisma.exerciseOgpArticle.create({ data: baseCreateData });
    } catch (createErr) {
      // Stale Prisma client may reject unknown sportEquipment arg — retry without it.
      const { sportEquipment: _omit, ...withoutSportEquipment } = baseCreateData as Record<
        string,
        unknown
      > & { sportEquipment?: string };
      created = await prisma.exerciseOgpArticle.create({
        data: withoutSportEquipment as Parameters<typeof prisma.exerciseOgpArticle.create>[0]['data'],
      });
      console.warn(
        'POST /api/exercises/ogp: create with sportEquipment failed, retried without it',
        createErr
      );
    }
    // Ensure typology / sportEquipment are persisted even if Prisma client was generated before the columns existed.
    if (typologyName) {
      try {
        await prisma.$executeRaw`
          UPDATE exercise_ogp_articles SET typology = ${typologyName} WHERE id = ${created.id}
        `;
      } catch (e) {
        console.warn('POST /api/exercises/ogp: typology column update failed', e);
      }
    }
    if (sportEquipmentName) {
      try {
        await prisma.$executeRaw`
          UPDATE exercise_ogp_articles SET sportEquipment = ${sportEquipmentName} WHERE id = ${created.id}
        `;
      } catch (e) {
        console.warn('POST /api/exercises/ogp: sportEquipment column update failed', e);
      }
    }
    return NextResponse.json({
      id: created.id,
      category: created.category,
      title: created.title,
      image: created.image,
      description: created.description,
      url: created.url,
      siteName: created.siteName,
      type: created.type,
      typology: (created as { typology?: string | null }).typology ?? typologyName,
      sportEquipment:
        (created as { sportEquipment?: string | null }).sportEquipment ?? sportEquipmentName,
      customDescription: created.customDescription,
      topic: created.topic,
      languageCode: created.languageCode ?? null,
      savedAt: created.savedAt.toISOString(),
      createdBySuperAdmin: isSuperAdmin,
    });
  } catch (e) {
    console.error('POST /api/exercises/ogp', e);
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 });
  }
}
