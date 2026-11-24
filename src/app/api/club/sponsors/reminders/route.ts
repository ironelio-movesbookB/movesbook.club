import { NextRequest, NextResponse } from 'next/server';
import { processSponsorReminders } from '@/lib/club/sponsors/sponsorService';

export const dynamic = 'force-dynamic';

/** For an external daily cron: `POST` with header `x-cron-secret: $SPONSOR_REMINDER_SECRET`. */
export async function POST(request: NextRequest) {
  const secret = process.env.SPONSOR_REMINDER_SECRET || process.env.CRON_SECRET;
  if (!secret || request.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json({ sent: await processSponsorReminders() });
  } catch (error) {
    console.error('POST /api/club/sponsors/reminders', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
