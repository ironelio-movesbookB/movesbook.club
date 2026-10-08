import { NextRequest, NextResponse } from 'next/server';
import { activateAccountByToken } from '@/lib/registration/registrationPayments';

export const dynamic = 'force-dynamic';

const MESSAGES = {
  invalid: 'This activation link is not valid.',
  expired: 'This activation link has expired. Try to log in to receive a new one.',
  unpaid: 'The payment of this account is not completed yet.',
} as const;

/** "Activate account" button of the registration email. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { token?: string };
    const result = await activateAccountByToken(String(body.token ?? '').trim());
    if (!result.ok) {
      return NextResponse.json({ error: MESSAGES[result.reason], reason: result.reason }, { status: 400 });
    }
    return NextResponse.json({ success: true, alreadyActive: result.alreadyActive });
  } catch (e) {
    console.error('auth/activate:', e);
    return NextResponse.json({ error: 'Could not activate the account' }, { status: 500 });
  }
}
