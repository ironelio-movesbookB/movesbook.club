import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { saveVersionEditData } from '@/lib/admin/versionSettingsStore';
import type { SubscriptionEditData } from '@/types/adminSubscriptionSettings';

export const dynamic = 'force-dynamic';

/** PUT — Movesbook staff saves a version's settings. */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const id = Number(params.id);
  const body = (await request.json().catch(() => null)) as { data?: SubscriptionEditData } | null;
  const data = body?.data;
  if (!Number.isFinite(id) || !data || data.id !== id || !data.settings || !data.general) {
    return NextResponse.json({ error: 'Invalid version settings' }, { status: 400 });
  }

  try {
    const saved = await saveVersionEditData(data, auth.adminUserId);
    if (!saved) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('subscription-versions PUT', error);
    return NextResponse.json({ error: 'Could not save the version settings' }, { status: 500 });
  }
}
