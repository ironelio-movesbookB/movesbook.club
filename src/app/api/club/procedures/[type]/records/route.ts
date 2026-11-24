import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext, procedureService } from '@/lib/procedures';
import { parseArchiveListFilters } from '@/lib/procedures/parseArchiveListFilters';
import { isKnownProcedureType, parseCreateRecord } from '@/lib/procedures/validators';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { type: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    if (!isKnownProcedureType(params.type)) {
      return NextResponse.json({ error: `Unknown procedure type: ${params.type}` }, { status: 400 });
    }

    const view = request.nextUrl.searchParams.get('view');
    const includePaid =
      request.nextUrl.searchParams.get('includePaid') === '1' ||
      request.nextUrl.searchParams.get('includePaid') === 'true';
    const page = Number(request.nextUrl.searchParams.get('page') ?? 1);
    const pageSize = Number(request.nextUrl.searchParams.get('pageSize') ?? 10);
    const memberId = request.nextUrl.searchParams.get('memberId') ?? undefined;
    const recordId =
      request.nextUrl.searchParams.get('recordId') ??
      request.nextUrl.searchParams.get('id') ??
      undefined;
    const idsRaw = request.nextUrl.searchParams.get('ids');
    const recordIds = idsRaw
      ? idsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const filters = parseArchiveListFilters(request.nextUrl.searchParams);

    const result = await procedureService.listRecords(
      auth.ctx,
      params.type,
      { page, pageSize, memberId, recordId, recordIds, ...filters },
      { onlyWithBalance: view === 'deadlines' && !includePaid }
    );

    return NextResponse.json({ ...result, clubId: auth.ctx.club.id });
  } catch (error) {
    console.error('GET procedure records:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const parsed = parseCreateRecord(params.type, body);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error, ...(parsed.details ? { details: parsed.details } : {}) },
        { status: parsed.status }
      );
    }

    const result = await procedureService.createRecord(auth.ctx, params.type, parsed.data);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status =
      message.includes('exceeds') ||
      message.includes('Unknown procedure type') ||
      message.includes('password')
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    await procedureService.softDeleteRecord(auth.ctx, params.type, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Record not found' ? 404 : 500 });
  }
}
