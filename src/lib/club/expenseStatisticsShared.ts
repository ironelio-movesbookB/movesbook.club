/**
 * Client-safe (no prisma) types and constants for Club "Expenses archive" statistics.
 * Mirrors the Super Admin General graphs, with the dimensions remapped:
 *   Country -> Type of expense, Type of users -> Months, Versions -> Years,
 *   Users / Income toggle -> Main branches / Sub-branches.
 */
import type { StatsSlice } from '@/lib/admin/buildStatistics';

export type ExpenseStatsView = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export const EXPENSE_STATS_VIEWS: ExpenseStatsView[] = ['A', 'B', 'C', 'D', 'E', 'F'];

export const EXPENSE_STATISTICS_BASE_PATH = '/clubs/expense_statistics';

export type ExpenseStatsViewMeta = {
  view: ExpenseStatsView;
  slug: string;
  href: string;
  menuLabel: string;
  title: string;
  description: string;
};

function meta(
  view: ExpenseStatsView,
  menuLabel: string,
  title: string,
  description: string,
): ExpenseStatsViewMeta {
  const slug = view.toLowerCase();
  return { view, slug, href: `${EXPENSE_STATISTICS_BASE_PATH}/${slug}`, menuLabel, title, description };
}

export const EXPENSE_STATS_VIEW_META: Record<ExpenseStatsView, ExpenseStatsViewMeta> = {
  A: meta(
    'A',
    'A type of expense in the months',
    'A type of expense in the months',
    'Pie or vertical graph of the months for the selected type of expense. Use Prev / Next to scroll the types of expense.',
  ),
  B: meta(
    'B',
    'Most recurrent types of expenses in the months',
    '12 most used expenses in the months',
    '11 pies of the most used types of expense (months as slices), plus 1 pie for all the rest. Switch Pie / Vertical graph.',
  ),
  C: meta(
    'C',
    'Most recurrent types of expenses in a month selected',
    '12 most used Expenses in a month selected',
    '11 slices of the most used types of expense in the selected month, plus 1 slice for the rest. Use Prev / Next to scroll months.',
  ),
  D: meta(
    'D',
    'Expenses in each month of the year',
    'Expenses in each month of the year',
    'One pie per month showing the 11 most used types of expense plus the rest.',
  ),
  E: meta(
    'E',
    'Expenses in all the months of each type of expense',
    'Expenses in all the months of each type of expense',
    'Vertical bars: every type of expense (alphabetically) with its 12 months.',
  ),
  F: meta(
    'F',
    'Trend — a type of expense in the years',
    'Trend — a type of expense in the years',
    'Last 9 years of the selected type of expense plus the average of the previous ones. Use Prev / Next to scroll the types of expense.',
  ),
};

export const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const MONTH_SHORT_LABELS = MONTH_LABELS.map((m) => m.slice(0, 3));

export type ExpenseBranchMode = 'main' | 'sub';
export type ExpenseAmountBasis = 'total' | 'paid';

export const EXPENSE_OTHERS_KEY = '__others__';
export const EXPENSE_TOP_N = 11;
export const EXPENSE_TREND_YEARS = 9;

export type ExpenseCategory = { key: string; label: string };

/** Amount in € and number of expense records. */
export type ExpenseCell = { amount: number; count: number };

export type ExpensePie = {
  key: string;
  label: string;
  total: number;
  count: number;
  slices: StatsSlice[];
};

export type ExpenseCategoryRow = {
  key: string;
  label: string;
  /** 12 entries, January -> December. */
  months: ExpenseCell[];
  total: ExpenseCell;
};

export type ExpenseTrendPoint = {
  key: string;
  label: string;
  year: number | null;
  isAverage: boolean;
  amount: number;
  count: number;
};

export type ExpenseStatisticsPayload = {
  view: ExpenseStatsView;
  clubId: string;
  branchMode: ExpenseBranchMode;
  amountBasis: ExpenseAmountBasis;
  year: number;
  /** Years that have expenses (plus the current year), newest first. */
  years: number[];
  /** Types of expense for the current branch mode, alphabetical. */
  categories: ExpenseCategory[];
  /** Totals for the selected year. */
  totalAmount: number;
  totalCount: number;
  selectedCategory: ExpenseCategory | null;
  selectedMonth: number | null;
  a?: { total: ExpenseCell; slices: StatsSlice[] };
  b?: { pies: ExpensePie[]; rest: ExpensePie | null };
  c?: { month: number; monthLabel: string; total: ExpenseCell; slices: StatsSlice[] };
  d?: { months: Array<ExpensePie & { month: number }> };
  e?: { rows: ExpenseCategoryRow[] };
  f?: { total: ExpenseCell; points: ExpenseTrendPoint[] };
};

const EURO_2 = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatExpenseEuro(value: number): string {
  return EURO_2.format(Number(value) || 0);
}

export function parseBranchMode(value: string | null | undefined): ExpenseBranchMode {
  return value === 'sub' ? 'sub' : 'main';
}

export function parseAmountBasis(value: string | null | undefined): ExpenseAmountBasis {
  return value === 'paid' ? 'paid' : 'total';
}

export function parseStatsView(value: string | null | undefined): ExpenseStatsView {
  const v = String(value ?? '').toUpperCase();
  return (EXPENSE_STATS_VIEWS as string[]).includes(v) ? (v as ExpenseStatsView) : 'A';
}
