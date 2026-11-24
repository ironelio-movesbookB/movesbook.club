import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { fetchGlobalNewsFeedItems } from '@/lib/globalNewsAuth';
import { prisma } from '@/lib/prisma';
import { getSuperAdminCreatorIds } from '@/app/api/news/auth';

export const dynamic = 'force-dynamic';

/**
 * GET — Movesbook Global News feed (same items superadmin curates).
 * Available to any logged-in Movesbook user (e.g. Club → Movesbook News).
 *
 * Optional `clubId` query param returns posted-by role id sets for filters
 * (mirrors Club News & OGP News toolbar).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const decoded = verifyToken(authHeader.slice(7));
  if (!decoded?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const includeDeleted =
      request.nextUrl.searchParams.get('includeDeleted') === '1' ||
      request.nextUrl.searchParams.get('includeDeleted') === 'true';
    const items = await fetchGlobalNewsFeedItems({ includeDeleted });
    const clubId = request.nextUrl.searchParams.get('clubId')?.trim() || null;

    if (!clubId) {
      return NextResponse.json({
        items,
        currentUserId: decoded.userId,
        adminStaffUserIds: [] as string[],
        memberUserIds: [] as string[],
        movesbookUserIds: await getSuperAdminCreatorIds(),
      });
    }

    const [clubRow, staffRows, memberRows, movesbookUserIds] = await Promise.all([
      prisma.club.findUnique({
        where: { id: clubId },
        select: { adminId: true },
      }),
      prisma.clubStaff.findMany({
        where: { clubId },
        select: { userId: true },
      }),
      prisma.clubMember.findMany({
        where: { clubId },
        select: { memberId: true },
      }),
      getSuperAdminCreatorIds(),
    ]);

    const adminStaffUserIds = [
      ...new Set(
        [clubRow?.adminId, ...staffRows.map((s) => s.userId)].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ];
    const adminStaffSet = new Set(adminStaffUserIds);
    const movesbookIdSet = new Set(movesbookUserIds);
    const memberUserIds = [
      ...new Set(
        memberRows
          .map((m) => m.memberId)
          .filter((id) => id && !adminStaffSet.has(id) && !movesbookIdSet.has(id)),
      ),
    ];

    return NextResponse.json({
      items,
      currentUserId: decoded.userId,
      adminStaffUserIds,
      memberUserIds,
      movesbookUserIds,
    });
  } catch (e) {
    console.error('GET /api/news/global', e);
    return NextResponse.json({ error: 'Failed to load Movesbook News' }, { status: 500 });
  }
}
