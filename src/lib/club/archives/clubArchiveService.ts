import { prisma } from '@/lib/prisma';
import { findExistingTable } from '@/lib/club/legacyTableLookup';
import { procedureService } from '@/lib/procedures';
import {
  listInstallmentsForRecords,
  projectInstallmentsOnBalance,
  type InstallmentDto,
} from '@/lib/procedures/installmentService';
import { getProcedureTypology } from '@/lib/procedures/registry';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';
import type { ClubAuthContext } from '@/lib/procedures/types';
import { fetchClubStaffOperators } from '@/lib/procedures/clubOperators';
import {
  operativeLevelForStaffType,
  staffTypeLabel,
} from '@/lib/club/clubStaff.constants';
import { listClubStaff } from '@/lib/club/clubStaffService';
import {
  normalizeMemberArchiveStatus,
  type MemberArchiveStatus,
} from '@/lib/club/memberArchiveStatus';
import {
  type ArchiveQueryParams,
  applyFilters,
  formatName,
  num,
  paginate,
  queryClubMemberSubscriptions,
  queryLegacyTableArchive,
  text,
  type PaginatedArchive,
} from '@/lib/club/archives/legacyArchiveQueries';

export type { ArchiveQueryParams, PaginatedArchive };

async function clubMemberUserIds(clubId: string): Promise<string[]> {
  const rows = await prisma.clubMember.findMany({
    where: { clubId },
    select: { memberId: true },
  });
  return rows.map((r) => r.memberId);
}

function formatArchiveDate(value: Date | null | undefined): string {
  if (!value || Number.isNaN(value.getTime())) return '-';
  const dd = String(value.getDate()).padStart(2, '0');
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const yyyy = value.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function titleCaseRole(role: string | null | undefined): string {
  const raw = String(role ?? '').trim();
  if (!raw) return 'Member';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

type ArchivePerson = {
  id: string;
  firstName: string | null;
  surname: string | null;
  name: string;
  username: string;
  image: string | null;
  gender: string | null;
  birthdate: Date | null;
  country: string | null;
};

function mapArchivePersonRow(params: {
  person: ArchivePerson;
  joinedAt: Date;
  membershipType: string | null;
  operatorLabel: string;
  staffType?: string | null;
  staffRole?: string | null;
  /** ClubMember.role / TeamMember.role — drives A/B/C archive colors. */
  membershipRole?: string | null;
  /** Staff-only rows are not pending/not-member athletes. */
  isStaffOnly?: boolean;
}): Record<string, unknown> {
  const {
    person,
    joinedAt,
    membershipType,
    operatorLabel,
    staffType,
    staffRole,
    membershipRole,
    isStaffOnly,
  } = params;
  const firstName =
    text(person.firstName) ||
    text(person.name).split(/\s+/)[0] ||
    text(person.username) ||
    '-';
  const surname =
    text(person.surname) ||
    (() => {
      const parts = text(person.name).split(/\s+/).filter(Boolean);
      return parts.length > 1 ? parts.slice(1).join(' ') : '';
    })();

  const membershipStatus: MemberArchiveStatus = isStaffOnly
    ? 'member'
    : normalizeMemberArchiveStatus(membershipRole);

  return {
    id: person.id,
    memberId: person.id,
    name: firstName,
    surname: surname || '-',
    fullName: formatName(person.firstName, person.surname, person.name),
    image: person.image,
    gender: text(person.gender) || '-',
    dateOfBirth: formatArchiveDate(person.birthdate),
    memberType: text(membershipType) || 'Standard',
    localCity: text(person.country) || '-',
    Localcity: text(person.country) || '-',
    phone: '-',
    /** ISO for From/To filters; UI formats for display. */
    insertDate: joinedAt.toISOString().slice(0, 10),
    insertDateDisplay: formatArchiveDate(joinedAt),
    operator: operatorLabel,
    typology: operatorLabel,
    staffType: staffType ?? null,
    staffRole: staffRole ?? null,
    membershipStatus,
    isStaffOnly: Boolean(isStaffOnly),
  };
}

export async function listClubMembersArchive(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  const rows = await prisma.clubMember.findMany({
    where: { clubId: ctx.club.id },
    include: {
      member: {
        select: {
          id: true,
          firstName: true,
          surname: true,
          name: true,
          username: true,
          email: true,
          image: true,
          gender: true,
          birthdate: true,
          country: true,
          createdAt: true,
        },
      },
      profile: { select: { profileJson: true } },
    },
    orderBy: { joinedAt: 'desc' },
  });

  type StaffRow = {
    userId: string;
    staffType: string;
    role: string;
    createdAt: Date;
    user: {
      id: string;
      firstName: string | null;
      surname: string | null;
      name: string;
      username: string;
      image: string | null;
      gender: string | null;
      birthdate: Date | null;
      country: string | null;
      createdAt: Date;
    };
  };

  let staffRows: StaffRow[] = [];
  try {
    staffRows = await prisma.clubStaff.findMany({
      where: { clubId: ctx.club.id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            surname: true,
            name: true,
            username: true,
            image: true,
            gender: true,
            birthdate: true,
            country: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    // Main added ClubStaff model; local DB may not have `club_staff` yet.
    console.warn('listClubMembersArchive: club_staff unavailable, continuing without staff rows', error);
    staffRows = [];
  }

  const memberIds = rows.map((r) => r.memberId);
  let extrasRows: Array<{ userId: string; ownerJson: string }> = [];
  try {
    extrasRows =
      memberIds.length > 0
        ? await prisma.userProfileExtras.findMany({
            where: { userId: { in: memberIds } },
            select: { userId: true, ownerJson: true },
          })
        : [];
  } catch (error) {
    console.warn('listClubMembersArchive: user_profile_extras unavailable', error);
    extrasRows = [];
  }
  const ownerSportByUser = new Map<string, string>();
  for (const ex of extrasRows) {
    try {
      const owner = JSON.parse(ex.ownerJson || '{}') as {
        personal?: { mainSport?: string };
      };
      const sport = text(owner.personal?.mainSport);
      if (sport) ownerSportByUser.set(ex.userId, sport);
    } catch {
      /* ignore */
    }
  }

  const staffByUserId = new Map<string, StaffRow>(
    staffRows.map((row) => [row.userId, row]),
  );
  const memberUserIds = new Set(rows.map((row) => row.memberId));

  const memberItems: Record<string, unknown>[] = rows.map((row) => {
    const staff = staffByUserId.get(row.memberId);
    const operatorLabel = staff ? staffTypeLabel(staff.staffType) : 'Member';

    let scopedSafe: {
      otherDetails?: { groupTrainedId?: string };
      settings?: { football?: { teamNames?: string; category?: string }; teamSport?: string };
    } = {};
    try {
      scopedSafe = row.profile?.profileJson
        ? (JSON.parse(row.profile.profileJson) as typeof scopedSafe)
        : {};
    } catch {
      scopedSafe = {};
    }
    const sport =
      ownerSportByUser.get(row.memberId) ||
      text(scopedSafe.settings?.football?.category) ||
      text(scopedSafe.settings?.teamSport) ||
      '-';
    const groupTrainedId = text(scopedSafe.otherDetails?.groupTrainedId);
    const groupTrained =
      text(scopedSafe.settings?.football?.teamNames) || groupTrainedId || '-';

    const base = mapArchivePersonRow({
      person: row.member,
      joinedAt: row.joinedAt,
      membershipType: row.membershipType,
      operatorLabel,
      staffType: staff?.staffType ?? null,
      staffRole: staff?.role ?? null,
      membershipRole: row.role,
    });

    return {
      ...base,
      email: text(row.member.email) || '',
      clubMemberId: row.id,
      sport,
      groupTrained,
      groupTrainedId: groupTrainedId || '',
      casual: 'No',
    };
  });

  const staffOnlyItems: Record<string, unknown>[] = staffRows
    .filter((row) => !memberUserIds.has(row.userId))
    .map((row) => ({
      ...mapArchivePersonRow({
        person: row.user,
        joinedAt: row.createdAt,
        membershipType: 'Staff',
        operatorLabel: staffTypeLabel(row.staffType),
        staffType: row.staffType,
        staffRole: row.role,
        isStaffOnly: true,
      }),
      sport: '-',
      groupTrained: '-',
      groupTrainedId: '',
      casual: 'No',
    }));

  const items: Record<string, unknown>[] = [...memberItems, ...staffOnlyItems].sort(
    (a, b) => {
      const aDate = String(a.insertDate ?? '');
      const bDate = String(b.insertDate ?? '');
      return bDate.localeCompare(aDate);
    },
  );
  items.forEach((item, i) => {
    item.number = i + 1;
  });

  return paginate(applyFilters(items, params), page, pageSize);
}

/** Team admin Archive of Users — athletes on the selected team. */
export async function listTeamMembersArchive(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {},
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const teamId = ctx.club.id;

  const rows = await prisma.teamMember.findMany({
    where: { teamId },
    include: {
      athlete: {
        select: {
          id: true,
          firstName: true,
          surname: true,
          name: true,
          username: true,
          email: true,
          image: true,
          gender: true,
          birthdate: true,
          country: true,
          createdAt: true,
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  const memberIds = rows.map((r) => r.athleteId);
  let extrasRows: Array<{ userId: string; ownerJson: string }> = [];
  try {
    extrasRows =
      memberIds.length > 0
        ? await prisma.userProfileExtras.findMany({
            where: { userId: { in: memberIds } },
            select: { userId: true, ownerJson: true },
          })
        : [];
  } catch (error) {
    console.warn('listTeamMembersArchive: user_profile_extras unavailable', error);
    extrasRows = [];
  }
  const ownerSportByUser = new Map<string, string>();
  for (const ex of extrasRows) {
    try {
      const owner = JSON.parse(ex.ownerJson || '{}') as {
        personal?: { mainSport?: string };
      };
      const sport = text(owner.personal?.mainSport);
      if (sport) ownerSportByUser.set(ex.userId, sport);
    } catch {
      /* ignore */
    }
  }

  const items: Record<string, unknown>[] = rows.map((row, i) => {
    const sport = ownerSportByUser.get(row.athleteId) || '-';
    const base = mapArchivePersonRow({
      person: row.athlete,
      joinedAt: row.joinedAt,
      membershipType: 'Standard',
      operatorLabel: 'Member',
      membershipRole: row.role,
    });
    return {
      ...base,
      number: i + 1,
      email: text(row.athlete.email) || '',
      teamMemberId: row.id,
      sport,
      groupTrained: '-',
      groupTrainedId: '',
      casual: 'No',
    };
  });

  return paginate(applyFilters(items, params), page, pageSize);
}

export async function listTeamParentsArchive(
  _ctx: ClubAuthContext,
  params: ArchiveQueryParams = {},
): Promise<PaginatedArchive<Record<string, unknown>>> {
  // Team athlete dossiers do not store parent slots yet (no TeamMemberProfile).
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  return paginate([], page, pageSize);
}

export async function listClubParentsArchive(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {},
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const members = await prisma.clubMember.findMany({
    where: { clubId: ctx.club.id },
    include: {
      member: {
        select: { id: true, firstName: true, surname: true, name: true, username: true },
      },
      profile: { select: { profileJson: true } },
    },
    orderBy: { joinedAt: 'desc' },
  });

  const items: Record<string, unknown>[] = [];
  for (const row of members) {
    const memberLabel =
      formatName(row.member.firstName, row.member.surname, row.member.name) ||
      text(row.member.username) ||
      row.memberId;
    let scoped: {
      parents?: {
        parent1?: Record<string, unknown>;
        parent2?: Record<string, unknown>;
      };
    } = {};
    try {
      scoped = row.profile?.profileJson
        ? (JSON.parse(row.profile.profileJson) as typeof scoped)
        : {};
    } catch {
      scoped = {};
    }
    for (const slot of ['parent1', 'parent2'] as const) {
      const p = scoped.parents?.[slot] || {};
      const surname = text(p.surname);
      const name = text(p.name);
      const fiscalCode = text(p.fiscalCode);
      const mail = text(p.mainEmail);
      const kinship = text(p.kinship);
      const phone = text(p.phone1) || text(p.phone2);
      if (!surname && !name && !fiscalCode && !mail && !kinship && !phone) continue;

      const localCity =
        text(p.location) ||
        text(p.residenceLocation) ||
        text(p.country) ||
        '-';

      items.push({
        id: `${row.memberId}:${slot}`,
        key: `${row.memberId}:${slot}`,
        memberId: row.memberId,
        slot,
        image: null,
        surname: surname || '-',
        name: name || '-',
        gender: text(p.gender) || '-',
        kinship: kinship || '-',
        member: memberLabel,
        memberLabel,
        localCity,
        Localcity: localCity,
        phone: phone || '-',
        birthDate: text(p.birthDate) || '-',
        fiscalCode: fiscalCode || '-',
        mail: mail || '-',
        insertDate: row.joinedAt.toISOString().slice(0, 10),
        insertDateDisplay: formatArchiveDate(row.joinedAt),
      });
    }
  }

  return paginate(applyFilters(items, params), page, pageSize);
}

export async function listClubOperatorsArchive(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const items: Record<string, unknown>[] = [];
  const seenUserIds = new Set<string>();

  const pushItem = (row: Record<string, unknown>, userKey: string) => {
    if (!userKey || seenUserIds.has(userKey)) return;
    seenUserIds.add(userKey);
    items.push(row);
  };

  // Prefer club_staff (same source as /club/staff) for typology / employment / level.
  try {
    const staff = await listClubStaff(ctx);
    const hasManagedStaff = staff.some((row) => !row.isClubAdmin);
    if (hasManagedStaff) {
      for (const row of staff) {
        pushItem(
          {
            id: row.id,
            name: row.name,
            image: row.image,
            operator: row.username,
            username: row.username,
            typology: row.staffTypeLabel,
            staffType: row.staffType,
            employmentArea: row.role || '-',
            operativeLevel: row.operativeLevel || '-',
            insertDate: '-',
          },
          row.userId,
        );
      }
      return paginate(applyFilters(items, params), page, pageSize);
    }
    // Admin-only club_staff: keep admin row, then also load legacy operators below.
    for (const row of staff) {
      pushItem(
        {
          id: row.id,
          name: row.name,
          image: row.image,
          operator: row.username,
          username: row.username,
          typology: row.staffTypeLabel,
          staffType: row.staffType,
          employmentArea: row.role || '-',
          operativeLevel: row.operativeLevel || '-',
          insertDate: '-',
        },
        row.userId,
      );
    }
  } catch (error) {
    console.warn('listClubOperatorsArchive: club_staff unavailable, using legacy operators', error);
  }

  const staffOperators = await fetchClubStaffOperators(ctx.club.id);
  if (staffOperators.length > 0) {
    const userIds = staffOperators.map((s) => s.id);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, image: true },
    });
    const imageMap = new Map(users.map((u) => [u.id, u.image]));
    for (const row of staffOperators) {
      pushItem(
        {
          id: row.id,
          name: row.name,
          image: imageMap.get(row.id) ?? null,
          operator: row.username,
          username: row.username,
          typology: 'Operator',
          employmentArea: row.occupation || '-',
          operativeLevel: operativeLevelForStaffType('operator'),
          insertDate: '-',
        },
        row.id,
      );
    }
  } else if (items.length === 0) {
    const club = await prisma.club.findUnique({
      where: { id: ctx.club.id },
      select: {
        admin: {
          select: {
            id: true,
            firstName: true,
            surname: true,
            name: true,
            username: true,
            image: true,
          },
        },
      },
    });
    if (club?.admin) {
      pushItem(
        {
          id: club.admin.id,
          name: formatName(club.admin.firstName, club.admin.surname, club.admin.name),
          image: club.admin.image,
          operator: club.admin.username,
          username: club.admin.username,
          typology: staffTypeLabel('club_admin'),
          employmentArea: 'Director',
          operativeLevel: operativeLevelForStaffType('club_admin'),
          insertDate: '-',
        },
        club.admin.id,
      );
    }
  }

  return paginate(applyFilters(items, params), page, pageSize);
}

export async function listClubAffiliationsArchive(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  return queryClubMemberSubscriptions(ctx.club.id, params);
}

export async function listClubSubscriptionsArchive(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const table = await findExistingTable(['club_member_subscriptions', 'club_member_subscription']);
  const items: Record<string, unknown>[] = [];

  if (table) {
    const rows = await prisma.$queryRawUnsafe<
      {
        id: bigint | number;
        user_id: bigint | number | null;
        start_date: string | Date | null;
        end_date: string | Date | null;
        subscription_name: string | null;
        amount: string | number | null;
        installments: string | number | null;
      }[]
    >(
      `SELECT id, user_id, start_date, end_date, subscription_name, amount, installments
       FROM \`${table}\` WHERE club_id = ? AND (delete_status IS NULL OR delete_status = 0)
       ORDER BY id DESC LIMIT 500`,
      ctx.club.id
    );

    const userIds = rows.map((r) => String(r.user_id ?? '')).filter(Boolean);
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, surname: true, name: true, image: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    for (const row of rows) {
      const user = userMap.get(String(row.user_id ?? ''));
      items.push({
        id: String(row.id),
        name: user ? formatName(user.firstName, user.surname, user.name) : '-',
        image: user?.image ?? null,
        service: text(row.subscription_name) || '-',
        insertDate: row.start_date ? String(row.start_date).slice(0, 10) : '-',
        dateEnd: row.end_date ? String(row.end_date).slice(0, 10) : '-',
        value: num(row.amount),
        installment: text(row.installments) || '-',
        typology: 'Subscription',
      });
    }
  }

  return paginate(applyFilters(items, params), page, pageSize);
}

async function loadLegacyProductSaleItems(ctx: ClubAuthContext): Promise<Record<string, unknown>[]> {
  const table = await findExistingTable(['archive_seles', 'archive_sele']);
  const items: Record<string, unknown>[] = [];
  if (!table) return items;
  {
    const rows = await prisma.$queryRawUnsafe<
      {
        id: bigint | number;
        user_id: bigint | number | null;
        purchase_date: string | Date | null;
        total_amount: string | number | null;
        sector: string | null;
        status: string | number | null;
        order_id: string | null;
      }[]
    >(
      `SELECT id, user_id, purchase_date, total_amount, sector, status, order_id
       FROM \`${table}\` WHERE delete_status = 0
       ORDER BY id DESC LIMIT 500`
    );

    const userIds = rows.map((r) => String(r.user_id ?? '')).filter(Boolean);
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, surname: true, name: true, image: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    for (const row of rows) {
      const user = userMap.get(String(row.user_id ?? ''));
      items.push({
        id: String(row.id),
        name: user ? formatName(user.firstName, user.surname, user.name) : '-',
        image: user?.image ?? null,
        insertDate: row.purchase_date ? String(row.purchase_date).slice(0, 10) : '-',
        typology: 'Sellings',
        casual: text(row.sector) || text(row.order_id),
        value: num(row.total_amount),
        status: String(row.status) === '0' ? 'Paid' : 'Not paid',
      });
    }
  }
  return items;
}

export async function listUnifiedProductSales(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const items = await loadLegacyProductSaleItems(ctx);

  try {
    const procedure = await procedureService.listRecords(ctx, PROCEDURE_TYPE_CODES.PRODUCT_SALE, {
      page: 1,
      pageSize: 500,
    });
    for (const row of procedure.items) {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      items.push({
        id: `proc-${row.id}`,
        name: row.memberName,
        image: null,
        insertDate: row.recordDate,
        typology: 'Sellings',
        casual: text(meta.sector) || text(meta.productName) || row.notes || '-',
        value: row.totalAmount,
        status: row.balanceAmount > 0 ? 'Not paid' : 'Paid',
        source: 'procedure',
      });
    }
  } catch {
    // product_sale procedure type may not be seeded yet
  }

  items.sort((a, b) => String(b.insertDate).localeCompare(String(a.insertDate)));
  return paginate(applyFilters(items, params), page, pageSize);
}

export async function listLegacyProductSales(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  return listUnifiedProductSales(ctx, params);
}

export async function listAccessesArchive(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const memberIds = await clubMemberUserIds(ctx.club.id);
  const result = await queryLegacyTableArchive(
    ['club_access_controls'],
    (row, userMap) => {
      const uid = String(row.user_id ?? '');
      if (memberIds.length > 0 && !memberIds.includes(uid)) return null;
      const user = userMap.get(uid);
      return {
        id: String(row.id),
        name: user ? formatName(user.firstName, user.surname, user.name) : '-',
        image: user?.image ?? null,
        outcome: text(row.outcome),
        insertDate: row.date ? String(row.date).slice(0, 10) : '-',
        hour: text(row.hour) || '-',
        typology: 'Access',
      };
    },
    `SELECT id, user_id, date, hour, outcome FROM \`{table}\` ORDER BY date DESC, hour DESC LIMIT 1000`,
    [],
    params
  );
  return result;
}

export async function listReservationsArchive(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  return queryLegacyTableArchive(
    ['reservations'],
    (row, userMap) => {
      const user = userMap.get(String(row.user_id ?? ''));
      return {
        id: String(row.id),
        name: text(row.name) || (user ? formatName(user.firstName, user.surname, user.name) : '-'),
        image: user?.image ?? null,
        course: text(row.course_name) || text(row.course) || '-',
        insertDate: row.date ? String(row.date).slice(0, 10) : text(row.reservation_date).slice(0, 10) || '-',
        typology: 'Reservation',
        status: text(row.status) || '-',
      };
    },
    `SELECT id, user_id, name, course_name, course, date, reservation_date, status
     FROM \`{table}\` WHERE club_id = ? ORDER BY id DESC LIMIT 1000`,
    [ctx.club.id],
    params
  );
}

export async function listCardAssignmentsArchive(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const tables = [
    'card_rfidbadges_pool_allocations',
    'card_rfidbracelets_pool_allocations',
  ];
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const items: Record<string, unknown>[] = [];

  for (const candidate of tables) {
    const table = await findExistingTable([candidate]);
    if (!table) continue;
    try {
      const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT id, user_id, card_number, badge_number, assigned_date, created, modified
         FROM \`${table}\` ORDER BY id DESC LIMIT 500`
      );
      const userIds = rows.map((r) => String(r.user_id ?? '')).filter(Boolean);
      const users = userIds.length
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, surname: true, name: true, image: true },
          })
        : [];
      const userMap = new Map(users.map((u) => [u.id, u]));
      for (const row of rows) {
        const user = userMap.get(String(row.user_id ?? ''));
        items.push({
          id: `${table}-${row.id}`,
          name: user ? formatName(user.firstName, user.surname, user.name) : '-',
          image: user?.image ?? null,
          casual: text(row.card_number) || text(row.badge_number) || '-',
          insertDate: row.assigned_date
            ? String(row.assigned_date).slice(0, 10)
            : row.created
              ? String(row.created).slice(0, 10)
              : '-',
          typology: table.includes('bracelet') ? 'Bracelet' : 'Badge',
        });
      }
    } catch {
      // skip table variant
    }
  }

  return paginate(applyFilters(items, params), page, pageSize);
}

export async function listEventsArchive(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  return queryLegacyTableArchive(
    ['events'],
    (row) => ({
      id: String(row.id),
      name: text(row.title) || text(row.name) || text(row.event_name) || '-',
      insertDate: row.date ? String(row.date).slice(0, 10) : row.start_date ? String(row.start_date).slice(0, 10) : '-',
      typology: text(row.typology) || text(row.event_type) || 'Event',
      casual: text(row.description) || '-',
      status: text(row.status) || '-',
    }),
    `SELECT id, title, name, event_name, date, start_date, typology, event_type, description, status
     FROM \`{table}\` WHERE club_id = ? OR user_id = ? ORDER BY id DESC LIMIT 1000`,
    [ctx.club.id, ctx.userId],
    params
  );
}

export async function listPollsArchive(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  return queryLegacyTableArchive(
    ['polls'],
    (row) => ({
      id: String(row.id),
      name: text(row.question) || text(row.title) || text(row.name) || '-',
      insertDate: row.created ? String(row.created).slice(0, 10) : row.start_date ? String(row.start_date).slice(0, 10) : '-',
      typology: 'Poll',
      status: text(row.status) || '-',
    }),
    `SELECT id, question, title, name, created, start_date, status
     FROM \`{table}\` WHERE club_id = ? OR user_id = ? ORDER BY id DESC LIMIT 1000`,
    [ctx.club.id, ctx.userId],
    params
  );
}

export async function listMarketingContactsArchive(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  return queryLegacyTableArchive(
    ['club_setting_contacts', 'club_setting_contact'],
    (row) => ({
      id: String(row.id),
      name: text(row.name) || text(row.contact_name) || '-',
      casual: text(row.email) || text(row.phone) || '-',
      insertDate: row.created ? String(row.created).slice(0, 10) : '-',
      typology: text(row.contact_type) || 'Marketing',
    }),
    `SELECT id, name, contact_name, email, phone, contact_type, created
     FROM \`{table}\` WHERE club_id = ? ORDER BY id DESC LIMIT 1000`,
    [ctx.club.id],
    params
  );
}

export async function listAlertsAssignedArchive(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const tables = ['member_alert_users', 'panel_control_alerts', 'automatic_alerts'];
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const items: Record<string, unknown>[] = [];

  for (const candidate of tables) {
    const table = await findExistingTable([candidate]);
    if (!table) continue;
    try {
      const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT id, user_id, member_id, alert_type, title, message, created, date
         FROM \`${table}\` ORDER BY id DESC LIMIT 400`
      );
      const userIds = rows.flatMap((r) => [String(r.user_id ?? ''), String(r.member_id ?? '')]).filter(Boolean);
      const users = userIds.length
        ? await prisma.user.findMany({
            where: { id: { in: Array.from(new Set(userIds)) } },
            select: { id: true, firstName: true, surname: true, name: true, image: true },
          })
        : [];
      const userMap = new Map(users.map((u) => [u.id, u]));
      for (const row of rows) {
        const uid = String(row.user_id ?? row.member_id ?? '');
        const user = userMap.get(uid);
        items.push({
          id: `${table}-${row.id}`,
          name: user ? formatName(user.firstName, user.surname, user.name) : text(row.title) || '-',
          image: user?.image ?? null,
          casual: text(row.message) || text(row.alert_type) || '-',
          insertDate: row.date ? String(row.date).slice(0, 10) : row.created ? String(row.created).slice(0, 10) : '-',
          typology: 'Alert',
        });
      }
    } catch {
      // column mismatch on legacy table
    }
  }

  return paginate(applyFilters(items, params), page, pageSize);
}

export async function listAdvertisingCampaignsArchive(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  return queryLegacyTableArchive(
    ['campaigns'],
    (row) => ({
      id: String(row.id),
      name: text(row.name) || text(row.title) || '-',
      insertDate: row.start_date ? String(row.start_date).slice(0, 10) : '-',
      dateEnd: row.end_date ? String(row.end_date).slice(0, 10) : '-',
      typology: 'Campaign',
      status: text(row.status) || '-',
    }),
    `SELECT id, name, title, start_date, end_date, status
     FROM \`{table}\` WHERE club_id = ? OR user_id = ? ORDER BY id DESC LIMIT 1000`,
    [ctx.club.id, ctx.userId],
    params
  );
}

export async function listStaffQueriesArchive(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  return queryLegacyTableArchive(
    ['supportcontactmails', 'supportcontactmail'],
    (row, userMap) => {
      const user = userMap.get(String(row.user_id ?? ''));
      return {
        id: String(row.id),
        name: user ? formatName(user.firstName, user.surname, user.name) : text(row.name) || '-',
        image: user?.image ?? null,
        casual: text(row.subject) || text(row.message) || '-',
        insertDate: row.created ? String(row.created).slice(0, 10) : row.date ? String(row.date).slice(0, 10) : '-',
        typology: 'Staff query',
        status: text(row.status) || '-',
      };
    },
    `SELECT id, user_id, name, subject, message, created, date, status
     FROM \`{table}\` WHERE club_id = ? OR user_id = ? ORDER BY id DESC LIMIT 1000`,
    [ctx.club.id, ctx.userId],
    params
  );
}

export async function listCashMovements(
  ctx: ClubAuthContext,
  direction: 'all' | 'IN' | 'OUT',
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const items: Record<string, unknown>[] = [];

  async function pushPayments(
    procedureType: string,
    idPrefix: string,
    cashDirection: 'IN' | 'OUT'
  ) {
    const payments = await procedureService
      .listPayments(ctx, procedureType, { page: 1, pageSize: 500 })
      .catch(() => ({ items: [] as Awaited<ReturnType<typeof procedureService.listPayments>>['items'] }));
    for (const p of payments.items) {
      items.push({
        id: `${idPrefix}${p.id}`,
        paymentId: p.id,
        procedureRecordId: p.procedureRecordId,
        procedureType,
        name: p.memberName,
        typology: p.typology,
        service: p.serviceName,
        insertDate: p.paymentDate,
        paid: p.amount,
        rest: p.residualDebt,
        value: p.originalDebt,
        direction: cashDirection,
        payMod: p.payMode,
        casual: p.notes,
        operator: p.operatorName,
      });
    }
  }

  if (direction === 'all' || direction === 'IN') {
    await pushPayments(PROCEDURE_TYPE_CODES.SERVICE_SALE, 'in-', 'IN');
    await pushPayments(PROCEDURE_TYPE_CODES.PRODUCT_SALE, 'pin-', 'IN');
    await pushPayments(PROCEDURE_TYPE_CODES.MEMBER_DEBT, 'mdin-', 'IN');
  }

  if (direction === 'all' || direction === 'OUT') {
    await pushPayments(PROCEDURE_TYPE_CODES.EXPENSE, 'out-', 'OUT');
  }

  items.sort((a, b) => String(b.insertDate).localeCompare(String(a.insertDate)));
  return paginate(applyFilters(items, params), page, pageSize);
}

export async function listInsertCredits(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const table = await findExistingTable(['insert_credits', 'insert_credit']);
  const items: Record<string, unknown>[] = [];

  if (table) {
    const rows = await prisma.$queryRawUnsafe<
      {
        id: bigint | number;
        user_id: bigint | number | null;
        credit_available: string | number | null;
        last_annotations: string | number | null;
        modified: string | Date | null;
        operator_id: bigint | number | null;
      }[]
    >(`SELECT id, user_id, credit_available, last_annotations, modified, operator_id
       FROM \`${table}\` ORDER BY modified DESC LIMIT 500`);

    const userIds = rows.flatMap((r) => [String(r.user_id ?? ''), String(r.operator_id ?? '')]).filter(Boolean);
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: Array.from(new Set(userIds)) } },
            select: { id: true, firstName: true, surname: true, name: true, image: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    for (const row of rows) {
      const member = userMap.get(String(row.user_id ?? ''));
      const operator = userMap.get(String(row.operator_id ?? ''));
      items.push({
        id: String(row.id),
        name: member ? formatName(member.firstName, member.surname, member.name) : '-',
        image: member?.image ?? null,
        value: num(row.credit_available),
        paid: num(row.last_annotations),
        insertDate: row.modified ? String(row.modified).slice(0, 10) : '-',
        operator: operator ? formatName(operator.firstName, operator.surname, operator.name) : '-',
        typology: 'Credit voucher',
      });
    }
  }

  return paginate(applyFilters(items, params), page, pageSize);
}

const UNIFIED_PROCEDURE_TYPES = [
  PROCEDURE_TYPE_CODES.SERVICE_SALE,
  PROCEDURE_TYPE_CODES.PRODUCT_SALE,
  PROCEDURE_TYPE_CODES.EXPENSE,
  PROCEDURE_TYPE_CODES.MEMBER_DEBT,
  PROCEDURE_TYPE_CODES.MEMBERSHIP,
  PROCEDURE_TYPE_CODES.COURSE_SUBSCRIPTION,
] as const;

type UnifiedDeadlineRecord = Awaited<
  ReturnType<typeof procedureService.listRecords>
>['items'][number];

/** One row per procedure record, with the record's own totals. */
function deadlineRecordRow(
  procedureType: string,
  r: UnifiedDeadlineRecord
): Record<string, unknown> {
  const meta = r.metadata ?? {};
  const primary =
    String(meta.serviceName ?? meta.productName ?? meta.expenseName ?? meta.debtLabel ?? '').trim() ||
    '-';
  const secondary = String(meta.sectorName ?? meta.typologyName ?? '').trim() || '';
  return {
    id: r.id,
    userId: r.memberId,
    memberId: r.memberId,
    name: r.memberName,
    image: r.memberImage,
    typology: getProcedureTypology(procedureType),
    procedureType,
    procedureRecordId: r.id,
    service: primary,
    course: secondary || undefined,
    insertDate: r.recordDate,
    expirationDate: r.dueDate ?? r.recordDate,
    value: r.totalAmount,
    paid: r.paidAmount,
    rest: r.balanceAmount,
    casual: r.notes ?? '',
    operator: r.operatorName,
    dateEnd: r.lastPaymentDate,
  };
}

/** Records created before deadlines were split still owe their balance as a single deadline. */
function recordAsSingleInstallment(r: UnifiedDeadlineRecord): InstallmentDto {
  return {
    id: `${r.id}-record`,
    procedureRecordId: r.id,
    paid: r.paidAmount,
    balance: r.balanceAmount,
    paymentDate: r.recordDate,
    expireDate: r.dueDate,
    createdAt: r.createdAt,
    description: null,
  };
}

/**
 * "Display every deadlines": one row per installment, matching the Deadlines list of the payment
 * form — each row carries that deadline's own expire date, amount and rest.
 */
function deadlineInstallmentRows(
  procedureType: string,
  r: UnifiedDeadlineRecord,
  installments: InstallmentDto[],
  includePaid: boolean
): Record<string, unknown>[] {
  const base = deadlineRecordRow(procedureType, r);
  const source =
    installments.length > 0
      ? projectInstallmentsOnBalance(installments, r.balanceAmount)
      : [recordAsSingleInstallment(r)];

  const rows = source.map((inst, index) => ({
    ...base,
    id: inst.id,
    deadlineNo: `${index + 1} of ${source.length}`,
    expirationDate: inst.expireDate ?? inst.paymentDate,
    expireAt: inst.createdAt,
    value: Math.round((inst.paid + inst.balance) * 100) / 100,
    paid: inst.paid,
    rest: inst.balance,
    casual: inst.description ?? base.casual,
  }));

  if (includePaid) return rows;
  const open = rows.filter((row) => row.rest > 0.005);
  // Never let a record that still owes money vanish because its installments drifted.
  return open.length > 0 || r.balanceAmount <= 0.005 ? open : rows;
}

/** Archives menu: all typologies in one Deadlines list. */
export async function listUnifiedDeadlines(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams & { includePaid?: boolean; expandDeadlines?: boolean } = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const records: { procedureType: string; record: UnifiedDeadlineRecord }[] = [];

  for (const procedureType of UNIFIED_PROCEDURE_TYPES) {
    const res = await procedureService
      .listRecords(
        ctx,
        procedureType,
        {
          page: 1,
          pageSize: 500,
          memberId: params.memberId,
          recordId: params.recordId,
        },
        { onlyWithBalance: !params.includePaid }
      )
      .catch(() => ({ items: [] as UnifiedDeadlineRecord[] }));

    for (const record of res.items) records.push({ procedureType, record });
  }

  const installmentsByRecord = params.expandDeadlines
    ? await listInstallmentsForRecords(records.map((r) => r.record.id))
    : new Map<string, InstallmentDto[]>();

  const items: Record<string, unknown>[] = [];
  for (const { procedureType, record } of records) {
    if (!params.expandDeadlines) {
      items.push(deadlineRecordRow(procedureType, record));
      continue;
    }
    items.push(
      ...deadlineInstallmentRows(
        procedureType,
        record,
        installmentsByRecord.get(record.id) ?? [],
        Boolean(params.includePaid)
      )
    );
  }

  // Stable sort keeps the deadlines of one record together, oldest expire date first.
  items.sort((a, b) => String(b.insertDate).localeCompare(String(a.insertDate)));
  return paginate(applyFilters(items, params), page, pageSize);
}

/** Archives menu: all typologies in one Payments list. */
export async function listUnifiedPayments(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const items: Record<string, unknown>[] = [];

  for (const procedureType of UNIFIED_PROCEDURE_TYPES) {
    const res = await procedureService
      .listPayments(ctx, procedureType, {
        page: 1,
        pageSize: 500,
        memberId: params.memberId,
        recordId: params.recordId,
      })
      .catch(() => ({ items: [] as Awaited<ReturnType<typeof procedureService.listPayments>>['items'] }));

    for (const p of res.items) {
      items.push({
        id: p.id,
        userId: p.memberId,
        memberId: p.memberId,
        procedureRecordId: p.procedureRecordId,
        procedureType,
        name: p.memberName,
        typology: getProcedureTypology(procedureType),
        service: p.serviceName ?? '-',
        insertDate: p.paymentDate,
        paid: p.amount,
        originalDebt: p.originalDebt,
        residualDebt: p.residualDebt,
        rest: p.balanceAfter ?? p.residualDebt,
        casual: p.notes ?? '',
        operator: p.operatorName,
        operatorId: p.operatorId,
        payMod: p.payMode,
      });
    }
  }

  items.sort((a, b) => String(b.insertDate).localeCompare(String(a.insertDate)));
  return paginate(applyFilters(items, params), page, pageSize);
}

/** Archives menu: all typologies in one Receipts list. */
export async function listUnifiedReceipts(
  ctx: ClubAuthContext,
  params: ArchiveQueryParams = {}
): Promise<PaginatedArchive<Record<string, unknown>>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const items: Record<string, unknown>[] = [];

  for (const procedureType of UNIFIED_PROCEDURE_TYPES) {
    const res = await procedureService
      .listReceipts(ctx, procedureType, {
        page: 1,
        pageSize: 500,
        memberId: params.memberId,
        recordId: params.recordId,
      })
      .catch(() => ({ items: [] as Awaited<ReturnType<typeof procedureService.listReceipts>>['items'] }));

    for (const r of res.items) {
      items.push({
        id: r.id,
        userId: r.memberId,
        memberId: r.memberId,
        procedureRecordId: r.procedureRecordId,
        procedureType,
        name: r.memberName,
        typology: getProcedureTypology(procedureType),
        service: r.serviceName ?? '-',
        insertDate: r.receiptDate,
        category: r.documentType,
        contract: r.documentNumber,
        value: r.amount,
        paid: r.paymentAmount,
        residualDebt: r.residualDebt ?? Math.max(0, r.amount - r.paymentAmount),
        casual: r.annotations ?? '',
        operator: r.operatorName,
        isDuplicate: r.isDuplicate ?? false,
      });
    }
  }

  items.sort((a, b) => String(b.insertDate).localeCompare(String(a.insertDate)));
  return paginate(applyFilters(items, params), page, pageSize);
}

export async function listCompanies(ctx: ClubAuthContext): Promise<{ id: string; name: string }[]> {
  const table = await findExistingTable(['multifactories', 'multifactory']);
  if (!table) {
    return [{ id: 'default', name: 'Default company' }];
  }

  const rows = await prisma.$queryRawUnsafe<{ id: bigint | number; name: string | null }[]>(
    `SELECT id, name FROM \`${table}\` WHERE club_id = ? OR user_id = ? ORDER BY name ASC`,
    ctx.club.id,
    ctx.userId
  );

  const companies = rows.map((r) => ({ id: String(r.id), name: text(r.name) || `Company ${r.id}` }));
  return companies.length > 0 ? companies : [{ id: 'default', name: 'Default company' }];
}
