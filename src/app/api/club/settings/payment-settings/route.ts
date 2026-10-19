import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures/clubAuth';
import {
  loadPaymentFrequentSettings,
  savePaymentFrequentSettings,
} from '@/lib/club/paymentFrequentSettingsStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;
    if (auth.ctx.workspaceKind !== 'club') {
      return NextResponse.json({ error: 'Payment settings are available for clubs' }, { status: 403 });
    }
    const settings = await loadPaymentFrequentSettings(auth.ctx.club.id);
    return NextResponse.json({ settings, clubName: auth.ctx.club.name });
  } catch (error) {
    console.error('GET club payment settings:', error);
    return NextResponse.json({ error: 'Failed to load payment settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;
    if (auth.ctx.workspaceKind !== 'club') {
      return NextResponse.json({ error: 'Payment settings are available for clubs' }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const settings = await savePaymentFrequentSettings(auth.ctx.club.id, body);
    return NextResponse.json({ settings, clubName: auth.ctx.club.name });
  } catch (error) {
    console.error('PUT club payment settings:', error);
    return NextResponse.json({ error: 'Failed to save payment settings' }, { status: 500 });
  }
}
