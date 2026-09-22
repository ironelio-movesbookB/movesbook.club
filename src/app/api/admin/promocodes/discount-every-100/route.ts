import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import {
  getDiscountEvery100Settings,
  setDiscountEvery100Settings,
} from '@/lib/promocodes/promocodeAppSettings';
import { ensurePromocodeMetaTables } from '@/lib/promocodes/ensureMetaTables';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    await ensurePromocodeMetaTables();
    const settings = await getDiscountEvery100Settings();
    return NextResponse.json(settings);
  } catch (e) {
    console.error('discount-every-100 GET:', e);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { enabled?: boolean; percent?: number | string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    await ensurePromocodeMetaTables();
    const settings = await setDiscountEvery100Settings({
      enabled: Boolean(body.enabled),
      percent: Number(body.percent),
    });
    return NextResponse.json(settings);
  } catch (e) {
    console.error('discount-every-100 PUT:', e);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
