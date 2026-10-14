import { NextRequest, NextResponse } from 'next/server';
import {
  isTrackSection,
  sponsorLandingUrl,
  trackSponsorEvents,
} from '@/lib/club/sponsors/sponsorPlacementService';

export const dynamic = 'force-dynamic';

/** Counts the click, then opens the sponsor landing page. */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const sponsorId = (sp.get('s') ?? '').trim();
  const section = sp.get('sec') ?? '';
  try {
    const landing = sponsorId ? await sponsorLandingUrl(sponsorId) : null;
    if (!landing) return NextResponse.redirect(new URL('/', request.url));
    if (isTrackSection(section)) {
      await trackSponsorEvents([{ sponsorId, section }], 'click').catch((e) => console.error('sponsor click', e));
    }
    return NextResponse.redirect(landing, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('GET /api/public/sponsors/click', error);
    return NextResponse.redirect(new URL('/', request.url));
  }
}
