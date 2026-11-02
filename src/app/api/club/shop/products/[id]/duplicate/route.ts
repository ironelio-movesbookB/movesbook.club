import { NextRequest, NextResponse } from 'next/server';
import { requireShopManager } from '@/lib/shop/auth';
import {
  assertHardwareSuperAdminPassword,
  isHardwareSector,
} from '@/lib/shop/hardwareAuth';
import { duplicateProduct, findProduct } from '@/lib/shop/service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireShopManager(request);
  if ('error' in auth) return auth.error;
  try {
    const existing = await findProduct(auth.workspace, params.id);
    if (isHardwareSector(existing?.sector)) {
      const body = await request.json().catch(() => ({}));
      await assertHardwareSuperAdminPassword(
        body && typeof body === 'object' ? (body as { superAdminPassword?: unknown }).superAdminPassword : '',
      );
    }
    const product = await duplicateProduct(auth.workspace, params.id);
    return NextResponse.json(product);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not duplicate the product.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
