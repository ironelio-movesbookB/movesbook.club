import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import { fetchExpenseFormOptions } from '@/lib/procedures/expenseFormOptions';
import { fetchMemberDebtFormOptions } from '@/lib/procedures/memberDebtFormOptions';
import { fetchMemberCreditFormOptions } from '@/lib/procedures/memberCreditFormOptions';
import { fetchProductSaleFormOptions } from '@/lib/procedures/productSaleFormOptions';
import { fetchServiceSaleFormOptions } from '@/lib/procedures/serviceSaleFormOptions';
import { fetchMembershipFormOptions } from '@/lib/procedures/membershipFormOptions';
import { fetchCourseSubscriptionFormOptions } from '@/lib/procedures/courseSubscriptionFormOptions';
import { isKnownProcedureType } from '@/lib/procedures/validators';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { type: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    if (!isKnownProcedureType(params.type)) {
      return NextResponse.json({ error: `Unknown procedure type: ${params.type}` }, { status: 400 });
    }

    if (params.type === PROCEDURE_TYPE_CODES.SERVICE_SALE) {
      const options = await fetchServiceSaleFormOptions(auth.ctx.club.id, auth.ctx.userId);
      return NextResponse.json(options);
    }

    if (params.type === PROCEDURE_TYPE_CODES.EXPENSE) {
      const options = await fetchExpenseFormOptions(auth.ctx);
      return NextResponse.json(options);
    }

    if (params.type === PROCEDURE_TYPE_CODES.PRODUCT_SALE) {
      const options = await fetchProductSaleFormOptions(auth.ctx);
      return NextResponse.json(options);
    }

    if (params.type === PROCEDURE_TYPE_CODES.MEMBER_DEBT) {
      const options = await fetchMemberDebtFormOptions(auth.ctx);
      return NextResponse.json(options);
    }

    if (params.type === PROCEDURE_TYPE_CODES.MEMBER_CREDIT) {
      const options = await fetchMemberCreditFormOptions(auth.ctx);
      return NextResponse.json(options);
    }

    if (params.type === PROCEDURE_TYPE_CODES.MEMBERSHIP) {
      const options = await fetchMembershipFormOptions(auth.ctx);
      return NextResponse.json(options);
    }

    if (params.type === PROCEDURE_TYPE_CODES.COURSE_SUBSCRIPTION) {
      const options = await fetchCourseSubscriptionFormOptions(auth.ctx);
      return NextResponse.json(options);
    }

    return NextResponse.json({ error: 'Form options not implemented for this procedure type' }, { status: 501 });
  } catch (error) {
    console.error('GET procedure form-options:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
