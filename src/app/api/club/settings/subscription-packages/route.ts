import { NextRequest, NextResponse } from 'next/server';
import {
  createShareToken,
  fetchPackagesTable,
  getAuthorizedContext,
  text,
  updateServiceOrder
} from '@/lib/clubSubscriptionPackages.server';

export const dynamic = 'force-dynamic';

/** "All subscription packages" comparison table. Legacy: clubsetting_subscription_packages. */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;
    const { services, packages } = await fetchPackagesTable(context);
    return NextResponse.json({ club: context.club, services, packages });
  } catch (error) {
    console.error('GET subscription-packages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Column drag & drop: persist service order_position. Legacy: update_special_service_order. */
export async function PUT(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.serviceOrders) || body.serviceOrders.length === 0) {
      return NextResponse.json({ success: false, error: 'No order data provided' }, { status: 400 });
    }
    const orders = body.serviceOrders.map((order: Record<string, unknown>) => ({
      id: text(order.id),
      orderPosition: Number(order.orderPosition)
    }));
    const count = await updateServiceOrder(context, orders);
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('PUT subscription-packages:', error);
    return NextResponse.json({ success: false, error: 'Error updating service order' }, { status: 500 });
  }
}

/** "Get link": signed read-only link valid 30 days. Legacy: generate_shareable_link. */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;
    const { data, token } = createShareToken(context);
    const origin = request.headers.get('origin') || request.nextUrl.origin;
    const link = `${origin}/shared/subscription_packages?data=${encodeURIComponent(data)}&token=${encodeURIComponent(token)}`;
    return NextResponse.json({ success: true, link });
  } catch (error) {
    console.error('POST subscription-packages:', error);
    return NextResponse.json({ success: false, error: 'Error generating link' }, { status: 500 });
  }
}
