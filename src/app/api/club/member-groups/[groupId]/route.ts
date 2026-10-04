import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import {
  deleteClubMemberGroup,
  getClubMemberGroup,
  listClubMemberGroupMembers,
  renameClubMemberGroup,
  resolveMemberGroupFilter,
} from '@/lib/club/memberLists';
import type { ArchiveQueryParams } from '@/lib/club/archives/legacyArchiveQueries';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { groupId: string } };

function parseArchiveParams(request: NextRequest): ArchiveQueryParams {
  const sp = request.nextUrl.searchParams;
  return {
    page: Number(sp.get('page') ?? 1),
    pageSize: Number(sp.get('pageSize') ?? 25),
    search: sp.get('search') ?? undefined,
    fromDate: sp.get('fromDate') ?? undefined,
    toDate: sp.get('toDate') ?? undefined,
    orderBy: (sp.get('orderBy') as 'recent' | 'old') ?? undefined,
    sport: sp.get('sport') ?? undefined,
    groupTrained: sp.get('groupTrained') ?? undefined,
    memberGroupId: sp.get('memberGroupId') ?? undefined,
  };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request, { allowCoach: true });
    if ('error' in auth) return auth.error;

    const group = await getClubMemberGroup(auth.ctx, params.groupId);
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const members = await listClubMemberGroupMembers(
      auth.ctx,
      params.groupId,
      await resolveMemberGroupFilter(auth.ctx.club.id, parseArchiveParams(request))
    );

    return NextResponse.json({ group, ...members });
  } catch (error) {
    console.error('GET club member group:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request, { allowCoach: true });
    if ('error' in auth) return auth.error;

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name : '';
    const group = await renameClubMemberGroup(auth.ctx, params.groupId, name);
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    return NextResponse.json({ group });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('required') ? 400 : 500;
    if (status === 500) console.error('PATCH club member group:', error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request, { allowCoach: true });
    if ('error' in auth) return auth.error;

    const deleted = await deleteClubMemberGroup(auth.ctx, params.groupId);
    if (!deleted) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE club member group:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
