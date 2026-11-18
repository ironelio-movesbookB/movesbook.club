import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import {
  buildExpenseStatistics,
  parseAmountBasis,
  parseBranchMode,
  parseStatsView,
} from '@/lib/club/buildExpenseStatistics';

export const dynamic = 'force-dynamic';

/**
 * GET /api/club/procedures/expense/statistics
 *   ?view=A|B|C|D|E|F  &branchMode=main|sub  &expenseId=  &month=1-12  &year=YYYY  &amount=total|paid
 * Scoped to the authenticated club (same auth as the procedure archive APIs).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const sp = request.nextUrl.searchParams;
    const yearRaw = Number(sp.get('year'));
    const monthRaw = Number(sp.get('month'));

    const payload = await buildExpenseStatistics(auth.ctx, {
      view: parseStatsView(sp.get('view')),
      branchMode: parseBranchMode(sp.get('branchMode')),
      amountBasis: parseAmountBasis(sp.get('amount')),
      expenseId: sp.get('expenseId'),
      year: Number.isFinite(yearRaw) && yearRaw > 0 ? Math.trunc(yearRaw) : null,
      month: Number.isFinite(monthRaw) && monthRaw > 0 ? Math.trunc(monthRaw) : null,
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error('GET /api/club/procedures/expense/statistics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
