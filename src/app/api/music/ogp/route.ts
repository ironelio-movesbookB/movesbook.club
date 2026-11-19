import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAuthWithUser, requireAuthForNews, getOrCreateUserForSuperAdmin, getSuperAdminCreatorIds } from '../auth';

function parseJsonArray(str: string | null | undefined): string[] {
  if (str == null || str === '') return [];
  try {
    const a = JSON.parse(str);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

/** Load artist / registrationType / viewCount even if Prisma client is stale (dev server locking generate). */
async function loadMusicOgpExtras(
  ids: string[]
): Promise<
  Map<
    string,
    {
      artist: string | null;
      registrationType: string | null;
      isFavourite: boolean;
      viewCount: number;
    }
  >
> {
  const map = new Map<
    string,
    {
      artist: string | null;
      registrationType: string | null;
      isFavourite: boolean;
      viewCount: number;
    }
  >();
  if (ids.length === 0) return map;
  const rows = await prisma.$queryRaw<
    {
      id: string;
      artist: string | null;
      registrationType: string | null;
      isFavourite: number | boolean;
      viewCount: number | null;
    }[]
  >`
    SELECT id, artist, registrationType, isFavourite, viewCount FROM music_ogp_articles WHERE id IN (${Prisma.join(ids)})
  `;
  for (const row of rows) {
    map.set(row.id, {
      artist: row.artist,
      registrationType: row.registrationType,
      isFavourite: row.isFavourite === true || row.isFavourite === 1,
      viewCount: typeof row.viewCount === 'number' ? row.viewCount : 0,
    });
  }
  return map;
}

/** Same rules as non-admin branch in GET: what OGPs can this user see (excluding admin bypass). */
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
  viewer: { userId: string; userType: string; country: string | null; userSports: string[]; languageCode: string }
): boolean {
  const isCreator = a.userId === viewer.userId;
  if (isCreator) return true;
  const now = new Date();
  if (a.deletedAt) return false;
  if (a.expiresAt && a.expiresAt < now) return false;
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
  // Super admin (super_admins table) and userType ADMIN are excepted from News Setting visibility: they see all articles.
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic');
  const viewAsUsername = searchParams.get('viewAsUsername')?.trim();

  // When super admin, resolve their users_new id so we can mark articles they created as createdByCurrentUser.
  let superAdminEffectiveUserId: string | null = null;
  if (auth.isSuperAdmin) {
    superAdminEffectiveUserId = await getOrCreateUserForSuperAdmin(auth.userId);
  }

  try {
    /** Super admin only: return OGPs visible to the given username (same rules as normal users), all topics. */
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

      const list = (await prisma.musicOgpArticle.findMany({
        where: {} as any,
        orderBy: { savedAt: 'desc' },
        include: {
          deletedBy: { select: { name: true, username: true } },
          user: { select: { username: true, country: true } },
        } as never,
      })) as Array<
        Awaited<ReturnType<typeof prisma.musicOgpArticle.findMany>>[number] & {
          deletedByUserId: string | null;
          deletedBy: { name: string | null; username: string } | null;
          user: { username: string; country: string | null } | null;
        }
      >;

      const superAdminCreatorIds = await getSuperAdminCreatorIds();
      const filtered = list.filter((a) => ogpVisibleToViewer(a, viewer));
      const artistById = await loadMusicOgpExtras(filtered.map((a) => a.id));

      const articles = filtered.map((a) => ({
        id: a.id,
        userId: a.userId,
        creatorUsername: a.user?.username ?? null,
        creatorCountry: a.user?.country ?? null,
        createdByCurrentUser: a.userId === targetUser.id,
        createdBySuperAdmin: superAdminCreatorIds.includes(a.userId),
        title: a.title,
        artist: artistById.get(a.id)?.artist ?? (a as { artist?: string | null }).artist ?? null,
        image: a.image,
        description: a.description,
        url: a.url,
        siteName: a.siteName,
        type: a.type,
        customDescription: a.customDescription,
        topic: a.topic,
        genre: (a as { genre?: string | null }).genre ?? null,
        registrationType:
          artistById.get(a.id)?.registrationType ??
          (a as { registrationType?: string | null }).registrationType ??
          null,
        isFavourite: artistById.get(a.id)?.isFavourite ?? false,
        viewCount:
          artistById.get(a.id)?.viewCount ??
          (a as { viewCount?: number }).viewCount ??
          0,
        languageCode: a.languageCode ?? null,
        savedAt: a.savedAt.toISOString(),
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
      ? // Admin / super admin: load all OGPs (topic filter applied below).
        ({} as any)
      : // Normal users: load all non-deleted OGPs PLUS all OGPs they created (even if deleted),
        // so creators can always see their own OGPs (including expired / deleted).
        ({
          OR: [{ deletedAt: null }, { userId }],
        } as any);
    if (topic != null && topic !== '') (where as any).topic = topic;

    const list = (await prisma.musicOgpArticle.findMany({
      where,
      orderBy: { savedAt: 'desc' },
      include: {
        deletedBy: { select: { name: true, username: true } },
        user: { select: { username: true, country: true } },
      } as never,
    })) as Array<
      Awaited<ReturnType<typeof prisma.musicOgpArticle.findMany>>[number] & {
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
    const filtered = list.filter((a) => {
      const isCreator = a.userId === userId;

      // Admin / super admin: see everything (including deleted and expired).
      if (isAdmin) return true;

      // Normal user (creator): always see own OGPs, including deleted / expired / without settings.
      if (isCreator) return true;

      // Non-admin viewing others' OGPs:
      // - Hide deleted
      if (a.deletedAt) return false;
      if (a.expiresAt && a.expiresAt < now) return false;
      const vUserTypes = parseJsonArray(a.visibilityUserTypes);
      const vCountries = parseJsonArray(a.visibilityCountries);
      const vLanguages = parseJsonArray(a.visibilityLanguages);
      const vSports = parseJsonArray(a.visibilitySports);
      // If creator didn't set any visibility, show to everyone (default public)
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
    const artistById = await loadMusicOgpExtras(filtered.map((a) => a.id));

    const articles = filtered.map((a) => ({
      id: a.id,
      userId: a.userId,
      creatorUsername: a.user?.username ?? null,
      creatorCountry: a.user?.country ?? null,
      /** When true, article was created by the current super admin (so Pencil/settings/delete show as creator). */
      ...(superAdminEffectiveUserId != null && { createdByCurrentUser: a.userId === superAdminEffectiveUserId }),
      /** When true, article was posted by a Super Admin account (show MB badge instead of trash). */
      createdBySuperAdmin: superAdminCreatorIds.includes(a.userId),
      title: a.title,
      artist: artistById.get(a.id)?.artist ?? (a as { artist?: string | null }).artist ?? null,
      image: a.image,
      description: a.description,
      url: a.url,
      siteName: a.siteName,
      type: a.type,
      customDescription: a.customDescription,
      topic: a.topic,
      genre: (a as { genre?: string | null }).genre ?? null,
      registrationType:
        artistById.get(a.id)?.registrationType ??
        (a as { registrationType?: string | null }).registrationType ??
        null,
      isFavourite: artistById.get(a.id)?.isFavourite ?? false,
      viewCount:
        artistById.get(a.id)?.viewCount ??
        (a as { viewCount?: number }).viewCount ??
        0,
      languageCode: a.languageCode ?? null,
      savedAt: a.savedAt.toISOString(),
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
    console.error('GET /api/music/ogp', e);
    return NextResponse.json({ error: 'Failed to load articles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthForNews(request);
  if (auth instanceof NextResponse) return auth;
  const { userId, isSuperAdmin } = auth;

  try {
    const body = await request.json();
    const {
      title,
      artist,
      musicTitle,
      image,
      description,
      url,
      siteName,
      type,
      customDescription,
      topic,
      genre,
      registrationType,
      isFavourite,
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
    const topicName = typeof topic === 'string' && topic.trim() ? topic.trim() : 'Songs';
    const genreName =
      typeof genre === 'string' && genre.trim() ? genre.trim() : null;
    const artistName =
      typeof artist === 'string' && artist.trim() ? artist.trim() : null;
    const registrationTypeName =
      typeof registrationType === 'string' && registrationType.trim()
        ? registrationType.trim()
        : null;
    const isFavouriteValue = isFavourite === true;
    const resolvedTitle =
      typeof musicTitle === 'string' && musicTitle.trim()
        ? musicTitle.trim()
        : title ?? null;
    const created = await prisma.musicOgpArticle.create({
      data: {
        userId,
        title: resolvedTitle,
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
      },
    });
    if (genreName || artistName || registrationTypeName || isFavouriteValue) {
      await prisma.$executeRaw`
        UPDATE music_ogp_articles
        SET genre = COALESCE(${genreName}, genre),
            artist = COALESCE(${artistName}, artist),
            registrationType = COALESCE(${registrationTypeName}, registrationType),
            isFavourite = ${isFavouriteValue}
        WHERE id = ${created.id}
      `;
    }
    return NextResponse.json({
      id: created.id,
      title: created.title,
      artist: artistName,
      image: created.image,
      description: created.description,
      url: created.url,
      siteName: created.siteName,
      type: created.type,
      customDescription: created.customDescription,
      topic: created.topic,
      genre: genreName,
      registrationType: registrationTypeName,
      isFavourite: isFavouriteValue,
      languageCode: created.languageCode ?? null,
      savedAt: created.savedAt.toISOString(),
      createdBySuperAdmin: isSuperAdmin,
    });
  } catch (e) {
    console.error('POST /api/music/ogp', e);
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 });
  }
}
