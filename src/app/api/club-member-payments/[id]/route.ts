import { NextResponse } from 'next/server';
import { getMemberOnlinePayment } from '@/lib/club/memberOnlinePayments';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const payment = await getMemberOnlinePayment(params.id);
  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  return NextResponse.json({
    id: payment.id,
    status: payment.status,
    amountEur: payment.amountEur,
    description: payment.description,
    entityName: payment.entityName,
    memberName: payment.memberName,
    provider: payment.provider,
  });
}
