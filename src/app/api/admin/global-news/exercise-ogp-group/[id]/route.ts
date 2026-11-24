import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTableSuperAdmin } from '@/lib/globalNewsAuth';

/** PATCH — toggle an OGP Exercise group in Global Exercises feed (super admin only). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireTableSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.inGlobalNews !== 'boolean') {
      return NextResponse.json({ error: 'inGlobalNews (boolean) is required' }, { status: 400 });
    }

    const existing = await prisma.exerciseOgpGroup.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'OGP Exercise group not found' }, { status: 404 });
    }

    await prisma.$executeRaw`
      UPDATE exercise_ogp_groups
      SET inGlobalNews = ${body.inGlobalNews}
      WHERE id = ${id}
    `;

    return NextResponse.json({ id, inGlobalNews: body.inGlobalNews });
  } catch (e) {
    console.error('PATCH /api/admin/global-news/exercise-ogp-group/[id]', e);
    return NextResponse.json({ error: 'Failed to update global exercises flag' }, { status: 500 });
  }
}
