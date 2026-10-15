import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { migrateBrowserVersionEditData } from '@/lib/admin/versionSettingsStore';
import type { SubscriptionEditData } from '@/types/adminSubscriptionSettings';

export const dynamic = 'force-dynamic';

/** POST — move version settings saved in a staff browser (old localStorage storage) into the database. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as { versions?: SubscriptionEditData[] } | null;
  const versions = Array.isArray(body?.versions) ? body.versions : [];

  try {
    const migrated = await migrateBrowserVersionEditData(versions, auth.adminUserId);
    return NextResponse.json({ ok: true, migrated });
  } catch (error) {
    console.error('subscription-versions migrate', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
