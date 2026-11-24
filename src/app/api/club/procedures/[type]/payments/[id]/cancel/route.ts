import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext, procedureService } from '@/lib/procedures';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { type: string; id: string } };

function errorStatus(message: string): number {
  if (message === 'Payment not found') return 404;
  if (message === 'Unknown procedure type') return 400;
  if (
    message === 'Payment has already been cancelled' ||
    message === 'A reversal transaction cannot be cancelled' ||
    message === 'Only original payments can be cancelled' ||
    message === 'Payment state changed. Refresh the archive and try again.'
  ) {
    return 409;
  }
  return 500;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    await procedureService.cancelPayment(auth.ctx, params.type, params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (errorStatus(message) === 500) console.error('POST cancel procedure payment:', error);
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}