import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isClubAccountUserType } from '@/utils/dashboardRouting';
import {
  createOrUpdateClubNotification,
  deleteNotification,
  deleteNotificationsInDateRange,
  listClubAdminSentNotifications,
  toggleNotificationVisibility,
} from '@/lib/notifications/notificationService';

export const dynamic = 'force-dynamic';

async function requireClubAdmin(request: NextRequest): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string }
> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const decoded = verifyToken(authHeader.slice(7));
  if (!decoded?.userId) return { ok: false, status: 401, error: 'Invalid token' };

  const user = await prisma.user.findUnique({
    where: { id: String(decoded.userId) },
    select: { id: true, userType: true },
  });
  if (!user || !isClubAccountUserType(user.userType)) {
    return { ok: false, status: 403, error: 'Club Admin only' };
  }
  return { ok: true, userId: user.id };
}

export async function GET(request: NextRequest) {
  const auth = await requireClubAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  if (searchParams.get('ownedClubs') === '1') {
    const clubs = await prisma.club.findMany({
      where: { adminId: auth.userId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ clubs });
  }

  try {
    const statusParam = searchParams.get('status');
    const status =
      statusParam === 'active' || statusParam === 'expired' || statusParam === 'all'
        ? statusParam
        : 'all';
    const result = await listClubAdminSentNotifications({
      userId: auth.userId,
      clubId: searchParams.get('clubId'),
      search: searchParams.get('q') || '',
      status,
      page: Number(searchParams.get('page') || '1'),
      pageSize: Number(searchParams.get('pageSize') || '10'),
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('GET /api/notifications/club', e);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireClubAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();

    if (body?.action === 'delete_range') {
      const fromDate = typeof body?.fromDate === 'string' ? body.fromDate : '';
      const toDate = typeof body?.toDate === 'string' ? body.toDate : '';
      if (!fromDate || !toDate) {
        return NextResponse.json({ error: 'fromDate and toDate required' }, { status: 400 });
      }
      const deleted = await deleteNotificationsInDateRange({
        source: 'club_admin',
        submittedByUserId: auth.userId,
        fromDate,
        toDate,
        entityId: typeof body?.clubId === 'string' ? body.clubId : null,
      });
      return NextResponse.json({ ok: true, deleted });
    }

    let clubIds: string[] = Array.isArray(body?.clubIds)
      ? body.clubIds.map(String)
      : typeof body?.clubId === 'string' && body.clubId
        ? [body.clubId]
        : [];

    if (clubIds.length === 0) {
      const owned = await prisma.club.findMany({
        where: { adminId: auth.userId },
        select: { id: true },
      });
      clubIds = owned.map((c) => c.id);
    }

    const row = await createOrUpdateClubNotification({
      title: typeof body?.title === 'string' ? body.title : '',
      description: typeof body?.description === 'string' ? body.description : '',
      path: typeof body?.path === 'string' ? body.path : '',
      untilDate: typeof body?.untilDate === 'string' ? body.untilDate : new Date().toISOString().slice(0, 10),
      prioritary: Boolean(body?.prioritary),
      audienceKind: body?.audienceKind === 'staff' ? 'staff' : 'members',
      clubIds,
      submittedByUserId: auth.userId,
      editId: typeof body?.editId === 'string' ? body.editId : undefined,
    });
    return NextResponse.json({ id: row.id, ok: true, clubCount: clubIds.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to save';
    console.error('POST /api/notifications/club', e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireClubAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    if (typeof body?.isShow === 'boolean') {
      const owned = await prisma.notification.findFirst({
        where: { id, source: 'club_admin', submittedByUserId: auth.userId },
      });
      if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await toggleNotificationVisibility(id, body.isShow, 'club_admin');
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  } catch (e) {
    console.error('PATCH /api/notifications/club', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireClubAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await deleteNotification(id, { source: 'club_admin', submittedByUserId: auth.userId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/notifications/club', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
