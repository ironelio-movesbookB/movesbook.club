import { NextRequest, NextResponse } from 'next/server';
import { listPublicEventsForOrg } from '@/lib/club/events/eventService';
import { findPublicOrg, publicOrgCard } from '@/lib/club/publicOrg';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ orgId: string }> };

export async function GET(_request: NextRequest, context: Ctx) {
  try {
    const { orgId } = await context.params;
    const org = await findPublicOrg(orgId);
    if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const events = await listPublicEventsForOrg(orgId);
    return NextResponse.json({ org: publicOrgCard(org), events });
  } catch (error) {
    console.error('GET /api/public/club-events/[orgId]', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
