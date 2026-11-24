import { NextRequest, NextResponse } from 'next/server';
import { resolveSponsorWorkspace, sponsorErrorResponse } from '@/lib/club/sponsors/sponsorApi';
import { deletePayment, savePayment, setPaymentPaid } from '@/lib/club/sponsors/sponsorService';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; paymentId: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id, paymentId } = await params;
    const body = await request.json().catch(() => ({}));
    const sponsor =
      typeof body?.paid === 'boolean'
        ? await setPaymentPaid(auth.ws, id, paymentId, body.paid)
        : await savePayment(auth.ws, id, body ?? {}, paymentId);
    return NextResponse.json({ sponsor });
  } catch (error) {
    return sponsorErrorResponse(error, 'PATCH /api/club/sponsors/[id]/payments/[paymentId]');
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id, paymentId } = await params;
    return NextResponse.json({ sponsor: await deletePayment(auth.ws, id, paymentId) });
  } catch (error) {
    return sponsorErrorResponse(error, 'DELETE /api/club/sponsors/[id]/payments/[paymentId]');
  }
}
