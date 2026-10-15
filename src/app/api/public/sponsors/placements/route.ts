import { NextRequest, NextResponse } from 'next/server';
import { listSectionSponsorsForOrg } from '@/lib/club/sponsors/sponsorPlacementService';
import { isSponsorSectionKey, type SponsorSectionKey } from '@/lib/club/sponsors/sponsorConstants';

export const dynamic = 'force-dynamic';

/** `?org=<club or team id>&sections=members_app,online_shop` */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const org = (sp.get('org') ?? '').trim();
  const sections = (sp.get('sections') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(isSponsorSectionKey) as SponsorSectionKey[];
  if (!org || sections.length === 0) return NextResponse.json({ items: [] });
  try {
    return NextResponse.json(
      { items: await listSectionSponsorsForOrg(org, sections) },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
  } catch (error) {
    console.error('GET /api/public/sponsors/placements', error);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}
