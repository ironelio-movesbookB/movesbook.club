import { NextRequest, NextResponse } from 'next/server';
import { requirePaymentSettingsAdmin } from '@/lib/payments/paymentAdminAuth';
import {
  getPaymentSettingsAdmin,
  savePaymentSettings,
  type PaymentSettingsInput,
} from '@/lib/payments/paymentSettings';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePaymentSettingsAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    return NextResponse.json({ settings: await getPaymentSettingsAdmin() });
  } catch (e) {
    console.error('GET payment settings', e);
    return NextResponse.json({ error: 'Failed to load payment settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requirePaymentSettingsAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = (await request.json().catch(() => ({}))) as PaymentSettingsInput;
    return NextResponse.json({ settings: await savePaymentSettings(body) });
  } catch (e) {
    console.error('PUT payment settings', e);
    return NextResponse.json({ error: 'Failed to save payment settings' }, { status: 500 });
  }
}
