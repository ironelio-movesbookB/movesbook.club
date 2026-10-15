import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { saveVersionSettings } from '@/lib/subscriptions/versionSettingsStore';
import type { SubscriptionEditData } from '@/types/adminSubscriptionSettings';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const versionId = Number((await params).versionId);
  if (!Number.isInteger(versionId) || versionId <= 0) {
    return NextResponse.json({ error: 'Invalid version' }, { status: 400 });
  }

  try {
    const body = (await request.json()) as SubscriptionEditData;
    if (!body || typeof body !== 'object' || !body.general || !body.settings) {
      return NextResponse.json({ error: 'Invalid settings' }, { status: 400 });
    }
    await saveVersionSettings({ ...body, id: versionId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PUT version settings', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save' },
      { status: 400 },
    );
  }
}
