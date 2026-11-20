import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import { verifyOperatorPassword } from '@/lib/procedures/operatorAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const body = (await request.json().catch(() => ({}))) as {
      operatorId?: string;
      password?: string;
    };

    const operatorId = body.operatorId?.trim();
    const password = body.password ?? '';

    if (!operatorId) {
      return NextResponse.json({ error: 'Operator is required' }, { status: 400 });
    }

    if (!password.trim()) {
      return NextResponse.json({ error: 'Operator password is required' }, { status: 400 });
    }

    const valid = await verifyOperatorPassword(operatorId, password);
    return NextResponse.json({ valid });
  } catch (error) {
    console.error('POST verify-operator-password:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
