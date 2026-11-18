import { NextRequest, NextResponse } from 'next/server';
import { requireShopManager } from '@/lib/shop/auth';
import { listBuyers } from '@/lib/shop/service';

export async function GET(request: NextRequest) {
  const auth = await requireShopManager(request);
  if ('error' in auth) return auth.error;
  return NextResponse.json(await listBuyers(auth.workspace));
}
