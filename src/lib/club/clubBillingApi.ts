import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext, type ClubAuthContext } from '@/lib/procedures';
import { billingWorkspace, ClubBillingError, type BillingWorkspace } from '@/lib/club/clubBillingService';

export function billingErrorResponse(error: unknown, label: string) {
  if (error instanceof ClubBillingError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(label, error);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

/** Club, Team or Coach admin of the selected workspace. */
export async function billingAuth(
  request: NextRequest,
): Promise<{ ws: BillingWorkspace; ctx: ClubAuthContext; userId: string } | { error: NextResponse }> {
  const auth = await getClubAuthContext(request, { allowCoach: true });
  if ('error' in auth) return { error: auth.error };
  return { ws: billingWorkspace(auth.ctx), ctx: auth.ctx, userId: auth.ctx.userId };
}
