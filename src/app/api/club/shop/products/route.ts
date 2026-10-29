import { NextRequest, NextResponse } from 'next/server';
import { requireShopManager } from '@/lib/shop/auth';
import {
  deleteProduct,
  listProducts,
  saveProduct,
} from '@/lib/shop/service';

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : 'Could not save the product.';
  const status = /not be found/i.test(message) ? 404 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const auth = await requireShopManager(request);
  if ('error' in auth) return auth.error;
  const products = await listProducts(auth.workspace);
  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  const auth = await requireShopManager(request);
  if ('error' in auth) return auth.error;
  try {
    const body = await request.json();
    const product = await saveProduct(auth.workspace, body);
    return NextResponse.json(product);
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireShopManager(request);
  if ('error' in auth) return auth.error;
  try {
    const body = await request.json();
    if (!body?.id) return NextResponse.json({ error: 'Product id is required.' }, { status: 400 });
    const product = await saveProduct(auth.workspace, body);
    return NextResponse.json(product);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireShopManager(request);
  if ('error' in auth) return auth.error;
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Product id is required.' }, { status: 400 });
  try {
    await deleteProduct(auth.workspace, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
