import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import type { DuplicateMemberSection } from '@/lib/club/memberProfileTypes';
import { duplicateMemberProfileSections } from '@/lib/club/memberProfileService';

export const dynamic = 'force-dynamic';

const ALLOWED: DuplicateMemberSection[] = [
  'member-profile',
  'parents',
  'other-data',
  'settings',
  'alert-posted',
  'coach-notes',
];

function getUserId(request: NextRequest): string | null {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { clubId: string; memberId: string } },
) {
  const viewerUserId = getUserId(request);
  if (!viewerUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const payload = (body || {}) as {
    sourceMemberId?: string;
    sections?: string[];
  };
  const sourceMemberId = String(payload.sourceMemberId || '').trim();
  if (!sourceMemberId) {
    return NextResponse.json({ error: 'Select a user to duplicate from' }, { status: 400 });
  }

  const sections = (Array.isArray(payload.sections) ? payload.sections : [])
    .map((s) => String(s))
    .filter((s): s is DuplicateMemberSection =>
      (ALLOWED as string[]).includes(s),
    );

  const result = await duplicateMemberProfileSections({
    clubId: params.clubId,
    targetMemberUserId: params.memberId,
    sourceMemberUserId: sourceMemberId,
    viewerUserId,
    sections,
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true, copied: result.copied });
}
