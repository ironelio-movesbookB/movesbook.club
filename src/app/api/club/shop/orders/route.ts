import { NextRequest, NextResponse } from 'next/server';
import { requireShopManager } from '@/lib/shop/auth';
import { createStaffOrders, listOrders, updateOrder } from '@/lib/shop/service';

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : 'Could not save the order.';
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const auth = await requireShopManager(request);
  if ('error' in auth) return auth.error;
  const orders = await listOrders(auth.workspace);
  return NextResponse.json({ orders });
}

export async function POST(request: NextRequest) {
  const auth = await requireShopManager(request);
  if ('error' in auth) return auth.error;
  try {
    const body = await request.json();
    const orders = await createStaffOrders(auth.workspace, {
      items: Array.isArray(body.items) ? body.items : [],
      paid: Boolean(body.paid),
      discount: Number(body.discount) || 0,
      buyer: body.buyer,
      buyers: Array.isArray(body.buyers) ? body.buyers : undefined,
    });
    return NextResponse.json({ orders });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireShopManager(request);
  if ('error' in auth) return auth.error;
  try {
    const body = await request.json();
    const orderId = typeof body.orderId === 'string' ? body.orderId : '';
    if (!orderId) return NextResponse.json({ error: 'Order id is required.' }, { status: 400 });
    const order = await updateOrder(auth.workspace, orderId, {
      status: typeof body.status === 'string' ? body.status : undefined,
      paid: typeof body.paid === 'boolean' ? body.paid : undefined,
      discount: typeof body.discount === 'number' ? body.discount : undefined,
      paymentMethod: typeof body.paymentMethod === 'string' ? body.paymentMethod : undefined,
      items: Array.isArray(body.items) ? body.items : undefined,
      customer: body.customer && typeof body.customer === 'object' ? body.customer : undefined,
    });
    return NextResponse.json({ order });
  } catch (error) {
    return fail(error);
  }
}
