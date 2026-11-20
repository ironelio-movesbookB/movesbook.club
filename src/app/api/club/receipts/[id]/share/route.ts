import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import { getOrCreateReceiptShareToken, receiptSharePath } from '@/lib/procedures/receiptShares';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** Public read-only link of a receipt (Archive of Receipts share banner). */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;
    const { id } = await context.params;
    const token = await getOrCreateReceiptShareToken(id, auth.ctx.club.id);
    if (!token) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    return NextResponse.json({ token, path: receiptSharePath(token) });
  } catch (error) {
    console.error('POST /api/club/receipts/[id]/share', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
