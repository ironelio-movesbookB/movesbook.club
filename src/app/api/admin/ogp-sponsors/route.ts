import { NextRequest, NextResponse } from 'next/server';
import { requireTableSuperAdmin } from '@/lib/globalNewsAuth';
import {
  createSponsorGroup,
  deleteSponsorGroup,
  loadSerializedSponsorSettings,
  renameSponsorGroup,
} from '@/lib/news/ogpSponsorStore';

export const dynamic = 'force-dynamic';

/** GET — super admin: all sponsor groups. */
export async function GET(request: NextRequest) {
  const auth = await requireTableSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await loadSerializedSponsorSettings());
  } catch (e) {
    console.error('GET /api/admin/ogp-sponsors', e);
    return NextResponse.json({ error: 'Failed to load sponsored news' }, { status: 500 });
  }
}

/**
 * POST — create a new empty sponsor group.
 * Body: { action: 'create', name: string }
 *       { action: 'rename', id: string, name: string }
 *       { action: 'delete', id: string }
 */
export async function POST(request: NextRequest) {
  const auth = await requireTableSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'create') {
      const name = typeof body.name === 'string' ? body.name : 'New group';
      const group = await createSponsorGroup(name);
      return NextResponse.json({ group, ...(await loadSerializedSponsorSettings()) });
    }

    if (action === 'rename') {
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      const name = typeof body.name === 'string' ? body.name : '';
      if (!id) return NextResponse.json({ error: 'Group id is required' }, { status: 400 });
      const group = await renameSponsorGroup(id, name);
      return NextResponse.json({ group, ...(await loadSerializedSponsorSettings()) });
    }

    if (action === 'delete') {
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!id) return NextResponse.json({ error: 'Group id is required' }, { status: 400 });
      await deleteSponsorGroup(id);
      return NextResponse.json(await loadSerializedSponsorSettings());
    }

    return NextResponse.json(
      { error: 'Unknown action. Use create, rename, or delete.' },
      { status: 400 },
    );
  } catch (e) {
    console.error('POST /api/admin/ogp-sponsors', e);
    const message = e instanceof Error ? e.message : 'Failed to update sponsor groups';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
