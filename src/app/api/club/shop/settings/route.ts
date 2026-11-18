import { NextRequest, NextResponse } from 'next/server';
import { requireShopManager } from '@/lib/shop/auth';
import { ensureShopSettings, settingsDto } from '@/lib/shop/service';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const auth = await requireShopManager(request);
  if ('error' in auth) return auth.error;
  const settings = await ensureShopSettings(auth.workspace);
  return NextResponse.json(settingsDto(settings, auth.workspace));
}

export async function PUT(request: NextRequest) {
  const auth = await requireShopManager(request);
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const current = await ensureShopSettings(auth.workspace);
  const shopName = typeof body.shopName === 'string' ? body.shopName.trim() : current.displayName;
  if (!shopName) {
    return NextResponse.json({ error: 'Enter the club or team name.' }, { status: 400 });
  }
  const saved = await prisma.shopSettings.update({
    where: { id: current.id },
    data: {
      displayName: shopName,
      shopDescription: typeof body.shopDescription === 'string' ? body.shopDescription : current.shopDescription,
      shopActive: typeof body.shopActive === 'boolean' ? body.shopActive : current.shopActive,
      orderEmailsEnabled:
        typeof body.orderEmailsEnabled === 'boolean' ? body.orderEmailsEnabled : current.orderEmailsEnabled,
    },
  });
  return NextResponse.json(settingsDto(saved, auth.workspace));
}
