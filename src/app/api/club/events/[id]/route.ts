import { NextRequest, NextResponse } from 'next/server';
import { eventErrorResponse, resolveEventWorkspace } from '@/lib/club/events/eventApi';
import { deleteClubEvent, getClubEvent, updateClubEvent } from '@/lib/club/events/eventService';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const auth = await resolveEventWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await context.params;
    return NextResponse.json({ event: await getClubEvent(auth.ws, id) });
  } catch (error) {
    return eventErrorResponse(error, 'GET /api/club/events/[id]');
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const auth = await resolveEventWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const event = await updateClubEvent(auth.ws, id, body?.profile ?? body ?? {});
    return NextResponse.json({ event });
  } catch (error) {
    return eventErrorResponse(error, 'PATCH /api/club/events/[id]');
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const auth = await resolveEventWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await context.params;
    await deleteClubEvent(auth.ws, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return eventErrorResponse(error, 'DELETE /api/club/events/[id]');
  }
}
