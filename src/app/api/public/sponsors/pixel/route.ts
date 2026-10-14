import { NextRequest } from 'next/server';
import { isTrackSection, trackSponsorEvents } from '@/lib/club/sponsors/sponsorPlacementService';

export const dynamic = 'force-dynamic';

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

/** 1×1 image in sponsor email blocks: counts a view when the email is opened. */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const sponsorId = (sp.get('s') ?? '').trim();
  const section = sp.get('sec') ?? '';
  if (sponsorId && section && isTrackSection(section)) {
    await trackSponsorEvents([{ sponsorId, section }], 'view').catch((e) => console.error('sponsor pixel', e));
  }
  return new Response(GIF, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, max-age=0' },
  });
}
