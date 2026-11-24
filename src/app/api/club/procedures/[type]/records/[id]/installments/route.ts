import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import { isKnownProcedureType } from '@/lib/procedures/validators';
import {
  createInstallment,
  deleteInstallment,
  listInstallments,
  updateInstallment,
} from '@/lib/procedures/installmentService';
import { DeadlineDeleteError, deleteSingleDeadline } from '@/lib/procedures/deleteDeadline';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { type: string; id: string } };

async function recordBelongsToClub(recordId: string, clubId: string) {
  const record = await prisma.procedureRecord.findFirst({
    where: { id: recordId, clubId },
    select: { id: true },
  });
  return record != null;
}

const recordNotFound = () => NextResponse.json({ error: 'Record not found' }, { status: 404 });

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;
    if (!isKnownProcedureType(params.type)) {
      return NextResponse.json({ error: 'Unknown procedure type' }, { status: 400 });
    }
    if (!(await recordBelongsToClub(params.id, auth.ctx.club.id))) return recordNotFound();
    const items = await listInstallments(params.id);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('GET installments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;
    if (!isKnownProcedureType(params.type)) {
      return NextResponse.json({ error: 'Unknown procedure type' }, { status: 400 });
    }
    if (!(await recordBelongsToClub(params.id, auth.ctx.club.id))) return recordNotFound();

    const body = await request.json();
    const installment = await createInstallment({
      procedureRecordId: params.id,
      balance: Number(body.balance) || 0,
      paid: body.paid != null ? Number(body.paid) : 0,
      paymentDate: String(body.paymentDate),
      expireDate: body.expireDate ?? null,
      description: body.description ?? null,
    });
    return NextResponse.json({ success: true, installment });
  } catch (error) {
    console.error('POST installment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const installmentId = request.nextUrl.searchParams.get('id');
    if (!installmentId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (!(await recordBelongsToClub(params.id, auth.ctx.club.id))) return recordNotFound();

    const body = await request.json();
    const installment = await updateInstallment(installmentId, params.id, {
      ...(body.balance != null ? { balance: Number(body.balance) } : {}),
      ...(body.paid != null ? { paid: Number(body.paid) } : {}),
      ...(body.paymentDate ? { paymentDate: String(body.paymentDate) } : {}),
      ...(body.expireDate !== undefined ? { expireDate: body.expireDate } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
    });

    if (!installment) {
      return NextResponse.json({ error: 'Installment not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, installment });
  } catch (error) {
    console.error('PUT installment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const installmentId = request.nextUrl.searchParams.get('id');
    if (!installmentId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    if (request.nextUrl.searchParams.get('mode') === 'archive') {
      if (!isKnownProcedureType(params.type)) {
        return NextResponse.json({ error: 'Unknown procedure type' }, { status: 400 });
      }
      try {
        const result = await deleteSingleDeadline(auth.ctx, params.type, params.id, installmentId);
        return NextResponse.json({ success: true, ...result });
      } catch (error) {
        if (error instanceof DeadlineDeleteError) {
          return NextResponse.json({ error: error.message }, { status: error.status });
        }
        throw error;
      }
    }

    if (!(await recordBelongsToClub(params.id, auth.ctx.club.id))) return recordNotFound();
    const ok = await deleteInstallment(installmentId, params.id);
    if (!ok) return NextResponse.json({ error: 'Installment not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE installment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
