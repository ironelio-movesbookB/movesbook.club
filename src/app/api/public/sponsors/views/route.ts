import { NextRequest, NextResponse } from 'next/server';
import {
  isTrackSection,
  trackSponsorEvents,
  type TrackSection,
} from '@/lib/club/sponsors/sponsorPlacementService';

export const dynamic = 'force-dynamic';

/** Body `{ items: [{ s: sponsorId, sec: section }] }` — one view per shown sponsor image. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const raw: unknown[] = Array.isArray(body?.items) ? body.items : [];
    const events = raw
      .map((i) => i as { s?: unknown; sec?: unknown })
      .map((i) => ({ sponsorId: i.s, section: i.sec ?? '' }))
      .filter((i): i is { sponsorId: string; section: TrackSection } =>
        typeof i.sponsorId === 'string' && isTrackSection(i.section),
      );
    return NextResponse.json({ recorded: await trackSponsorEvents(events, 'view') });
  } catch (error) {
    console.error('POST /api/public/sponsors/views', error);
    return NextResponse.json({ recorded: 0 }, { status: 500 });
  }
}
