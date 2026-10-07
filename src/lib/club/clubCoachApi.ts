import { NextResponse } from 'next/server';
import { ClubCoachError } from '@/lib/club/clubCoachService';

export function coachErrorResponse(error: unknown, label: string) {
  if (error instanceof ClubCoachError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(label, error);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

export function idsFromBody(body: { ids?: unknown }): string[] {
  return Array.isArray(body.ids) ? body.ids.filter((id: unknown): id is string => typeof id === 'string') : [];
}
