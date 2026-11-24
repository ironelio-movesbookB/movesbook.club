import { NextRequest, NextResponse } from 'next/server';
import { loadPublicInvite } from '@/lib/promocodes/inviteLandingService';
import { registrationOrigin } from '@/lib/registration/registrationFlow';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const promocode = sp.get('promocode')?.trim() || '';
    if (!promocode) {
      return NextResponse.json({ error: 'Promocode is required' }, { status: 400 });
    }
    const view = await loadPublicInvite({
      promocode,
      inviter: sp.get('inviter'),
      lang: sp.get('lang'),
      sectionsRaw: sp.get('sections'),
      inviteByMovesbook: sp.get('invite_by') === 'movesbook',
      userEmail: sp.get('user_email'),
      origin: registrationOrigin(request),
    });
    if (!view) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    return NextResponse.json(view);
  } catch (error) {
    console.error('GET public invite:', error);
    return NextResponse.json({ error: 'Could not load the invite' }, { status: 500 });
  }
}
