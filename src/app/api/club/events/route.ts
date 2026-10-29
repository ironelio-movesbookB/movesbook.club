import { NextRequest, NextResponse } from 'next/server';
import { eventErrorResponse, resolveEventWorkspace } from '@/lib/club/events/eventApi';
import { createClubEvent, listClubEvents } from '@/lib/club/events/eventService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await resolveEventWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    return NextResponse.json({ events: await listClubEvents(auth.ws) });
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
