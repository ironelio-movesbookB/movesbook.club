import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import {
  createOrUpdateStaffNotification,
  deleteNotification,
  getNotificationById,
  listStaffNotifications,
  toggleNotificationVisibility,
} from '@/lib/notifications/notificationService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (id) {
    const item = await getNotificationById(id);
    if (!item || item.source !== 'movesbook_staff') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ item });
  }

  try {
    const result = await listStaffNotifications({
      search: searchParams.get('q') || '',
      roleFilter: searchParams.get('role') || '',
      recentOnly: searchParams.get('recent') === '1',
      page: Number(searchParams.get('page') || '1'),
      pageSize: Number(searchParams.get('pageSize') || '10'),
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('GET /api/admin/notifications', e);
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const contentsByLang =
      body?.contentsByLang && typeof body.contentsByLang === 'object' && !Array.isArray(body.contentsByLang)
        ? Object.fromEntries(
            Object.entries(body.contentsByLang as Record<string, unknown>).map(([k, v]) => [
              k,
              typeof v === 'string' ? v : '',
            ]),
          )
        : undefined;
    const audienceLanguages = Array.isArray(body?.audienceLanguages)
      ? body.audienceLanguages.map(String)
      : [];

    const row = await createOrUpdateStaffNotification({
      title: typeof body?.title === 'string' ? body.title : '',
      description: typeof body?.description === 'string' ? body.description : '',
      contentsByLang,
      audienceLanguages,
      path: typeof body?.path === 'string' ? body.path : '',
      untilDate: typeof body?.untilDate === 'string' ? body.untilDate : new Date().toISOString().slice(0, 10),
      prioritary: Boolean(body?.prioritary),
      audienceRoles: Array.isArray(body?.audienceRoles) ? body.audienceRoles.map(String) : [],
      usernamesRaw: typeof body?.usernames === 'string' ? body.usernames : '',
      submittedByAdminId: auth.adminUserId,
      submittedByUserId: null,
      editId: typeof body?.editId === 'string' ? body.editId : undefined,
    });
    return NextResponse.json({ id: row.id, ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to save';
    console.error('POST /api/admin/notifications', e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    if (typeof body?.isShow === 'boolean') {
      await toggleNotificationVisibility(id, body.isShow, 'movesbook_staff');
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  } catch (e) {
    console.error('PATCH /api/admin/notifications', e);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await deleteNotification(id, { source: 'movesbook_staff' });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/admin/notifications', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
