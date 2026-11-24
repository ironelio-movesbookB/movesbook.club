import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import {
  loadMemberProfileBundle,
  saveMemberProfileBundle,
} from '@/lib/club/memberProfileService';

export const dynamic = 'force-dynamic';

function getUserId(request: NextRequest): string | null {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { clubId: string; memberId: string } },
) {
  const viewerUserId = getUserId(request);
  if (!viewerUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await loadMemberProfileBundle({
    clubId: params.clubId,
    memberUserId: params.memberId,
    viewerUserId,
  });
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}

export async function PATCH(
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
    owner?: Parameters<typeof saveMemberProfileBundle>[0]['payload']['owner'];
    contacts?: Parameters<typeof saveMemberProfileBundle>[0]['payload']['contacts'];
    activities?: Parameters<typeof saveMemberProfileBundle>[0]['payload']['activities'];
    referencesHtml?: string;
    club?: Parameters<typeof saveMemberProfileBundle>[0]['payload']['club'];
  };

  const result = await saveMemberProfileBundle({
    clubId: params.clubId,
    memberUserId: params.memberId,
    viewerUserId,
    payload,
  });
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true });
}
