import { NextRequest, NextResponse } from 'next/server';
import { requireShopManager } from '@/lib/shop/auth';
import { createCustomer, listCustomers, listOrders } from '@/lib/shop/service';

export async function GET(request: NextRequest) {
  const auth = await requireShopManager(request);
  if ('error' in auth) return auth.error;
  const [orders, customers] = await Promise.all([
    listOrders(auth.workspace),
    listCustomers(auth.workspace),
  ]);
  return NextResponse.json({
    orders,
    customers: customers.map((customer) => ({
      id: customer.id,
      email: customer.email,
      name: [customer.firstName, customer.surname].filter(Boolean).join(' ').trim(),
      photoUrl: customer.photoUrl,
      taxCode: customer.taxCode,
      phone: customer.phone,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireShopManager(request);
  if ('error' in auth) return auth.error;
  try {
    const body = await request.json();
    const customer = await createCustomer(auth.workspace, body);
    return NextResponse.json(customer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create the customer.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
