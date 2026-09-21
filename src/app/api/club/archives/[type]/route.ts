import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import {
  listAccessesArchive,
  listAdvertisingCampaignsArchive,
  listAlertsAssignedArchive,
  listCardAssignmentsArchive,
  listCashMovements,
  listClubAffiliationsArchive,
  listClubMembersArchive,
  listTeamMembersArchive,
  listClubOperatorsArchive,
  listClubParentsArchive,
  listTeamParentsArchive,
  listClubSubscriptionsArchive,
  listEventsArchive,
  listInsertCredits,
  listMarketingContactsArchive,
  listPollsArchive,
  listReservationsArchive,
  listStaffQueriesArchive,
  listUnifiedDeadlines,
  listUnifiedPayments,
  listUnifiedProductSales,
  listUnifiedReceipts,
  type ArchiveQueryParams,
} from '@/lib/club/archives/clubArchiveService';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { type: string } };

function parseArchiveParams(
  request: NextRequest
): ArchiveQueryParams & { includePaid?: boolean; expandDeadlines?: boolean } {
  const sp = request.nextUrl.searchParams;
  return {
    page: Number(sp.get('page') ?? 1),
    pageSize: Number(sp.get('pageSize') ?? 25),
    search: sp.get('search') ?? undefined,
    fromDate: sp.get('fromDate') ?? undefined,
    toDate: sp.get('toDate') ?? undefined,
    orderBy: (sp.get('orderBy') as 'recent' | 'old') ?? undefined,
    memberId: sp.get('memberId') ?? undefined,
    recordId: sp.get('recordId') ?? undefined,
    sport: sp.get('sport') ?? undefined,
    groupTrained: sp.get('groupTrained') ?? undefined,
    membershipStatus: (() => {
      const raw = sp.get('membershipStatus');
      if (
        raw === 'member' ||
        raw === 'pending' ||
        raw === 'not_member' ||
        raw === 'archived' ||
        raw === 'all'
      ) {
        return raw;
      }
      return undefined;
    })(),
    includePaid: sp.get('includePaid') === '1' || sp.get('includePaid') === 'true',
    expandDeadlines: sp.get('expandDeadlines') === '1' || sp.get('expandDeadlines') === 'true',
  };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const archiveParams = parseArchiveParams(request);
    const direction = (request.nextUrl.searchParams.get('direction') ?? 'all') as 'all' | 'IN' | 'OUT';

    let result;
    switch (params.type) {
      case 'members':
        result =
          auth.ctx.workspaceKind === 'team'
            ? await listTeamMembersArchive(auth.ctx, archiveParams)
            : await listClubMembersArchive(auth.ctx, archiveParams);
        break;
      case 'parents':
        result =
          auth.ctx.workspaceKind === 'team'
            ? await listTeamParentsArchive(auth.ctx, archiveParams)
            : await listClubParentsArchive(auth.ctx, archiveParams);
        break;
      case 'operators':
        result = await listClubOperatorsArchive(auth.ctx, archiveParams);
        break;
      case 'affiliations':
        result = await listClubAffiliationsArchive(auth.ctx, archiveParams);
        break;
      case 'subscriptions':
        result = await listClubSubscriptionsArchive(auth.ctx, archiveParams);
        break;
      case 'product-sales':
        result = await listUnifiedProductSales(auth.ctx, archiveParams);
        break;
      case 'credits':
        result = await listInsertCredits(auth.ctx, archiveParams);
        break;
      case 'cash-movements':
        result = await listCashMovements(auth.ctx, direction, archiveParams);
        break;
      case 'product-sales-unified':
        result = await listUnifiedProductSales(auth.ctx, archiveParams);
        break;
      case 'deadlines':
        result = await listUnifiedDeadlines(auth.ctx, archiveParams);
        break;
      case 'payments':
        result = await listUnifiedPayments(auth.ctx, archiveParams);
        break;
      case 'receipts':
        result = await listUnifiedReceipts(auth.ctx, archiveParams);
        break;
      case 'accesses':
        result = await listAccessesArchive(auth.ctx, archiveParams);
        break;
      case 'reservations':
        result = await listReservationsArchive(auth.ctx, archiveParams);
        break;
      case 'cards-assignments':
        result = await listCardAssignmentsArchive(auth.ctx, archiveParams);
        break;
      case 'events':
        result = await listEventsArchive(auth.ctx, archiveParams);
        break;
      case 'polls':
        result = await listPollsArchive(auth.ctx, archiveParams);
        break;
      case 'marketing-contacts':
        result = await listMarketingContactsArchive(auth.ctx, archiveParams);
        break;
      case 'alerts-assigned':
        result = await listAlertsAssignedArchive(auth.ctx, archiveParams);
        break;
      case 'advertising-campaigns':
        result = await listAdvertisingCampaignsArchive(auth.ctx, archiveParams);
        break;
      case 'staff-queries':
        result = await listStaffQueriesArchive(auth.ctx, archiveParams);
        break;
      default:
        return NextResponse.json({ error: `Unknown archive type: ${params.type}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET club archive:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
