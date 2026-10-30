import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import {
  getSpecialUpgradeAdmin,
  saveSpecialUpgrade,
} from '@/lib/subscriptions/specialUpgrades';

export const dynamic = 'force-dynamic';

function parseVersionId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const versionId = parseVersionId((await params).versionId);
  if (!versionId) return NextResponse.json({ error: 'Invalid version' }, { status: 400 });

  try {
    return NextResponse.json({ offer: await getSpecialUpgradeAdmin(versionId) });
  } catch (e) {
    console.error('GET special upgrade', e);
    return NextResponse.json({ error: 'Failed to load the special upgrade' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const versionId = parseVersionId((await params).versionId);
  if (!versionId) return NextResponse.json({ error: 'Invalid version' }, { status: 400 });

  try {
    const body = await request.json().catch(() => ({}));
    const offer = await saveSpecialUpgrade({ ...body, versionId });
    return NextResponse.json({ offer });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to save the special upgrade';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
