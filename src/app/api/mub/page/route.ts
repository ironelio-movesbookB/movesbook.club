import { NextRequest, NextResponse } from 'next/server';
import { prismaConnect } from '@/lib/prisma';
import { getMubPage, updateMubPageSettings } from '@/lib/mub/mubService';
import {
  getMubTokenUserId,
  parseMubPageRequest,
  resolveMubPageQuery,
} from '@/lib/mub/mubApiHelpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = getMubTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prismaConnect();
    const parsed = parseMubPageRequest(request);
    const resolved = await resolveMubPageQuery(parsed, userId, 'read');
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const page = await getMubPage(resolved.query, parsed.lang);
    return NextResponse.json({ page });
  } catch (error) {
    console.error('GET /api/mub/page failed:', error);
    return NextResponse.json({ error: 'Failed to load MUB page' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = getMubTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prismaConnect();
    const parsed = parseMubPageRequest(request);
    const resolved = await resolveMubPageQuery(parsed, userId, 'write');
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const body = (await request.json()) as { backgroundColor?: string; displayMode?: number };
    const page = await updateMubPageSettings(
      resolved.query,
      {
        ...(body.backgroundColor != null ? { backgroundColor: body.backgroundColor } : {}),
        ...(body.displayMode != null ? { displayMode: body.displayMode === 2 ? 2 : 1 } : {}),
      },
      parsed.lang,
    );
    return NextResponse.json({ page });
  } catch (error) {
    console.error('PATCH /api/mub/page failed:', error);
    return NextResponse.json({ error: 'Failed to update MUB page' }, { status: 500 });
  }
}
