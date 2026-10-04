import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import { createClubMemberGroup, listClubMemberGroups } from '@/lib/club/memberLists';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request, { allowCoach: true });
    if ('error' in auth) return auth.error;

    const groups = await listClubMemberGroups(auth.ctx);
    return NextResponse.json({ groups });
  } catch (error) {
    console.error('GET club member groups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request, { allowCoach: true });
    if ('error' in auth) return auth.error;

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name : '';
    const memberIds = Array.isArray(body.memberIds)
      ? body.memberIds.filter((id: unknown) => typeof id === 'string')
      : [];

    const group = await createClubMemberGroup(auth.ctx, name, memberIds);
    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        memberCount: group._count.members,
        createdAt: group.createdAt.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('required') || message.includes('Select') ? 400 : 500;
    if (status === 500) console.error('POST club member group:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
