import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  isTeamAccountUserType,
  isGroupAccountUserType,
} from '@/utils/dashboardRouting';
import {
  createOrUpdateOrgNotification,
  deleteNotification,
  deleteNotificationsInDateRange,
  listOrgSentNotifications,
  toggleNotificationVisibility,
  type OrgEntityKind,
} from '@/lib/notifications/notificationService';
import type { NotificationSource } from '@/lib/notifications/audience';

export const dynamic = 'force-dynamic';

function sourceForKind(kind: OrgEntityKind): NotificationSource {
  if (kind === 'coach') return 'coach';
  if (kind === 'team') return 'team_admin';
  return 'group_admin';
}

async function requireOrgSender(
  request: NextRequest,
  kind: OrgEntityKind,
): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
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
  if (!user) return { ok: false, status: 401, error: 'User not found' };

  if (kind === 'coach' && user.userType !== 'COACH') {
    return { ok: false, status: 403, error: 'Coach only' };
  }
  if (kind === 'team' && !isTeamAccountUserType(user.userType)) {
    return { ok: false, status: 403, error: 'Team admin only' };
  }
  if (kind === 'group' && !isGroupAccountUserType(user.userType)) {
    return { ok: false, status: 403, error: 'Group admin only' };
  }
  return { ok: true, userId: user.id };
}

function parseKind(raw: string | null): OrgEntityKind | null {
  if (raw === 'coach' || raw === 'team' || raw === 'group') return raw;
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kind = parseKind(searchParams.get('kind'));
  if (!kind) return NextResponse.json({ error: 'kind required (coach|team|group)' }, { status: 400 });

  const auth = await requireOrgSender(request, kind);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (searchParams.get('entities') === '1') {
    if (kind === 'coach') {
      const groups = await prisma.coachingGroup.findMany({
        where: { coachId: auth.userId },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      });
      return NextResponse.json({ entities: groups, label: 'coaching groups' });
    }
    if (kind === 'team') {
      const teams = await prisma.team.findMany({
        where: { adminId: auth.userId },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      });
      return NextResponse.json({ entities: teams, label: 'teams' });
    }
    const groups = await prisma.group.findMany({
      where: { adminId: auth.userId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ entities: groups, label: 'groups' });
  }

  try {
    const result = await listOrgSentNotifications({
      userId: auth.userId,
      source: sourceForKind(kind),
      entityId: searchParams.get('entityId'),
      search: searchParams.get('q') || '',
      page: Number(searchParams.get('page') || '1'),
      pageSize: Number(searchParams.get('pageSize') || '10'),
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('GET /api/notifications/org', e);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const kind = parseKind(typeof body?.kind === 'string' ? body.kind : null);
    if (!kind) return NextResponse.json({ error: 'kind required' }, { status: 400 });

    const auth = await requireOrgSender(request, kind);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (body?.action === 'delete_range') {
      const fromDate = typeof body?.fromDate === 'string' ? body.fromDate : '';
      const toDate = typeof body?.toDate === 'string' ? body.toDate : '';
      if (!fromDate || !toDate) {
        return NextResponse.json({ error: 'fromDate and toDate required' }, { status: 400 });
      }
      const deleted = await deleteNotificationsInDateRange({
        source: sourceForKind(kind),
        submittedByUserId: auth.userId,
        fromDate,
        toDate,
        entityId: typeof body?.entityId === 'string' ? body.entityId : null,
      });
      return NextResponse.json({ ok: true, deleted });
    }

    const entityIds = Array.isArray(body?.entityIds)
      ? body.entityIds.map(String)
      : typeof body?.entityId === 'string' && body.entityId
        ? [body.entityId]
        : [];

    const row = await createOrUpdateOrgNotification({
      kind,
      title: typeof body?.title === 'string' ? body.title : '',
      description: typeof body?.description === 'string' ? body.description : '',
      path: typeof body?.path === 'string' ? body.path : '',
      untilDate: typeof body?.untilDate === 'string' ? body.untilDate : new Date().toISOString().slice(0, 10),
      prioritary: Boolean(body?.prioritary),
      entityIds,
      submittedByUserId: auth.userId,
      editId: typeof body?.editId === 'string' ? body.editId : undefined,
    });
    return NextResponse.json({ id: row.id, ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to save';
    console.error('POST /api/notifications/org', e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const kind = parseKind(typeof body?.kind === 'string' ? body.kind : null);
    if (!kind) return NextResponse.json({ error: 'kind required' }, { status: 400 });

    const auth = await requireOrgSender(request, kind);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const id = typeof body?.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    if (typeof body?.isShow === 'boolean') {
      const owned = await prisma.notification.findFirst({
        where: { id, source: sourceForKind(kind), submittedByUserId: auth.userId },
      });
      if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await toggleNotificationVisibility(id, body.isShow, sourceForKind(kind));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  } catch (e) {
    console.error('PATCH /api/notifications/org', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kind = parseKind(searchParams.get('kind'));
  if (!kind) return NextResponse.json({ error: 'kind required' }, { status: 400 });

  const auth = await requireOrgSender(request, kind);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await deleteNotification(id, { source: sourceForKind(kind), submittedByUserId: auth.userId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/notifications/org', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
