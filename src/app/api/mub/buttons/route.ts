import { NextRequest, NextResponse } from 'next/server';
import { prismaConnect } from '@/lib/prisma';
import {
  MubButtonNotFoundError,
  deleteMubButton,
  reorderMubButtons,
  saveMubButton,
} from '@/lib/mub/mubService';
import type { SaveMubButtonInput } from '@/lib/mub/types';
import {
  getMubTokenUserId,
  parseMubPageRequest,
  resolveMubPageQuery,
} from '@/lib/mub/mubApiHelpers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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

    const body = (await request.json()) as {
      button?: SaveMubButtonInput;
      orderedIds?: unknown[];
    };

    if (Array.isArray(body.orderedIds)) {
      const page = await reorderMubButtons(resolved.query, body.orderedIds, parsed.lang);
      return NextResponse.json({ page });
    }

    if (!body.button) {
      return NextResponse.json({ error: 'Button payload required' }, { status: 400 });
    }

    const page = await saveMubButton(resolved.query, body.button, parsed.lang);
    return NextResponse.json({ page });
  } catch (error) {
    if (error instanceof MubButtonNotFoundError) {
      return NextResponse.json({ error: 'Button not found on this page' }, { status: 404 });
    }
    console.error('POST /api/mub/buttons failed:', error);
    return NextResponse.json({ error: 'Failed to save button' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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

    const buttonId = new URL(request.url).searchParams.get('id');
    if (!buttonId) {
      return NextResponse.json({ error: 'Button id required' }, { status: 400 });
    }

    const page = await deleteMubButton(resolved.query, buttonId, parsed.lang);
    return NextResponse.json({ page });
  } catch (error) {
    if (error instanceof MubButtonNotFoundError) {
      return NextResponse.json({ error: 'Button not found on this page' }, { status: 404 });
    }
    console.error('DELETE /api/mub/buttons failed:', error);
    return NextResponse.json({ error: 'Failed to delete button' }, { status: 500 });
  }
}
