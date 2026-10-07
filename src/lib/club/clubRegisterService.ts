import { prisma } from '@/lib/prisma';
import type { CoachWorkspace } from '@/lib/club/clubCoachService';
import { listClubCoaches } from '@/lib/club/clubCoachService';
import { listStaffDetails } from '@/lib/club/clubStaffAdminService';
import { normalizeMemberArchiveStatus, type MemberArchiveStatus } from '@/lib/club/memberArchiveStatus';
import {
  EMPTY_STAFF_DETAILS,
  REGISTER_CATEGORY_IDS,
  type RegisterCategoryId,
  type RegisterPerson,
  type RegisterSection,
  type StaffDetails,
} from '@/lib/club/clubStaffAdmin.constants';

const isoDate = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const ymd = (v: unknown) => {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v ?? ''));
  return m ? m[1] : '';
};
const text = (v: unknown) => String(v ?? '').trim();
const place = (...parts: unknown[]) => parts.map(text).filter(Boolean).join(', ');

function parseJson(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const bySurname = (a: RegisterPerson, b: RegisterPerson) =>
  `${a.surname} ${a.name}`.localeCompare(`${b.surname} ${b.name}`, undefined, { sensitivity: 'base' });

/** Type of staff for the register: Board member, Instructor, Personal trainer or Operator. */
export function staffRegisterType(role: string, details: StaffDetails): string {
  if (details.boardMember) return 'Board member';
  if (role === 'Instructor') return 'Instructor';
  if (role === 'Personal trainer') return 'Personal trainer';
  return 'Operator';
}

type MemberLink = {
  status: MemberArchiveStatus;
  joinedAt: Date;
  profileJson: string | null;
  user: { id: string; firstName: string | null; surname: string | null; name: string; birthdate: Date | null };
};

async function workspaceMembers(ws: CoachWorkspace): Promise<MemberLink[]> {
  const userSelect = { id: true, firstName: true, surname: true, name: true, birthdate: true };
  if (ws.kind === 'team') {
    const rows = await prisma.teamMember.findMany({
      where: { teamId: ws.id },
      select: { role: true, joinedAt: true, athlete: { select: userSelect }, profile: { select: { profileJson: true } } },
    });
    return rows.map((r) => ({
      status: normalizeMemberArchiveStatus(r.role),
      joinedAt: r.joinedAt,
      profileJson: r.profile?.profileJson ?? null,
      user: r.athlete,
    }));
  }
  const rows = await prisma.clubMember.findMany({
    where: { clubId: ws.id },
    select: { role: true, joinedAt: true, member: { select: userSelect }, profile: { select: { profileJson: true } } },
  });
  return rows.map((r) => ({
    status: normalizeMemberArchiveStatus(r.role),
    joinedAt: r.joinedAt,
    profileJson: r.profile?.profileJson ?? null,
    user: r.member,
  }));
}

function memberPerson(link: MemberLink, owner: Record<string, any>): RegisterPerson {
  const scoped = parseJson(link.profileJson);
  const other = scoped.otherDetails ?? {};
  const personal = owner.personal ?? {};
  const nameParts = text(link.user.name).split(/\s+/).filter(Boolean);
  return {
    surname: text(link.user.surname) || nameParts.slice(1).join(' '),
    name: text(link.user.firstName) || nameParts[0] || '',
    taxCode: text(owner.administrative?.fiscalCode).toUpperCase(),
    birthDate: isoDate(link.user.birthdate) || ymd(personal.dateOfBirth),
    birthPlace: place(personal.locationOfBirth, personal.provinceOfBirth, personal.countryOfBirth),
    role: 'Athlete',
    memberNumber: text(other.membershipRegistrationNumber),
    since: ymd(other.membershipFrom) || isoDate(link.joinedAt),
  };
}

function parentPeople(links: MemberLink[]): RegisterPerson[] {
  const seen = new Set<string>();
  const people: RegisterPerson[] = [];
  for (const link of links) {
    if (link.status === 'archived') continue;
    const parents = parseJson(link.profileJson).parents ?? {};
    for (const slot of ['parent1', 'parent2']) {
      const p = parents[slot];
      if (!p || (!text(p.name) && !text(p.surname))) continue;
      const taxCode = text(p.fiscalCode).toUpperCase();
      const key = taxCode || `${text(p.surname)}|${text(p.name)}|${ymd(p.birthDate)}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      people.push({
        surname: text(p.surname),
        name: text(p.name),
        taxCode,
        birthDate: ymd(p.birthDate),
        birthPlace: place(p.location, p.province, p.country),
        role: text(p.kinship) || 'Parent',
        memberNumber: '',
        since: '',
      });
    }
  }
  return people;
}

type StaffEntry = { role: string; details: StaffDetails; person: RegisterPerson };

async function staffEntries(ws: CoachWorkspace): Promise<StaffEntry[]> {
  const select = {
    id: true,
    role: true,
    createdAt: true,
    user: { select: { firstName: true, surname: true, name: true, birthdate: true } },
  };
  const [rows, detailsById] = await Promise.all([
    ws.kind === 'team'
      ? prisma.teamStaff.findMany({ where: { teamId: ws.id }, select })
      : prisma.clubStaff.findMany({ where: { clubId: ws.id }, select }),
    listStaffDetails(ws),
  ]);
  return rows.map((r) => {
    const details = detailsById.get(r.id) ?? EMPTY_STAFF_DETAILS;
    return {
      role: r.role,
      details,
      person: {
        surname: text(r.user.surname),
        name: text(r.user.firstName) || text(r.user.name),
        taxCode: details.taxCode,
        birthDate: isoDate(r.user.birthdate),
        birthPlace: place(details.birthCity, details.birthProvince, details.birthCountry),
        role: details.companyRole || staffRegisterType(r.role, details),
        memberNumber: details.memberNumber,
        since: details.activityStart || details.hireDate || isoDate(r.createdAt),
      },
    };
  });
}

export function parseRegisterCategories(raw: unknown): RegisterCategoryId[] {
  const list = Array.isArray(raw) ? raw.map(String) : [];
  return REGISTER_CATEGORY_IDS.filter((id) => list.includes(id));
}

/** People of each requested category, in the order of the register. */
export async function buildRegister(ws: CoachWorkspace, categories: RegisterCategoryId[]): Promise<RegisterSection[]> {
  const wants = (...ids: RegisterCategoryId[]) => ids.some((id) => categories.includes(id));
  const needsMembers = wants('athletes', 'archivedAthletes', 'notMembers', 'parents');
  const needsStaff = wants('boardMembers', 'staff', 'volunteers');

  const [members, staff, coaches] = await Promise.all([
    needsMembers ? workspaceMembers(ws) : Promise.resolve([] as MemberLink[]),
    needsStaff ? staffEntries(ws) : Promise.resolve([] as StaffEntry[]),
    wants('coaches') ? listClubCoaches(ws, 'active') : Promise.resolve([]),
  ]);

  const owners = new Map<string, Record<string, any>>();
  if (wants('athletes', 'archivedAthletes', 'notMembers') && members.length) {
    const extras = await prisma.userProfileExtras
      .findMany({ where: { userId: { in: members.map((m) => m.user.id) } }, select: { userId: true, ownerJson: true } })
      .catch(() => []);
    for (const e of extras) owners.set(e.userId, parseJson(e.ownerJson));
  }
  const membersWith = (status: MemberArchiveStatus) =>
    members.filter((m) => m.status === status).map((m) => memberPerson(m, owners.get(m.user.id) ?? {}));

  const build: Record<RegisterCategoryId, () => RegisterPerson[]> = {
    boardMembers: () => staff.filter((s) => s.details.boardMember).map((s) => s.person),
    athletes: () => membersWith('member'),
    archivedAthletes: () => membersWith('archived'),
    coaches: () =>
      coaches.map((c) => ({
        surname: c.surname,
        name: c.firstName,
        taxCode: c.taxCode,
        birthDate: c.birthDate,
        birthPlace: place(c.birthCity, c.birthProvince, c.birthCountry),
        role: c.role || 'Coach',
        memberNumber: c.membershipNumber,
        since: c.createdAt.slice(0, 10),
      })),
    parents: () => parentPeople(members),
    staff: () => staff.map((s) => s.person),
    notMembers: () => membersWith('not_member'),
    volunteers: () => staff.filter((s) => s.details.volunteer).map((s) => s.person),
  };

  return categories.map((id) => ({ id, people: build[id]().sort(bySurname) }));
}
