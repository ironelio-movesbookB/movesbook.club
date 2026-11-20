import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import { verifyOperatorPassword } from '@/lib/procedures/operatorAuth';
import { isKnownProcedureType } from '@/lib/procedures/validators';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { type: string } };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;
    if (!isKnownProcedureType(params.type)) {
      return NextResponse.json({ error: 'Unknown procedure type' }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as {
      operatorId?: string;
      password?: string;
    } | null;
    if (!body?.operatorId?.trim() || !body.password?.trim()) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    return NextResponse.json({
      valid: await verifyOperatorPassword(body.operatorId, body.password),
    });
  } catch (error) {
    console.error('POST verify procedure operator password:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
