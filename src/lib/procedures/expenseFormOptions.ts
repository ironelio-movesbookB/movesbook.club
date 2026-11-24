import { prisma } from '@/lib/prisma';
import { findExistingTable } from '@/lib/club/legacyTableLookup';
import { fetchProcedureCustomerOptions } from './clubMembers';
import { fetchClubOperatorOptions } from './clubOperators';
import { listCompanies } from '@/lib/club/archives/clubArchiveService';
import type { ClubAuthContext } from './types';

const EXPENSE_TABLE_CANDIDATES = ['expenses'];

function text(value: unknown): string {
  return String(value ?? '').trim();
}

async function getLegacyUserId(userId: string): Promise<string | null> {
  const fromId = userId.match(/^legacy_(\d+)(?:_|$)/);
  if (fromId?.[1]) return fromId[1];

  const mappingTable = await findExistingTable(['legacy_id_mappings']);
  if (!mappingTable) return null;

  const rows = await prisma.$queryRawUnsafe<{ legacy_id: number | string }[]>(
    `SELECT legacy_id
     FROM \`${mappingTable}\`
     WHERE new_id = ?
       AND legacy_table = 'users'
     ORDER BY legacy_id DESC
     LIMIT 1`,
    userId
  );

  return rows[0]?.legacy_id != null ? String(rows[0].legacy_id) : null;
}

export type ExpenseFormOptions = {
  expenses: { id: string; name: string }[];
  members: { id: string; name: string }[];
  operators: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  currentOperatorId: string | null;
};

export async function fetchExpenseFormOptions(ctx: ClubAuthContext): Promise<ExpenseFormOptions> {
  const members = await fetchProcedureCustomerOptions(ctx.club.id);
  const expenses: { id: string; name: string }[] = [];

  const club = await prisma.club.findUnique({
    where: { id: ctx.club.id },
    select: { adminId: true },
  });
  if (!club) {
    const [operators, companies] = await Promise.all([
      fetchClubOperatorOptions(ctx.club.id),
      listCompanies(ctx),
    ]);
    return { expenses, members, operators, companies, currentOperatorId: ctx.userId };
  }

  const legacyUserId = await getLegacyUserId(club.adminId);
  const expenseTable = await findExistingTable(EXPENSE_TABLE_CANDIDATES);

  if (expenseTable && legacyUserId) {
    const rows = await prisma.$queryRawUnsafe<{ id: bigint | number; name: string }[]>(
      `SELECT id, name FROM \`${expenseTable}\`
       WHERE user_id = ?
       ORDER BY name ASC`,
      legacyUserId
    );
    for (const row of rows) {
      const name = text(row.name);
      if (!name) continue;
      expenses.push({ id: String(row.id), name });
    }
  }

  const [operators, companies] = await Promise.all([
    fetchClubOperatorOptions(ctx.club.id),
    listCompanies(ctx),
  ]);

  return { expenses, members, operators, companies, currentOperatorId: ctx.userId };
}
