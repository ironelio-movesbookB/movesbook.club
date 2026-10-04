import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import {
  addClubMemberFavourites,
  listClubMemberFavouriteIds,
  listClubMemberFavourites,
  removeClubMemberFavourites,
  resolveMemberGroupFilter,
} from '@/lib/club/memberLists';
import type { ArchiveQueryParams } from '@/lib/club/archives/legacyArchiveQueries';

export const dynamic = 'force-dynamic';

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

export async function GET(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request, { allowCoach: true });
    if ('error' in auth) return auth.error;

    const listOnly = request.nextUrl.searchParams.get('idsOnly') === '1';
    if (listOnly) {
      const memberIds = await listClubMemberFavouriteIds(auth.ctx);
      return NextResponse.json({ memberIds });
    }

    const result = await listClubMemberFavourites(
      auth.ctx,
      await resolveMemberGroupFilter(auth.ctx.club.id, parseArchiveParams(request)),
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error('GET club member favourites:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request, { allowCoach: true });
    if ('error' in auth) return auth.error;

    const body = await request.json().catch(() => ({}));
    const memberIds = Array.isArray(body.memberIds)
      ? body.memberIds.filter((id: unknown) => typeof id === 'string')
      : [];

    const added = await addClubMemberFavourites(auth.ctx, memberIds);
    return NextResponse.json({ added });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('Select') ? 400 : 500;
    if (status === 500) console.error('POST club member favourites:', error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request, { allowCoach: true });
    if ('error' in auth) return auth.error;

    const body = await request.json().catch(() => ({}));
    const memberIds = Array.isArray(body.memberIds)
      ? body.memberIds.filter((id: unknown) => typeof id === 'string')
      : [];

    const removed = await removeClubMemberFavourites(auth.ctx, memberIds);
    return NextResponse.json({ removed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('Select') ? 400 : 500;
    if (status === 500) console.error('DELETE club member favourites:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
