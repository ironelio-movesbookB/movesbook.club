import { NextRequest, NextResponse } from 'next/server';
import { requireTableSuperAdmin, fetchGlobalNewsFeedItems } from '@/lib/globalNewsAuth';
import { getSuperAdminCreatorIds } from '@/app/api/news/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** GET — merged News + OGP News marked for Global News, newest first. */
export async function GET(request: NextRequest) {
  const auth = await requireTableSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const includeDeleted =
      request.nextUrl.searchParams.get('includeDeleted') === '1' ||
      request.nextUrl.searchParams.get('includeDeleted') === 'true';
    const items = await fetchGlobalNewsFeedItems({ includeDeleted });

    const [movesbookUserIds, linkedUser] = await Promise.all([
      getSuperAdminCreatorIds(),
      prisma.user.findUnique({
        where: { superAdminId: auth.superAdminId },
        select: { id: true, country: true },
      }),
    ]);

    return NextResponse.json({
      items,
      currentUserCountry: linkedUser?.country ?? null,
      movesbookUserIds,
    });
  } catch (e) {
    console.error('GET /api/admin/global-news', e);
    return NextResponse.json({ error: 'Failed to load global news' }, { status: 500 });
  }
}
