import { NextRequest, NextResponse } from 'next/server';
import { requireShopManager } from '@/lib/shop/auth';
import { payOrderInFull } from '@/lib/shop/service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireShopManager(request);
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  try {
    const result = await payOrderInFull(auth.workspace, params.id, String(body.paymentMethod ?? ''));
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not pay this order.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
