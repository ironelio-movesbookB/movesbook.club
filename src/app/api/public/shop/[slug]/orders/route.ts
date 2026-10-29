import { NextRequest, NextResponse } from 'next/server';
import { createPublicOrder } from '@/lib/shop/service';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const body = await request.json();
    const userType = body.userType === 'affiliated' ? 'affiliated' : 'non-affiliated';
    const order = await createPublicOrder(params.slug, {
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
