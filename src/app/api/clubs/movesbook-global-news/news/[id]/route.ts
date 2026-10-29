import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireClubAdmin } from '@/lib/clubNewsShareAuth';
import { requireTableSuperAdmin } from '@/lib/globalNewsAuth';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH — toggle a News article in Movesbook Global News.
 * Allowed for club admins (CLUB / CLUB_TRAINER) or table super admins.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const clubAuth = await requireClubAdmin(request);
  const isClubAdmin = !(clubAuth instanceof NextResponse);
  if (!isClubAdmin) {
    const superAuth = await requireTableSuperAdmin(request);
    if (superAuth instanceof NextResponse) {
      return NextResponse.json({ error: 'Club admin or super admin only' }, { status: 403 });
    }
  }

  const { id } = await context.params;

  try {
    const body = (await request.json().catch(() => ({}))) as { inGlobalNews?: boolean };
    if (typeof body.inGlobalNews !== 'boolean') {
      return NextResponse.json({ error: 'inGlobalNews (boolean) is required' }, { status: 400 });
    }

    const existing = await prisma.news.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: 'News not found' }, { status: 404 });
    }

    const updated = await prisma.news.update({
      where: { id },
      data: { inGlobalNews: body.inGlobalNews } as { inGlobalNews: boolean },
      select: { id: true, inGlobalNews: true } as { id: true; inGlobalNews: true },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error('PATCH /api/clubs/movesbook-global-news/news/[id]', e);
    return NextResponse.json({ error: 'Failed to update Movesbook Global News' }, { status: 500 });
  }
}
