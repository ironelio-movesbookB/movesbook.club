import { NextRequest, NextResponse } from 'next/server';
import { faqAdminGuard, faqServerError } from '@/lib/faqs/faqApiAuth';
import { saveListOrder } from '@/lib/faqs/faqService';

export const dynamic = 'force-dynamic';

/** Save the order dragged by the operator ("set"). Body { itemIds: string[] } in visible order. */
export async function PUT(request: NextRequest) {
  const denied = await faqAdminGuard(request);
  if (denied) return denied;
  try {
    const body = (await request.json().catch(() => null)) as { itemIds?: unknown } | null;
    const itemIds = Array.isArray(body?.itemIds)
      ? body!.itemIds.filter((i): i is string => typeof i === 'string')
      : [];
    await saveListOrder(itemIds);
    return NextResponse.json({ success: true });
  } catch (error) {
    return faqServerError('order', error);
  }
}
