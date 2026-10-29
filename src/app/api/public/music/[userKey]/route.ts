import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function parseJsonArray(str: string | null | undefined): string[] {
  if (str == null || str === '') return [];
  try {
    const a = JSON.parse(str);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

/** Same visibility rules as authenticated My Music (non-admin branch). */
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
  viewer: {
    userId: string;
    userType: string;
    country: string | null;
    userSports: string[];
    languageCode: string;
  }
): boolean {
  if (a.userId === viewer.userId) return true;
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
  if (vSports.length > 0 && !vSports.some((s: string) => viewer.userSports.includes(s))) {
    return false;
  }
  return true;
}

/**
 * GET /api/public/music/[userKey]
 * Public (no auth) — same OGP set the owner sees in My Music (for Get Link / Share).
 * userKey may be username or user id.
 *
 * - Admin / superadmin-linked owners: all non-deleted, non-expired OGPs (matches admin panel).
 * - Everyone else: OGPs visible to that owner (own + visibility-matching), matching athlete My Music.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userKey: string }> }
) {
  try {
    const { userKey: raw } = await params;
    const userKey = decodeURIComponent(raw || '').trim();
    if (!userKey) {
      return NextResponse.json({ error: 'User key required' }, { status: 400 });
    }

    const owner = await prisma.user.findFirst({
      where: {
        OR: [{ username: userKey }, { id: userKey }],
      },
      select: {
        id: true,
        username: true,
        name: true,
        country: true,
        userType: true,
        superAdminId: true,
        settings: { select: { language: true } },
      },
    });

    if (!owner) {
      return NextResponse.json({ error: 'Music not found' }, { status: 404 });
    }

    const now = new Date();
    const isPrivileged =
      owner.userType === 'ADMIN' || Boolean(owner.superAdminId);

    const select = {
      id: true,
      userId: true,
      title: true,
      artist: true,
      image: true,
      description: true,
      url: true,
      siteName: true,
      customDescription: true,
      topic: true,
      genre: true,
      registrationType: true,
      isFavourite: true,
      languageCode: true,
      savedAt: true,
      expiresAt: true,
      deletedAt: true,
      visibilityUserTypes: true,
      visibilityCountries: true,
      visibilityLanguages: true,
      visibilitySports: true,
      user: { select: { username: true, country: true } },
    } as const;

    let list: Array<{
      id: string;
      userId: string;
      title: string | null;
      artist: string | null;
      image: string | null;
      description: string | null;
      url: string;
      siteName: string | null;
      customDescription: string | null;
      topic: string;
      genre: string | null;
      registrationType: string | null;
      isFavourite: boolean;
      languageCode: string | null;
      savedAt: Date;
      expiresAt: Date | null;
      deletedAt: Date | null;
      visibilityUserTypes: string | null;
      visibilityCountries: string | null;
      visibilityLanguages: string | null;
      visibilitySports: string | null;
      user: { username: string; country: string | null } | null;
    }>;

    if (isPrivileged) {
      // Match admin My Music: full catalog, but never expose deleted/expired on a public link.
      list = await prisma.musicOgpArticle.findMany({
        where: {
          deletedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { savedAt: 'desc' },
        select,
      });
    } else {
      const sportsRows = await prisma.userMainSport.findMany({
        where: { userId: owner.id },
        select: { sport: true },
      });
      const viewer = {
        userId: owner.id,
        userType: owner.userType,
        country: owner.country,
        userSports: sportsRows.map((s) => s.sport),
        languageCode: ((owner.settings?.language ?? 'en').slice(0, 2).toLowerCase() ||
          'en') as string,
      };

      const candidates = await prisma.musicOgpArticle.findMany({
        where: {
          OR: [{ deletedAt: null }, { userId: owner.id }],
        },
        orderBy: { savedAt: 'desc' },
        select,
      });
      list = candidates.filter((a) => ogpVisibleToViewer(a, viewer));
      // Public share: hide deleted/expired even for the owner's own rows.
      list = list.filter((a) => {
        if (a.deletedAt) return false;
        if (a.expiresAt && a.expiresAt < now) return false;
        return true;
      });
    }

    let viewRows: { id: string; viewCount: number }[] = [];
    if (list.length > 0) {
      try {
        viewRows = await prisma.$queryRaw<{ id: string; viewCount: number }[]>`
          SELECT id, viewCount FROM music_ogp_articles
          WHERE id IN (${Prisma.join(list.map((a) => a.id))})
        `;
      } catch {
        viewRows = [];
      }
    }
    const viewById = new Map(viewRows.map((r) => [r.id, r.viewCount ?? 0]));

    const articles = list.map((a) => ({
      id: a.id,
      title: a.title,
      artist: a.artist,
      image: a.image,
      description: a.description,
      url: a.url,
      siteName: a.siteName,
      customDescription: a.customDescription,
      topic: a.topic,
      genre: a.genre,
      registrationType: a.registrationType,
      isFavourite: a.isFavourite === true,
      languageCode: a.languageCode ?? null,
      viewCount: viewById.get(a.id) ?? 0,
      savedAt: a.savedAt.toISOString(),
      creatorUsername: a.user?.username ?? null,
      creatorCountry: a.user?.country ?? null,
      userId: a.userId,
      createdByCurrentUser: a.userId === owner.id,
    }));

    const ownerName = (owner.name && owner.name.trim()) || owner.username || null;

    return NextResponse.json({
      owner: {
        id: owner.id,
        username: owner.username,
        name: ownerName,
        country: owner.country,
      },
      articles,
      articleCount: articles.length,
    });
  } catch (e) {
    console.error('GET /api/public/music/[userKey]', e);
    return NextResponse.json({ error: 'Failed to load music' }, { status: 500 });
  }
}
