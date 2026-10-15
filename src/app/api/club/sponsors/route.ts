import { NextRequest, NextResponse } from 'next/server';
import { resolveSponsorWorkspace, sponsorErrorResponse } from '@/lib/club/sponsors/sponsorApi';
import { createSponsor, listSponsors, processSponsorReminders } from '@/lib/club/sponsors/sponsorService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    await processSponsorReminders(auth.ws).catch((e) => console.error('sponsor reminders', e));
    return NextResponse.json(await listSponsors(auth.ws));
  } catch (error) {
    return sponsorErrorResponse(error, 'GET /api/club/sponsors');
  }
}

export async function POST(request: NextRequest) {
  const auth = await resolveSponsorWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const body = await request.json().catch(() => ({}));
    const sponsor = await createSponsor(auth.ws, body?.profile ?? body ?? {});
    return NextResponse.json({ sponsor }, { status: 201 });
  } catch (error) {
    return sponsorErrorResponse(error, 'POST /api/club/sponsors');
  }
}
