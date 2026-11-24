import { NextRequest, NextResponse } from 'next/server';
import { eventErrorResponse, resolveEventWorkspace } from '@/lib/club/events/eventApi';
import { listEventArchiveRows } from '@/lib/club/events/eventArchiveService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await resolveEventWorkspace(request);
  if ('error' in auth) return auth.error;
  try {
    return NextResponse.json({ events: await listEventArchiveRows(auth.ws) });
  } catch (error) {
    return eventErrorResponse(error, 'GET /api/club/events/archive');
  }
}
