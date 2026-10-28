import { NextRequest, NextResponse } from 'next/server';
import { eventErrorResponse, resolveEventWorkspace } from '@/lib/club/events/eventApi';
import {
  deleteSubevent,
  replaceEventServices,
  replaceEventTexts,
  upsertSubevent,
} from '@/lib/club/events/eventService';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const auth = await resolveEventWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const kind = String(body?.kind || '');
    if (kind === 'services') {
      return NextResponse.json({ event: await replaceEventServices(auth.ws, id, body.services || []) });
    }
    if (kind === 'texts') {
      return NextResponse.json({ event: await replaceEventTexts(auth.ws, id, body.texts || []) });
    }
    if (kind === 'subevent') {
      return NextResponse.json({ event: await upsertSubevent(auth.ws, id, body.subevent || body) });
    }
    if (kind === 'delete-subevent') {
      return NextResponse.json({ event: await deleteSubevent(auth.ws, id, String(body.subeventId || '')) });
    }
    return NextResponse.json({ error: 'Unknown kind' }, { status: 400 });
  } catch (error) {
    return eventErrorResponse(error, 'POST /api/club/events/[id]/children');
  }
}
