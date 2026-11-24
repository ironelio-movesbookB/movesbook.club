import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext, procedureService } from '@/lib/procedures';
import { parseArchiveListFilters } from '@/lib/procedures/parseArchiveListFilters';
import { isKnownProcedureType } from '@/lib/procedures/validators';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { type: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    if (!isKnownProcedureType(params.type)) {
      return NextResponse.json({ error: `Unknown procedure type: ${params.type}` }, { status: 400 });
    }

    const idsRaw = request.nextUrl.searchParams.get('ids');
    const recordIds = idsRaw
      ? idsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const filters = parseArchiveListFilters(request.nextUrl.searchParams);

    const result = await procedureService.listReceipts(auth.ctx, params.type, {
      page: Number(request.nextUrl.searchParams.get('page') ?? 1),
      pageSize: Number(request.nextUrl.searchParams.get('pageSize') ?? 10),
      recordId: request.nextUrl.searchParams.get('recordId') ?? undefined,
      memberId: request.nextUrl.searchParams.get('memberId') ?? undefined,
      recordIds,
      ...filters,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET procedure receipts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
