import { NextRequest, NextResponse } from 'next/server';
import { requireShopManager } from '@/lib/shop/auth';
import { ensureShopSettings, settingsDto, shopHeaderMode, shopOnlinePaymentReady } from '@/lib/shop/service';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const auth = await requireShopManager(request);
  if ('error' in auth) return auth.error;
  const settings = await ensureShopSettings(auth.workspace);
  return NextResponse.json({
    ...settingsDto(settings, auth.workspace),
    onlinePaymentReady: await shopOnlinePaymentReady(auth.workspace.id),
  });
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
  const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
  const textOr = (value: unknown, fallback: string | null) =>
    typeof value === 'string' ? value.trim() || null : fallback;
  const onsitePaymentEnabled = flag(body.onsitePaymentEnabled, current.onsitePaymentEnabled);
  const bankTransferEnabled = flag(body.bankTransferEnabled, current.bankTransferEnabled);
  const onlinePaymentEnabled = flag(body.onlinePaymentEnabled, current.onlinePaymentEnabled);
  const bankTransferDetails = textOr(body.bankTransferDetails, current.bankTransferDetails);
  if (!onsitePaymentEnabled && !bankTransferEnabled && !onlinePaymentEnabled) {
    return NextResponse.json({ error: 'Keep at least one payment method active.' }, { status: 400 });
  }
  if (bankTransferEnabled && !bankTransferDetails) {
    return NextResponse.json(
      { error: 'Enter the bank details customers need for the bank transfer.' },
      { status: 400 },
    );
  }
  const saved = await prisma.shopSettings.update({
    where: { id: current.id },
    data: {
      onsitePaymentEnabled,
      bankTransferEnabled,
      bankTransferDetails,
      onlinePaymentEnabled,
      shopAlert: textOr(body.shopAlert, current.shopAlert),
      afterSalesInfo: textOr(body.afterSalesInfo, current.afterSalesInfo),
      displayName: shopName,
      shopDescription: typeof body.shopDescription === 'string' ? body.shopDescription : current.shopDescription,
      shopActive: typeof body.shopActive === 'boolean' ? body.shopActive : current.shopActive,
      orderEmailsEnabled:
        typeof body.orderEmailsEnabled === 'boolean' ? body.orderEmailsEnabled : current.orderEmailsEnabled,
      headerMode: typeof body.headerMode === 'string' ? shopHeaderMode(body.headerMode) : current.headerMode,
    },
  });
  return NextResponse.json({
    ...settingsDto(saved, auth.workspace),
    onlinePaymentReady: await shopOnlinePaymentReady(auth.workspace.id),
  });
}
