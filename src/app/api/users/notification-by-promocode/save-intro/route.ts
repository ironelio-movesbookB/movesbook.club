import { NextRequest, NextResponse } from 'next/server';
import { saveSenderIntroMessage } from '@/lib/promocodes/promocodeInviteLinks';
import { resolvePromocodeSessionUser } from '@/lib/promocodes/promocodeSessionAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await resolvePromocodeSessionUser(request);
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  let body: { introMessage?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    await saveSenderIntroMessage(session.user.legacyUserId, body.introMessage?.trim() ?? '');
    return NextResponse.json({ status: 'success' });
  } catch (err) {
    console.error('notification-by-promocode save-intro POST:', err);
    return NextResponse.json({ error: 'Unable to save the intro message.' }, { status: 500 });
  }
}
