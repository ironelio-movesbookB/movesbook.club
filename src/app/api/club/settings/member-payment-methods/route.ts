import { NextRequest, NextResponse } from 'next/server';
import { toPublicMemberPaymentSettings } from '@/lib/club/memberPaymentMethods';
import {
  loadStoredMemberPaymentMethods,
  saveStoredMemberPaymentMethods,
} from '@/lib/club/memberPaymentMethodsStore';
import { getMemberPaymentMode } from '@/lib/payments/paymentSettings';
import { getClubAuthContext } from '@/lib/procedures/clubAuth';

export const dynamic = 'force-dynamic';

function entityOf(auth: Awaited<ReturnType<typeof getClubAuthContext>>) {
  if ('error' in auth) return auth;
  if (auth.ctx.workspaceKind !== 'club' && auth.ctx.workspaceKind !== 'team') {
    return {
      error: NextResponse.json(
        { error: 'Payment methods are available for a club or a team' },
        { status: 403 },
      ),
    };
  }
  return { id: auth.ctx.club.id, name: auth.ctx.club.name, kind: auth.ctx.workspaceKind };
}

export async function GET(request: NextRequest) {
  try {
    const entity = entityOf(await getClubAuthContext(request));
    if ('error' in entity) return entity.error;
    const stored = await loadStoredMemberPaymentMethods(entity.id);
    const siteMode = await getMemberPaymentMode();
    return NextResponse.json({
      settings: toPublicMemberPaymentSettings(stored, siteMode),
      entityName: entity.name,
      workspaceKind: entity.kind,
    });
  } catch (error) {
    console.error('GET member payment methods:', error);
    return NextResponse.json({ error: 'Failed to load payment methods' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const entity = entityOf(await getClubAuthContext(request));
    if ('error' in entity) return entity.error;
    const body = await request.json().catch(() => ({}));
    const stored = await saveStoredMemberPaymentMethods(entity.id, body);
    const siteMode = await getMemberPaymentMode();
    return NextResponse.json({
      settings: toPublicMemberPaymentSettings(stored, siteMode),
      entityName: entity.name,
      workspaceKind: entity.kind,
    });
  } catch (error) {
    console.error('PUT member payment methods:', error);
    return NextResponse.json({ error: 'Failed to save payment methods' }, { status: 500 });
  }
}
