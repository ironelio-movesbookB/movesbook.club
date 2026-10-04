import * as XLSX from 'xlsx';
import type { ClubAuthContext } from '@/lib/procedures/types';
import {
  listClubMembersArchive,
  listTeamMembersArchive,
  listCoachAthletesArchive,
} from '@/lib/club/archives/clubArchiveService';
import type { ArchiveQueryParams } from '@/lib/club/archives/legacyArchiveQueries';
import { memberArchiveStatusLabel, normalizeMemberArchiveStatus } from '@/lib/club/memberArchiveStatus';

export const MEMBER_ARCHIVE_ACTION_LIMIT = 2000;

type MembershipStatusParam = ArchiveQueryParams['membershipStatus'];

export function parseMemberIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .filter((id): id is string => typeof id === 'string')
    .map((id) => id.trim())
    .filter(Boolean);
  return Array.from(new Set(ids));
}

export function parseMembershipStatus(value: unknown): MembershipStatusParam {
  return value === 'member' ||
    value === 'pending' ||
    value === 'not_member' ||
    value === 'archived' ||
    value === 'all'
    ? value
    : undefined;
}

/**
 * Archive rows for the requested ids, limited to people of the caller's club/team.
 * Ids that do not belong to this club are silently dropped.
 */
export async function loadMemberArchiveRowsForIds(
  ctx: ClubAuthContext,
  memberIds: string[],
  membershipStatus: MembershipStatusParam,
): Promise<Record<string, unknown>[]> {
  if (memberIds.length === 0) return [];
  const params: ArchiveQueryParams = {
    page: 1,
    pageSize: MEMBER_ARCHIVE_ACTION_LIMIT,
    memberIdsIn: memberIds,
    membershipStatus,
  };
  const result =
    ctx.workspaceKind === 'coach'
      ? await listCoachAthletesArchive(ctx, params)
      : ctx.workspaceKind === 'team'
        ? await listTeamMembersArchive(ctx, params)
        : await listClubMembersArchive(ctx, params);
  const order = new Map(memberIds.map((id, i) => [id, i]));
  return [...result.items].sort(
    (a, b) =>
      (order.get(String(a.memberId ?? a.id)) ?? 0) - (order.get(String(b.memberId ?? b.id)) ?? 0),
  );
}

const EXPORT_COLUMNS: Array<{ header: string; value: (row: Record<string, unknown>) => string }> = [
  { header: 'Surname', value: (r) => cell(r.surname) },
  { header: 'Name', value: (r) => cell(r.name) },
  { header: 'Gender', value: (r) => cell(r.gender) },
  { header: 'Date of Birth', value: (r) => cell(r.dateOfBirth) },
  { header: 'Type of User', value: (r) => cell(r.operator) },
  { header: 'Member Type', value: (r) => cell(r.memberType) },
  { header: 'Local City', value: (r) => cell(r.localCity) },
  { header: 'Phone', value: (r) => cell(r.phone) },
  { header: 'Email', value: (r) => cell(r.email) },
  { header: 'Insert Date', value: (r) => cell(r.insertDateDisplay ?? r.insertDate) },
  {
    header: 'Status',
    value: (r) => memberArchiveStatusLabel(normalizeMemberArchiveStatus(String(r.membershipStatus ?? ''))),
  },
];

function cell(value: unknown): string {
  const s = String(value ?? '').trim();
  return s === '' ? '-' : s;
}

export function memberArchiveExportTable(rows: Record<string, unknown>[]): string[][] {
  return [
    EXPORT_COLUMNS.map((c) => c.header),
    ...rows.map((row) => EXPORT_COLUMNS.map((c) => c.value(row))),
  ];
}

export function buildMemberArchiveCsv(rows: Record<string, unknown>[]): string {
  const escape = (v: string) => (/[",\r\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = memberArchiveExportTable(rows).map((line) => line.map(escape).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function buildMemberArchiveXlsx(rows: Record<string, unknown>[]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(memberArchiveExportTable(rows));
  sheet['!cols'] = EXPORT_COLUMNS.map((c) => ({ wch: Math.max(12, c.header.length + 2) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Members');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}
