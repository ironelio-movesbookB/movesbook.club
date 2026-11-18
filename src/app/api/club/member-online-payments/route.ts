import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClubAuthContext } from '@/lib/procedures/clubAuth';
import {
  createMemberOnlinePayment,
  emailMemberPayLink,
  onlineProviderForMethod,
} from '@/lib/club/memberOnlinePayments';
import { memberGatewayReady } from '@/lib/club/memberPaymentMethods';
import { loadStoredMemberPaymentMethods } from '@/lib/club/memberPaymentMethodsStore';
import { getMemberPaymentMode } from '@/lib/payments/paymentSettings';
import { registrationOrigin } from '@/lib/registration/registrationFlow';

export const dynamic = 'force-dynamic';

type LineInput = { recordId?: unknown; amount?: unknown };

/** Starts a club/team pay link from the reception payment form and emails it. */
export async function POST(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;
    if (auth.ctx.workspaceKind !== 'club' && auth.ctx.workspaceKind !== 'team') {
      return NextResponse.json({ error: 'Payment links are available for a club or a team' }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      memberUserId?: unknown;
      amountEur?: unknown;
      description?: unknown;
      payMode?: unknown;
      procedureType?: unknown;
      operatorId?: unknown;
      paymentDate?: unknown;
      lines?: LineInput[];
    };

    const memberUserId = String(body.memberUserId ?? '').trim();
    const payMode = String(body.payMode ?? '').trim();
    const procedureType = String(body.procedureType ?? '').trim();
    const provider = onlineProviderForMethod(payMode);
    const amountEur = Math.round(Number(body.amountEur) * 100) / 100;
    if (!memberUserId || !provider || !procedureType || procedureType === 'expense') {
      return NextResponse.json({ error: 'Choose credit card, debit card, PayPal, Satispay, or Stripe.' }, { status: 400 });
    }
    if (!Number.isFinite(amountEur) || amountEur <= 0) {
      return NextResponse.json({ error: 'Enter an amount greater than 0.' }, { status: 400 });
    }

    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    const grouped = new Map<string, number>();
    for (const line of rawLines) {
      const recordId = String(line.recordId ?? '').trim();
      const amount = Math.round(Number(line.amount) * 100) / 100;
      if (!recordId || !(amount > 0)) continue;
      grouped.set(recordId, Math.round(((grouped.get(recordId) ?? 0) + amount) * 100) / 100);
    }
    if (grouped.size === 0) {
      return NextResponse.json({ error: 'Select at least one deadline to pay.' }, { status: 400 });
    }
    const allocated = Math.round([...grouped.values()].reduce((sum, value) => sum + value, 0) * 100) / 100;
    if (Math.abs(allocated - amountEur) > 0.02) {
      return NextResponse.json({ error: 'The amount does not match the selected deadlines.' }, { status: 400 });
    }

    const procedureTypeRow = await prisma.procedureType.findFirst({
      where: { code: procedureType, isActive: true },
      select: { id: true },
    });
    if (!procedureTypeRow) {
      return NextResponse.json({ error: 'Unknown payment type' }, { status: 400 });
    }

    for (const recordId of grouped.keys()) {
      const record = await prisma.procedureRecord.findFirst({
        where: {
          id: recordId,
          clubId: auth.ctx.club.id,
          memberId: memberUserId,
          procedureTypeId: procedureTypeRow.id,
          status: 'ACTIVE',
        },
        select: { id: true, balanceAmount: true },
      });
      if (!record) {
        return NextResponse.json({ error: 'That deadline was not found for this member.' }, { status: 404 });
      }
      if (Number(record.balanceAmount) + 0.001 < (grouped.get(recordId) ?? 0)) {
        return NextResponse.json({ error: 'Payment exceeds remaining balance.' }, { status: 400 });
      }
    }

    const stored = await loadStoredMemberPaymentMethods(auth.ctx.club.id);
    const siteMode = await getMemberPaymentMode();
    if (!memberGatewayReady(stored, provider, siteMode)) {
      return NextResponse.json(
        { error: 'Online payment is not connected for the current mode. Save the matching keys under Payment methods for members.' },
        { status: 400 },
      );
    }

    const member = await prisma.user.findUnique({
      where: { id: memberUserId },
      select: { name: true, username: true },
    });
    const description = String(body.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 255) || 'Payment';
    const paymentDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.paymentDate ?? ''))
      ? String(body.paymentDate)
      : new Date().toISOString().slice(0, 10);
    const operatorId = String(body.operatorId ?? '').trim() || auth.ctx.userId;

    const payment = await createMemberOnlinePayment({
      entityId: auth.ctx.club.id,
      entityName: auth.ctx.club.name,
      memberUserId,
      memberName: member?.name?.trim() || member?.username || 'Member',
      createdByUserId: auth.ctx.userId,
      provider,
      amountEur,
      description,
      settlement: [...grouped.entries()].map(([recordId, amount]) => ({
        procedureType,
        recordId,
        amount,
        payMode,
        operatorId,
        paymentDate,
        description,
      })),
    });

    const payUrl = `${registrationOrigin(request)}/pay/club/${payment.id}`;
    const emailed = await emailMemberPayLink({
      memberUserId,
      entityName: auth.ctx.club.name,
      amountEur,
      payUrl,
      description,
    }).catch(() => false);

    return NextResponse.json({ ok: true, payUrl, emailed });
  } catch (error) {
    console.error('POST member online payment:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not create the payment link' },
      { status: 500 },
    );
  }
}
