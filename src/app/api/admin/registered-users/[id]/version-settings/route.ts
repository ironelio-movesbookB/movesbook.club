import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import {
  copyVersionSettingsToUser,
  getUserVersionSettings,
  saveUserVersionSettings,
} from '@/lib/admin/versionSettingsStore';
import type { SubscriptionEditData } from '@/types/adminSubscriptionSettings';

export const dynamic = 'force-dynamic';

/** GET — PCU copy of the user's version settings (created from the purchased version if missing). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const versionSettings = await getUserVersionSettings(params.id);
    if (!versionSettings) {
      return NextResponse.json({ error: 'No version settings for this user' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, versionSettings });
  } catch (error) {
    console.error('pcu version-settings GET', error);
    return NextResponse.json({ error: 'Could not load version settings' }, { status: 500 });
  }
}

/**
 * PUT — Movesbook staff edits the user's copy.
 * Body: `{ data }` to save edited fields, or `{ copyFromVersionId }` to re-copy a version.
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as {
    data?: SubscriptionEditData;
    copyFromVersionId?: number;
  } | null;
  if (!body) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    if (body.copyFromVersionId != null) {
      const user = await prisma.user.findUnique({
        where: { id: params.id },
        select: { userType: true },
      });
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      const versionSettings = await copyVersionSettingsToUser(
        params.id,
        Number(body.copyFromVersionId),
        user.userType,
        auth.adminUserId,
      );
      return NextResponse.json({ ok: true, versionSettings });
    }

    if (!body.data?.settings) {
      return NextResponse.json({ error: 'Invalid version settings' }, { status: 400 });
    }
    const versionSettings = await saveUserVersionSettings(params.id, body.data, auth.adminUserId);
    if (!versionSettings) {
      return NextResponse.json({ error: 'No version settings for this user' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, versionSettings });
  } catch (error) {
    console.error('pcu version-settings PUT', error);
    return NextResponse.json({ error: 'Could not save version settings' }, { status: 500 });
  }
}
