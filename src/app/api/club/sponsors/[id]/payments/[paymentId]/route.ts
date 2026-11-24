import { NextRequest, NextResponse } from 'next/server';
import { resolveSponsorWorkspace, sponsorErrorResponse } from '@/lib/club/sponsors/sponsorApi';
import {
  deletePayment,
  savePayment,
  setPaymentPaid,
  settlePayment,
} from '@/lib/club/sponsors/sponsorService';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; paymentId: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id, paymentId } = await params;
    const body = await request.json().catch(() => ({}));
    let sponsor;
    if (body?.settleMode === 'whole' || body?.settleMode === 'partial' || body?.settleMode === 'unpaid') {
      let operatorUsername =
        typeof body.operatorUsername === 'string' ? body.operatorUsername.trim() : '';
      if (!operatorUsername) {
        try {
          const { getClubAuthContext } = await import('@/lib/procedures/clubAuth');
          const { prisma } = await import('@/lib/prisma');
          const authCtx = await getClubAuthContext(request);
          if (!('error' in authCtx)) {
            const user = await prisma.user.findUnique({
              where: { id: authCtx.ctx.userId },
              select: { username: true },
            });
            operatorUsername = user?.username?.trim() || '';
          }
        } catch {
          /* keep empty */
        }
      }
      sponsor = await settlePayment(auth.ws, id, paymentId, {
        mode: body.settleMode,
        paidAmount: body.paidAmount,
        payMode: body.payMode,
        annotations: body.annotations,
        operatorUsername,
        paymentDate: body.paymentDate,
      });
    } else if (typeof body?.paid === 'boolean') {
      sponsor = await setPaymentPaid(auth.ws, id, paymentId, body.paid);
    } else {
      sponsor = await savePayment(auth.ws, id, body ?? {}, paymentId);
    }
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
