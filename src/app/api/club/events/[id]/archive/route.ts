import { NextRequest, NextResponse } from 'next/server';
import { eventErrorResponse, resolveEventWorkspace } from '@/lib/club/events/eventApi';
import { eventArchiveDetail } from '@/lib/club/events/eventArchiveService';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const auth = await resolveEventWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await context.params;
    return NextResponse.json(await eventArchiveDetail(auth.ctx, auth.ws, id));
  } catch (error) {
    return eventErrorResponse(error, 'GET /api/club/events/[id]/archive');
  }
}
