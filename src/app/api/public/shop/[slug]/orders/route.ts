import { NextRequest, NextResponse } from 'next/server';
import { createPublicOrder } from '@/lib/shop/service';
import { publicOrderClientKey, takePublicOrderSlot } from '@/lib/shop/publicOrderRateLimit';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const slot = takePublicOrderSlot(publicOrderClientKey(request, slug));
  if (!slot.ok) {
    return NextResponse.json(
      { error: 'Too many orders from this network. Please wait before placing another.' },
      {
        status: 429,
        headers: { 'Retry-After': String(slot.retryAfterSec) },
      },
    );
  }

  try {
    const body = await request.json();
    const userType = body.userType === 'affiliated' ? 'affiliated' : 'non-affiliated';
    const order = await createPublicOrder(slug, {
      userType,
      customerDetails: body.customerDetails ?? {},
      items: Array.isArray(body.items) ? body.items : [],
    });
    return NextResponse.json({ orderNumber: order.orderNumber, order });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not place your order.';
    const status = /closed|not be found|matches/i.test(message) ? 400 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
