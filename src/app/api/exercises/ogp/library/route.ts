import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSuperAdminCreatorIds, requireAuthWithUser } from '../../auth';

export type ExerciseOgpLibraryScope = 'global-library' | 'mine';

export type ExerciseOgpLibraryItem = {
  id: string;
  userId: string;
  category: string;
  topic: string;
  title: string | null;
  image: string | null;
  description: string | null;
  customDescription: string | null;
  url: string;
  typology: string | null;
  creatorUsername: string | null;
  savedAt: string;
  createdBySuperAdmin: boolean;
  inGlobalNews: boolean;
  sharedInMovesbookLibrary: boolean;
  createdByCurrentUser: boolean;
};

function parseJsonArray(str: string | null | undefined): string[] {
  if (str == null || str === '') return [];
  try {
    const a = JSON.parse(str);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

async function loadGlobalFlags(ids: string[]): Promise<Map<string, boolean>> {
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
    console.warn('GET /api/exercises/ogp/library: inGlobalNews column read failed', e);
  }
  return map;
}

async function loadSharedFlags(ids: string[]): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (ids.length === 0) return map;
  try {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; sharedInMovesbookLibrary: number | boolean }>
    >`
      SELECT id, sharedInMovesbookLibrary FROM exercise_ogp_articles
      WHERE id IN (${Prisma.join(ids)})
    `;
    for (const row of rows) {
      map.set(
        row.id,
        row.sharedInMovesbookLibrary === true || row.sharedInMovesbookLibrary === 1
      );
    }
  } catch (e) {
    console.warn(
      'GET /api/exercises/ogp/library: sharedInMovesbookLibrary column read failed',
      e
    );
  }
  return map;
}

function matchesViewerAudience(
  a: {
    visibilityUserTypes: string | null;
    visibilityCountries: string | null;
    visibilityLanguages: string | null;
    visibilitySports: string | null;
    expiresAt: Date | null;
  },
  viewer: {
    userType: string;
    country: string | null;
    userSports: string[];
    languageCode: string;
  }
): boolean {
  const now = new Date();
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
    if (!vLanguages.some((l) => l.toLowerCase() === lang)) return false;
  }
  if (vSports.length > 0 && !vSports.some((s) => viewer.userSports.includes(s))) return false;
  return true;
}

/**
 * GET /api/exercises/ogp/library?scope=global-library|mine
 *
 * Club (and other) accounts:
 * - global-library → Global by super-admin (`inGlobalNews`) + own Shared (`sharedInMovesbookLibrary`)
 * - mine → created by the current user
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthWithUser(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const scopeRaw = (searchParams.get('scope') ?? '').trim();
  if (scopeRaw !== 'global-library' && scopeRaw !== 'mine') {
    return NextResponse.json(
      { error: 'scope must be global-library or mine' },
      { status: 400 }
    );
  }
  const scope = scopeRaw as ExerciseOgpLibraryScope;

  try {
    const userId = auth.userId;
    const userSportsRows = await prisma.userMainSport.findMany({
      where: { userId },
      select: { sport: true },
    });
    const userSports = userSportsRows.map((r) => r.sport).filter(Boolean);
    const languageCode = (request.headers.get('accept-language') || 'en').slice(0, 2).toLowerCase();
    const viewer = {
      userType: auth.userType,
      country: auth.country,
      userSports,
      languageCode,
    };

    const list = await prisma.exerciseOgpArticle.findMany({
      where: { deletedAt: null },
      orderBy: { savedAt: 'desc' },
      include: {
        user: { select: { username: true, country: true } },
      },
    });

    const ids = list.map((a) => a.id);
    const [globalById, sharedById, superAdminCreatorIds] = await Promise.all([
      loadGlobalFlags(ids),
      loadSharedFlags(ids),
      getSuperAdminCreatorIds(),
    ]);

    const filtered = list.filter((a) => {
      const inGlobalNews =
        globalById.get(a.id) === true ||
        (a as { inGlobalNews?: boolean }).inGlobalNews === true;
      const sharedInMovesbookLibrary =
        sharedById.get(a.id) === true ||
        (a as { sharedInMovesbookLibrary?: boolean }).sharedInMovesbookLibrary === true;
      const isOwn = a.userId === userId;

      if (scope === 'mine') {
        return isOwn;
      }

      // global-library: Global by super-admin OR Shared by the current user.
      if (isOwn && sharedInMovesbookLibrary) return true;
      if (!inGlobalNews) return false;
      // Others' Global exercises still respect audience / expiry settings.
      return matchesViewerAudience(a, viewer);
    });

    const items: ExerciseOgpLibraryItem[] = filtered.map((a) => {
      const inGlobalNews =
        globalById.get(a.id) === true ||
        (a as { inGlobalNews?: boolean }).inGlobalNews === true;
      const sharedInMovesbookLibrary =
        sharedById.get(a.id) === true ||
        (a as { sharedInMovesbookLibrary?: boolean }).sharedInMovesbookLibrary === true;
      return {
        id: a.id,
        userId: a.userId,
        category: a.category,
        topic: a.topic,
        title: a.title,
        image: a.image,
        description: a.description,
        customDescription: a.customDescription,
        url: a.url,
        typology: (a as { typology?: string | null }).typology ?? null,
        creatorUsername: a.user?.username ?? null,
        savedAt: a.savedAt.toISOString(),
        createdBySuperAdmin: superAdminCreatorIds.includes(a.userId),
        inGlobalNews,
        sharedInMovesbookLibrary,
        createdByCurrentUser: a.userId === userId,
      };
    });

    return NextResponse.json({ items, scope });
  } catch (e) {
    console.error('GET /api/exercises/ogp/library', e);
    return NextResponse.json({ error: 'Failed to load exercise library' }, { status: 500 });
  }
}
