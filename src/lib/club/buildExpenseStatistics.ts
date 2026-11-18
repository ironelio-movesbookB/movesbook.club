import { ProcedureRecordStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { findExistingTable } from '@/lib/club/legacyTableLookup';
import { getLegacyUserId } from '@/lib/procedures/expenseFormOptions';
import { PROCEDURE_TYPE_CODES, type ClubAuthContext } from '@/lib/procedures/types';
import type { StatsSlice } from '@/lib/admin/buildStatistics';
import {
  EXPENSE_OTHERS_KEY,
  EXPENSE_TOP_N,
  EXPENSE_TREND_YEARS,
  MONTH_LABELS,
  type ExpenseAmountBasis,
  type ExpenseBranchMode,
  type ExpenseCategory,
  type ExpenseCategoryRow,
  type ExpenseCell,
  type ExpensePie,
  type ExpenseStatisticsPayload,
  type ExpenseStatsView,
  type ExpenseTrendPoint,
} from '@/lib/club/expenseStatisticsShared';

export * from '@/lib/club/expenseStatisticsShared';

export type BuildExpenseStatisticsOptions = {
  view: ExpenseStatsView;
  branchMode: ExpenseBranchMode;
  amountBasis?: ExpenseAmountBasis;
  /** Category key: main expense id (main mode) or leaf expense id (sub mode). */
  expenseId?: string | null;
  /** 1-12 */
  month?: number | null;
  year?: number | null;
};

type CatalogRow = { id: string; name: string; parentId: string };

type Resolved = { main: ExpenseCategory; leaf: ExpenseCategory };

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function emptyCell(): ExpenseCell {
  return { amount: 0, count: 0 };
}

function addCell(target: ExpenseCell, amount: number, count = 1) {
  target.amount += amount;
  target.count += count;
}

function labelCompare(a: { label: string }, b: { label: string }): number {
  return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
}

/** Expense categories of the club admin from the legacy `expenses` table. */
async function loadExpenseCatalog(clubId: string): Promise<CatalogRow[]> {
  try {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { adminId: true },
    });
    if (!club) return [];

    const legacyUserId = await getLegacyUserId(club.adminId);
    const userIds = Array.from(new Set([club.adminId, legacyUserId].filter(Boolean) as string[]));
    const table = await findExistingTable(['expenses']);
    if (!table || userIds.length === 0) return [];

    const placeholders = userIds.map(() => '?').join(',');
    const rows = await prisma.$queryRawUnsafe<
      { id: bigint | number | string; name: string | null; parent_id: bigint | number | string | null }[]
    >(
      `SELECT id, name, parent_id FROM \`${table}\`
       WHERE user_id IN (${placeholders})
       ORDER BY name ASC`,
      ...userIds,
    );

    const out: CatalogRow[] = [];
    for (const row of rows) {
      const name = text(row.name);
      if (!name) continue;
      const parent = text(row.parent_id);
      out.push({ id: String(row.id), name, parentId: !parent || parent === '0' ? '0' : parent });
    }
    return out;
  } catch (error) {
    console.error('buildExpenseStatistics: failed to load expenses catalog', error);
    return [];
  }
}

function buildResolver(catalog: CatalogRow[]) {
  const byId = new Map(catalog.map((r) => [r.id, r]));
  const byName = new Map<string, CatalogRow>();
  for (const row of catalog) {
    const key = row.name.toLowerCase();
    // Prefer sub-expenses (the ones that can be picked in the expense form).
    if (!byName.has(key) || (byName.get(key)!.parentId === '0' && row.parentId !== '0')) {
      byName.set(key, row);
    }
  }
  const parentIds = new Set(catalog.filter((r) => r.parentId !== '0').map((r) => r.parentId));

  const toResolved = (row: CatalogRow): Resolved => {
    const parent = row.parentId !== '0' ? byId.get(row.parentId) : undefined;
    const main = parent ?? row;
    return {
      main: { key: main.id, label: main.name },
      leaf: { key: row.id, label: row.name },
    };
  };

  const resolve = (expenseId: string, expenseName: string): Resolved => {
    const row = (expenseId ? byId.get(expenseId) : undefined) ?? byName.get(expenseName.toLowerCase());
    if (row) return toResolved(row);
    const label = expenseName || 'Unspecified';
    const key = `name:${label.toLowerCase()}`;
    return { main: { key, label }, leaf: { key, label } };
  };

  const catalogCategories = (mode: ExpenseBranchMode): ExpenseCategory[] => {
    const map = new Map<string, ExpenseCategory>();
    for (const row of catalog) {
      const resolved = toResolved(row);
      if (mode === 'main') {
        map.set(resolved.main.key, resolved.main);
      } else if (!parentIds.has(row.id)) {
        // Leaf expenses only (sub-expenses, or top-level ones without children).
        map.set(resolved.leaf.key, resolved.leaf);
      }
    }
    return Array.from(map.values());
  };

  return { resolve, catalogCategories };
}

type RecordLite = {
  year: number;
  month: number; // 0-11
  amount: number;
  main: ExpenseCategory;
  leaf: ExpenseCategory;
};

function toSlices(
  items: Array<{ key: string; label: string; amount: number; count: number }>,
): StatsSlice[] {
  const total = items.reduce((sum, i) => sum + i.amount, 0);
  return items.map((i) => ({
    key: i.key,
    label: i.label,
    count: i.count,
    income: round2(i.amount),
    percent: total > 0 ? Math.round((i.amount / total) * 1000) / 10 : 0,
  }));
}

/** Top N by amount (ties: count) + one "Rest" slice for everything else. */
function topWithRest(
  items: Array<{ key: string; label: string; amount: number; count: number }>,
  topN = EXPENSE_TOP_N,
): StatsSlice[] {
  const ranked = items
    .filter((i) => i.amount > 0 || i.count > 0)
    .sort((a, b) => b.amount - a.amount || b.count - a.count || labelCompare(a, b));
  const head = ranked.slice(0, topN);
  const tail = ranked.slice(topN);
  const out = [...head];
  if (tail.length > 0) {
    out.push({
      key: EXPENSE_OTHERS_KEY,
      label: 'Rest',
      amount: tail.reduce((s, i) => s + i.amount, 0),
      count: tail.reduce((s, i) => s + i.count, 0),
    });
  }
  return toSlices(out);
}

function sumCells(cells: ExpenseCell[]): ExpenseCell {
  const out = emptyCell();
  for (const c of cells) addCell(out, c.amount, c.count);
  return { amount: round2(out.amount), count: out.count };
}

function monthSlices(months: ExpenseCell[]): StatsSlice[] {
  return toSlices(
    months.map((cell, i) => ({
      key: `m${i + 1}`,
      label: MONTH_LABELS[i],
      amount: cell.amount,
      count: cell.count,
    })),
  );
}

function makePie(key: string, label: string, months: ExpenseCell[]): ExpensePie {
  const total = sumCells(months);
  return { key, label, total: total.amount, count: total.count, slices: monthSlices(months) };
}

export async function buildExpenseStatistics(
  ctx: ClubAuthContext,
  options: BuildExpenseStatisticsOptions,
): Promise<ExpenseStatisticsPayload> {
  const { view, branchMode } = options;
  const amountBasis: ExpenseAmountBasis = options.amountBasis === 'paid' ? 'paid' : 'total';
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const year =
    options.year && Number.isInteger(options.year) && options.year > 1900 && options.year < 3000
      ? options.year
      : currentYear;

  const [catalog, rows] = await Promise.all([
    loadExpenseCatalog(ctx.club.id),
    prisma.procedureRecord.findMany({
      where: {
        clubId: ctx.club.id,
        procedureType: { code: PROCEDURE_TYPE_CODES.EXPENSE },
        status: ProcedureRecordStatus.ACTIVE,
      },
      select: { recordDate: true, totalAmount: true, paidAmount: true, metadata: true },
    }),
  ]);

  const resolver = buildResolver(catalog);

  const records: RecordLite[] = [];
  for (const row of rows) {
    const date = row.recordDate;
    if (!date) continue;
    const metadata =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const { main, leaf } = resolver.resolve(text(metadata.expenseId), text(metadata.expenseName));
    const amount = Number(String(amountBasis === 'paid' ? row.paidAmount : row.totalAmount)) || 0;
    records.push({ year: date.getUTCFullYear(), month: date.getUTCMonth(), amount, main, leaf });
  }

  const pick = (r: RecordLite) => (branchMode === 'main' ? r.main : r.leaf);

  // Categories: catalog + anything seen in records (e.g. deleted categories), alphabetical.
  const categoryMap = new Map<string, ExpenseCategory>();
  for (const c of resolver.catalogCategories(branchMode)) categoryMap.set(c.key, c);
  for (const r of records) {
    const c = pick(r);
    if (!categoryMap.has(c.key)) categoryMap.set(c.key, c);
  }
  const categories = Array.from(categoryMap.values()).sort(labelCompare);

  const yearSet = new Set<number>([currentYear, year]);
  for (const r of records) yearSet.add(r.year);
  const years = Array.from(yearSet).sort((a, b) => b - a);

  // key -> 12 months (selected year)
  const matrix = new Map<string, ExpenseCell[]>();
  const ensureRow = (key: string) => {
    let months = matrix.get(key);
    if (!months) {
      months = Array.from({ length: 12 }, emptyCell);
      matrix.set(key, months);
    }
    return months;
  };
  // key -> year -> cell (all years)
  const yearly = new Map<string, Map<number, ExpenseCell>>();

  let totalAmount = 0;
  let totalCount = 0;
  for (const r of records) {
    const cat = pick(r);
    let byYear = yearly.get(cat.key);
    if (!byYear) {
      byYear = new Map();
      yearly.set(cat.key, byYear);
    }
    const yc = byYear.get(r.year) ?? emptyCell();
    addCell(yc, r.amount);
    byYear.set(r.year, yc);

    if (r.year !== year) continue;
    addCell(ensureRow(cat.key)[r.month], r.amount);
    totalAmount += r.amount;
    totalCount += 1;
  }

  const labelOf = new Map(categories.map((c) => [c.key, c.label]));
  const rowTotal = (key: string) => sumCells(matrix.get(key) ?? []);

  const requestedKey = text(options.expenseId);
  const yearRanked = [...categories].sort(
    (a, b) => rowTotal(b.key).amount - rowTotal(a.key).amount || labelCompare(a, b),
  );

  const lifetimeTotal = (key: string) => {
    let sum = 0;
    for (const cell of yearly.get(key)?.values() ?? []) sum += cell.amount;
    return sum;
  };

  const pickCategory = (rank: ExpenseCategory[]): ExpenseCategory | null => {
    if (requestedKey && labelOf.has(requestedKey)) {
      return { key: requestedKey, label: labelOf.get(requestedKey)! };
    }
    return rank[0] ?? null;
  };

  const payload: ExpenseStatisticsPayload = {
    view,
    clubId: ctx.club.id,
    branchMode,
    amountBasis,
    year,
    years,
    categories,
    totalAmount: round2(totalAmount),
    totalCount,
    selectedCategory: null,
    selectedMonth: null,
  };

  const monthsOf = (key: string) => matrix.get(key) ?? Array.from({ length: 12 }, emptyCell);

  switch (view) {
    case 'A': {
      const selected = pickCategory(yearRanked);
      payload.selectedCategory = selected;
      const months = selected ? monthsOf(selected.key) : Array.from({ length: 12 }, emptyCell);
      payload.a = { total: sumCells(months), slices: monthSlices(months) };
      break;
    }

    case 'B': {
      const ranked = yearRanked.filter((c) => rowTotal(c.key).amount > 0 || rowTotal(c.key).count > 0);
      const head = ranked.slice(0, EXPENSE_TOP_N);
      const tail = ranked.slice(EXPENSE_TOP_N);
      const pies = head.map((c) => makePie(c.key, c.label, monthsOf(c.key)));
      let rest: ExpensePie | null = null;
      if (tail.length > 0) {
        const merged = Array.from({ length: 12 }, emptyCell);
        for (const c of tail) {
          monthsOf(c.key).forEach((cell, i) => addCell(merged[i], cell.amount, cell.count));
        }
        rest = makePie(EXPENSE_OTHERS_KEY, 'Rest of the types of expense', merged);
      }
      payload.b = { pies, rest };
      break;
    }

    case 'C': {
      const raw = Number(options.month);
      const month =
        Number.isInteger(raw) && raw >= 1 && raw <= 12 ? raw : now.getUTCMonth() + 1;
      payload.selectedMonth = month;
      const items = categories.map((c) => ({
        key: c.key,
        label: c.label,
        amount: monthsOf(c.key)[month - 1].amount,
        count: monthsOf(c.key)[month - 1].count,
      }));
      const slices = topWithRest(items);
      const total = sumCells(items.map((i) => ({ amount: i.amount, count: i.count })));
      payload.c = { month, monthLabel: MONTH_LABELS[month - 1], total, slices };
      break;
    }

    case 'D': {
      const months = Array.from({ length: 12 }, (_, i) => {
        const items = categories.map((c) => ({
          key: c.key,
          label: c.label,
          amount: monthsOf(c.key)[i].amount,
          count: monthsOf(c.key)[i].count,
        }));
        const total = sumCells(items.map((it) => ({ amount: it.amount, count: it.count })));
        return {
          key: `m${i + 1}`,
          label: MONTH_LABELS[i],
          month: i + 1,
          total: total.amount,
          count: total.count,
          slices: topWithRest(items),
        };
      });
      payload.d = { months };
      break;
    }

    case 'E': {
      const eRows: ExpenseCategoryRow[] = categories.map((c) => {
        const months = monthsOf(c.key).map((cell) => ({
          amount: round2(cell.amount),
          count: cell.count,
        }));
        return { key: c.key, label: c.label, months, total: sumCells(months) };
      });
      payload.e = { rows: eRows };
      break;
    }

    case 'F': {
      const lifetimeRanked = [...categories].sort(
        (a, b) => lifetimeTotal(b.key) - lifetimeTotal(a.key) || labelCompare(a, b),
      );
      const selected = pickCategory(lifetimeRanked);
      payload.selectedCategory = selected;

      const byYear = (selected ? yearly.get(selected.key) : null) ?? new Map<number, ExpenseCell>();
      const firstYear = Math.min(year, ...Array.from(byYear.keys()));
      const windowStart = year - (EXPENSE_TREND_YEARS - 1);

      const points: ExpenseTrendPoint[] = [];
      if (firstYear < windowStart) {
        let sum = 0;
        let count = 0;
        for (let y = firstYear; y < windowStart; y += 1) {
          const cell = byYear.get(y);
          sum += cell?.amount ?? 0;
          count += cell?.count ?? 0;
        }
        const span = windowStart - firstYear;
        points.push({
          key: 'average',
          label: 'Average previous',
          year: null,
          isAverage: true,
          amount: round2(sum / span),
          count: Math.round(count / span),
        });
      }
      for (let y = windowStart; y <= year; y += 1) {
        const cell = byYear.get(y);
        points.push({
          key: String(y),
          label: String(y),
          year: y,
          isAverage: false,
          amount: round2(cell?.amount ?? 0),
          count: cell?.count ?? 0,
        });
      }
      const allCells = Array.from(byYear.values());
      payload.f = { total: sumCells(allCells), points };
      break;
    }
  }

  return payload;
}
