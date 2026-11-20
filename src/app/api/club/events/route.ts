import { NextRequest, NextResponse } from 'next/server';
import { eventErrorResponse, resolveEventWorkspace } from '@/lib/club/events/eventApi';
import {
  createClubEvent,
  getEventSettings,
  listClubEvents,
  removeExpiredEvents,
} from '@/lib/club/events/eventService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await resolveEventWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { settings } = await getEventSettings(auth.ws);
    if (settings.autoRemoveExpired) {
      await removeExpiredEvents(auth.ws).catch((e) => console.error('auto remove expired events', e));
    }
    return NextResponse.json({ events: await listClubEvents(auth.ws), settings });
  } catch (error) {
    return eventErrorResponse(error, 'GET /api/club/events');
  }
}

export async function POST(request: NextRequest) {
  const auth = await resolveEventWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const body = await request.json().catch(() => ({}));
    const event = await createClubEvent(auth.ws, body?.profile ?? body ?? {});
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return eventErrorResponse(error, 'POST /api/club/events');
  }
}
