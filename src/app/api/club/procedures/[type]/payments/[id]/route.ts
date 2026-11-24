import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext, procedureService } from '@/lib/procedures';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { type: string; id: string } };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const body = (await request.json()) as { paymentDate?: string; notes?: string; operatorId?: string };

    await procedureService.updatePayment(auth.ctx, params.type, params.id, {
      paymentDate: body.paymentDate,
      notes: body.notes,
      operatorId: body.operatorId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Payment not found' ? 404 : 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    await procedureService.deletePayment(auth.ctx, params.type, params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Payment not found' ? 404 : 500 });
  }
}
