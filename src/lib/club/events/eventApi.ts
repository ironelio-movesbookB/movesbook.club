import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures/clubAuth';
import type { ClubEventWorkspace } from '@/lib/club/events/eventConstants';
import type { ClubAuthContext } from '@/lib/procedures/types';
import { ClubEventError } from '@/lib/club/events/eventService';

export async function resolveEventWorkspace(
  request: NextRequest,
): Promise<{ ws: ClubEventWorkspace; ctx: ClubAuthContext } | { error: NextResponse }> {
  const auth = await getClubAuthContext(request);
  if ('error' in auth) return { error: auth.error };
  const { ctx } = auth;
  if (ctx.workspaceKind !== 'club' && ctx.workspaceKind !== 'team') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ws: { kind: ctx.workspaceKind, id: ctx.club.id }, ctx };
}

export function eventErrorResponse(error: unknown, label: string): NextResponse {
  if (error instanceof ClubEventError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(label, error);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}
