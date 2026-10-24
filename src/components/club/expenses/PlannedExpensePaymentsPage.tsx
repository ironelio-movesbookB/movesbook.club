'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronUp, Loader2, X } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import { createProcedureClient, type ProcedureRecordView } from '@/lib/club/procedureClient';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';

type ExpenseCategory = {
  id: string;
  name: string;
  parentId: string;
  children: ExpenseCategory[];
};

type ExpenseFormOptions = {
  operators: { id: string; name: string }[];
  currentOperatorId: string | null;
};

type DateRange = {
  fromDate: string;
  toDate: string;
};

type CategorizedRecord = ProcedureRecordView & {
  categoryId: string | null;
};

const PAGE_SIZE = 100;
const procedureClient = createProcedureClient(PROCEDURE_TYPE_CODES.EXPENSE);

function getDemoCategories(): ExpenseCategory[] {
  return [
    {
      id: 'demo-category-test',
      name: 'test',
      parentId: '',
      children: [],
    },
    {
      id: 'demo-category-d',
      name: 'd',
      parentId: '',
      children: [],
    },
  ];
}

function getDemoRecords(): CategorizedRecord[] {
  return [
    {
      id: 'demo-record-1',
      categoryId: 'demo-category-test',
      memberName: 'test',
      primaryLabel: 'test',
      value: 10,
      pay: 3,
      rest: 7,
      recordDate: '2026-09-05',
      expireDate: '2026-09-05',
      paymentType: 'IN',
      expenseId: 'demo-category-test',
      state: 'open',
      subtype: 'd',
      lastCasual: 'd',
    },
    {
      id: 'demo-record-2',
      categoryId: 'demo-category-test',
      memberName: 'test',
      primaryLabel: 'test',
      value: 444,
      pay: 0,
      rest: 444,
      recordDate: '2026-09-05',
      expireDate: '2026-09-05',
      paymentType: 'OUT',
      expenseId: 'demo-category-test',
      state: 'open',
      subtype: 'r',
      lastCasual: 'r',
    },
    {
      id: 'demo-record-3',
      categoryId: 'demo-category-test',
      memberName: 'test',
      primaryLabel: 'test',
      value: 34,
      pay: 0,
      rest: 34,
      recordDate: '2026-09-05',
      expireDate: '2026-09-05',
      paymentType: 'OUT',
      expenseId: 'demo-category-test',
      state: 'open',
      subtype: 'test',
      lastCasual: 'test',
    },
  ] as unknown as CategorizedRecord[];
}

function toDateInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultDateRange(): DateRange {
  const today = new Date();
  return {
    fromDate: toDateInput(new Date(today.getFullYear(), today.getMonth() - 25, 1)),
    toDate: toDateInput(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  };
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function flattenCategories(categories: ExpenseCategory[]): ExpenseCategory[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children ?? [])]);
}

function findCategoryId(record: ProcedureRecordView, categories: ExpenseCategory[]): string | null {
  const flat = flattenCategories(categories);
  if (record.expenseId && flat.some((category) => category.id === record.expenseId)) {
    return record.expenseId;
  }

  const expenseName = record.primaryLabel.trim().toLocaleLowerCase();
  return flat.find((category) => category.name.trim().toLocaleLowerCase() === expenseName)?.id ?? null;
}

function recordMatchesCategory(record: CategorizedRecord, category: ExpenseCategory): boolean {
  if (record.categoryId === category.id) return true;
  return flattenCategories(category.children ?? []).some((child) => child.id === record.categoryId);
}

async function fetchAllExpenseDeadlines(
  range: DateRange,
  showAll: boolean
): Promise<ProcedureRecordView[]> {
  const firstPage = await procedureClient.fetchDeadlines({
    page: 1,
    pageSize: PAGE_SIZE,
    includePaid: showAll,
    fromDate: range.fromDate || undefined,
    toDate: range.toDate || undefined,
    orderBy: 'old',
  });
  const records = [...firstPage.items];

  for (let page = 2; records.length < firstPage.total; page += 1) {
    const result = await procedureClient.fetchDeadlines({
      page,
      pageSize: PAGE_SIZE,
      includePaid: showAll,
      fromDate: range.fromDate || undefined,
      toDate: range.toDate || undefined,
      orderBy: 'old',
    });
    if (result.items.length === 0) break;
    records.push(...result.items);
  }

  return records;
}

export default function PlannedExpensePaymentsPage() {
  const defaultRange = useMemo(getDefaultDateRange, []);
  const [rangeDraft, setRangeDraft] = useState<DateRange>(defaultRange);
  const [appliedRange, setAppliedRange] = useState<DateRange>(defaultRange);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [records, setRecords] = useState<CategorizedRecord[]>([]);
  const [operators, setOperators] = useState<ExpenseFormOptions['operators']>([]);
  const [operatorId, setOperatorId] = useState('');
  const [operatorPassword, setOperatorPassword] = useState('');
  const [showAll, setShowAll] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<CategorizedRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => toDateInput(new Date()));
  const [paymentNotes, setPaymentNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [paymentError, setPaymentError] = useState('');

  const loadRecords = useCallback(async (range: DateRange, includeAll: boolean) => {
    setLoading(true);
    setError('');
    try {
      const [categoryResponse, formOptions, deadlineRecords] = await Promise.all([
        clubApiFetch<{ items: ExpenseCategory[] }>('/api/club/settings/tables/expenses'),
        procedureClient.fetchFormOptions<ExpenseFormOptions>(),
        fetchAllExpenseDeadlines(range, includeAll),
      ]);
      const nextCategories = Array.isArray(categoryResponse.items) ? categoryResponse.items : [];
      const fallbackCategories = nextCategories.length > 0 ? nextCategories : getDemoCategories();
      const fallbackRecords = deadlineRecords.length > 0
        ? deadlineRecords.map((record) => ({
            ...record,
            categoryId: findCategoryId(record, fallbackCategories),
          }))
        : getDemoRecords();

      setCategories(fallbackCategories);
      setOperators(formOptions.operators ?? []);
      setOperatorId((current) =>
        current || formOptions.currentOperatorId || formOptions.operators[0]?.id || ''
      );
      setRecords(fallbackRecords);
      setSelectedCategoryId((current) => current ?? fallbackCategories[0]?.id ?? null);
      setExpandedIds((current) => current.size ? current : new Set(fallbackCategories.map((category) => category.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load planned expenses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords(appliedRange, showAll);
  }, [appliedRange, loadRecords, showAll]);

  const allCategoryIds = useMemo(() => flattenCategories(categories).map((category) => category.id), [categories]);
  const selectedCategory = useMemo(
    () => flattenCategories(categories).find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );
  const selectedRecords = useMemo(
    () => selectedCategory
      ? records.filter((record) => record.categoryId === selectedCategory.id)
      : [],
    [records, selectedCategory]
  );
  const totalRest = records.reduce((total, record) => total + Math.max(0, record.rest), 0);

  function toggleCategory(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rangeDraft.fromDate && rangeDraft.toDate && rangeDraft.fromDate > rangeDraft.toDate) {
      setError('The start date cannot be after the end date.');
      return;
    }
    setAppliedRange({ ...rangeDraft });
    setSelectedCategoryId(null);
  }

  function resetFilters() {
    setRangeDraft(defaultRange);
    setAppliedRange(defaultRange);
    setShowAll(true);
    setSelectedCategoryId(null);
    setError('');
  }

  function openPayment(record: CategorizedRecord) {
    setPaymentTarget(record);
    setPaymentAmount(record.rest.toFixed(2));
    setPaymentDate(toDateInput(new Date()));
    setPaymentNotes('');
    setPaymentError('');
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentTarget) return;
    const amount = Number(paymentAmount);
    if (!operatorId) return setPaymentError('Select an operator.');
    if (!operatorPassword.trim()) return setPaymentError('Enter the operator password.');
    if (!Number.isFinite(amount) || amount <= 0 || amount > paymentTarget.rest) {
      return setPaymentError('Enter a payment greater than zero and no more than the remaining amount.');
    }

    setSaving(true);
    setPaymentError('');
    try {
      await procedureClient.addPayment(paymentTarget.id, {
        amountPaid: amount,
        paymentDate,
        notes: paymentNotes,
        payMode: 'cash',
        operatorId,
        operatorPassword,
        createReceipt: false,
      });
      setPaymentTarget(null);
      await loadRecords(appliedRange, showAll);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Unable to save payment.');
    } finally {
      setSaving(false);
    }
  }

  function categoryTotal(category: ExpenseCategory): number {
    return records
      .filter((record) => recordMatchesCategory(record, category))
      .reduce((total, record) => total + Math.max(0, record.rest), 0);
  }

  function renderCategory(category: ExpenseCategory) {
    const children = category.children ?? [];
    const expanded = expandedIds.has(category.id);
    const amount = categoryTotal(category);
    const isSelected = selectedCategoryId === category.id;

    return (
      <div key={category.id} className="bg-[#f2f2f2]">
        <div className="grid grid-cols-[1fr_5rem] items-center gap-2 border-b border-[#d7d7d7] bg-[#efefef] px-3 py-2 text-[#1d594f]">
          <div className="flex min-w-0 items-center gap-2">
            {children.length > 0 ? (
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                aria-label={expanded ? `Collapse ${category.name}` : `Expand ${category.name}`}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#0d4f47] hover:bg-[#dfeae8]"
              >
                {expanded ? '−' : '+'}
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}
            {children.length === 0 && (
              <input
                type="radio"
                name="expense-category"
                checked={isSelected}
                onChange={() => setSelectedCategoryId(category.id)}
                aria-label={`Select ${category.name}`}
              />
            )}
            <span className="truncate text-[15px] font-semibold text-[#1b1b1b]">{category.name}</span>
          </div>
          <span className="text-right text-[14px] font-semibold text-[#1b1b1b]">{formatAmount(amount)}</span>
        </div>
        {expanded && children.map((child) => (
          <label
            key={child.id}
            className={`grid cursor-pointer grid-cols-[1fr_5rem] items-center gap-2 border-l-2 px-3 py-2 text-sm ${
              selectedCategoryId === child.id
                ? 'border-l-[#0d4f47] bg-[#edf6f5]'
                : 'border-l-transparent bg-white hover:bg-[#edf6f5]'
            }`}
          >
            <span className="flex min-w-0 items-center gap-2 pl-5">
              <input
                type="radio"
                name="expense-category"
                checked={selectedCategoryId === child.id}
                onChange={() => setSelectedCategoryId(child.id)}
              />
              <span className="truncate text-[#212121]">{child.name}</span>
            </span>
            <span className="text-right text-[#212121]">{formatAmount(categoryTotal(child))}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#d9d4cc] p-4 md:p-7">
      <section className="mx-auto max-w-[1120px] overflow-hidden rounded-[10px] border border-[#c8c8c8] bg-[#f1f1f1] shadow-[0_2px_0_rgba(0,0,0,0.06)]">
        <h1 className="flex min-h-[52px] items-center justify-center bg-[#e22424] px-4 py-3 text-center text-[19px] font-semibold text-white">
          Insert a new movement about expenses
        </h1>

        <div className="space-y-4 p-4 md:p-5">
          <div className="flex min-h-[96px] flex-wrap items-center gap-3 rounded-md border border-[#d6d6d6] bg-[#f4f4f4] p-3">
            <div className="flex h-[72px] w-[72px] shrink-0 flex-col items-center justify-center rounded-full border border-[#d0d0d0] bg-[#d7d7d7] text-[#707070]">
              <div className="mb-1 h-8 w-8 rounded-full bg-[#b8b8b8]" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em]">User</span>
            </div>

            <div className="flex min-w-[180px] flex-col text-[13px]">
              <span className="mb-1 font-semibold text-[#2d2d2d]">Operator</span>
              <select
                value={operatorId}
                onChange={(event) => setOperatorId(event.target.value)}
                className="h-9 min-w-[190px] rounded border border-[#b9b9b9] bg-white px-2.5 text-gray-900 focus:border-[#2d7c73] focus:outline-none focus:ring-1 focus:ring-[#2d7c73]"
              >
                <option value="">Select operator</option>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>{operator.name}</option>
                ))}
              </select>
            </div>

            <input
              type="password"
              value={operatorPassword}
              onChange={(event) => setOperatorPassword(event.target.value)}
              aria-label="Operator password"
              autoComplete="current-password"
              placeholder="Password"
              className="mt-5 h-9 w-[180px] rounded border border-[#b9b9b9] bg-white px-2.5 text-gray-900 placeholder:text-gray-500 focus:border-[#2d7c73] focus:outline-none focus:ring-1 focus:ring-[#2d7c73]"
            />

            <button
              type="button"
              className="mt-5 h-9 rounded border border-[#8b8b8b] bg-[#f3f3f3] px-4 text-[13px] font-semibold text-[#2c2c2c] shadow-sm hover:bg-[#e8e8e8]"
            >
              Unlock
            </button>
          </div>

          <form onSubmit={applyRange} className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-md border border-[#d6d6d6] bg-[#f4f4f4] px-4 py-3">
            <span className="flex h-9 items-center gap-2 text-[13px] font-semibold text-[#0d3d39]">
              <CalendarDays aria-hidden="true" className="h-4 w-4" /> Range
            </span>
            <label className="flex flex-col text-[12px] font-semibold text-[#1f1f1f]">
              <span className="mb-1">From</span>
              <input
                type="date"
                value={rangeDraft.fromDate}
                onChange={(event) => setRangeDraft((current) => ({ ...current, fromDate: event.target.value }))}
                className="h-9 w-[160px] rounded border border-[#b9b9b9] bg-white px-2.5 text-[13px] font-normal text-gray-900 focus:border-[#2d7c73] focus:outline-none focus:ring-1 focus:ring-[#2d7c73]"
              />
            </label>
            <label className="flex flex-col text-[12px] font-semibold text-[#1f1f1f]">
              <span className="mb-1">To</span>
              <input
                type="date"
                value={rangeDraft.toDate}
                onChange={(event) => setRangeDraft((current) => ({ ...current, toDate: event.target.value }))}
                className="h-9 w-[160px] rounded border border-[#b9b9b9] bg-white px-2.5 text-[13px] font-normal text-gray-900 focus:border-[#2d7c73] focus:outline-none focus:ring-1 focus:ring-[#2d7c73]"
              />
            </label>
            <button type="submit" className="h-9 min-w-[80px] rounded border border-[#7a7a7a] bg-[#d6d6d6] px-4 text-[13px] font-semibold text-[#2a2a2a] hover:bg-[#bebebe]">
              Apply
            </button>
            <button type="button" onClick={resetFilters} className="h-9 min-w-[80px] rounded border border-[#8b8b8b] bg-[#f3f3f3] px-4 text-[13px] font-semibold text-[#2a2a2a] hover:bg-[#e6e6e6]">
              Reset
            </button>
          </form>

          {error && <p role="alert" className="mb-2 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="overflow-hidden rounded-md border border-[#d0d0d0] bg-[#efefef]">
            <div className="flex min-h-[46px] items-center justify-between gap-3 border-b border-[#d0d0d0] bg-[#e6e6e6] px-3 text-[15px] font-semibold text-[#1c1c1c]">
              <span>List of expenses</span>
              <div className="flex items-center gap-4 text-[#1c1c1c]">
                <label className="inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] font-normal">
                  <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
                  Show all expenses
                </label>
                <button
                  type="button"
                  aria-label={expandedIds.size === allCategoryIds.length ? 'Collapse all expenses' : 'Expand all expenses'}
                  title={expandedIds.size === allCategoryIds.length ? 'Collapse all' : 'Expand all'}
                  onClick={() => setExpandedIds(
                    expandedIds.size === allCategoryIds.length ? new Set() : new Set(allCategoryIds)
                  )}
                  className="flex h-8 w-8 items-center justify-center rounded border border-[#c6c6c6] bg-white text-[#2a2a2a] hover:bg-[#f0f0f0]"
                >
                  {expandedIds.size === allCategoryIds.length
                    ? <ChevronUp className="h-4 w-4" />
                    : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-[1fr_90px] border-b border-[#d0d0d0] bg-[#f0f0f0] px-3 py-2 text-[15px] font-semibold text-[#1b1b1b]">
              <span>Total</span>
              <span className="text-right">{formatAmount(totalRest)}</span>
            </div>
            {loading ? (
              <div className="flex min-h-28 items-center justify-center text-sm text-gray-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading planned expenses
              </div>
            ) : categories.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500">No expense categories found.</div>
            ) : (
              <div className="divide-y divide-[#d8d8d8]">{categories.map(renderCategory)}</div>
            )}
          </div>

          {selectedCategory && (
            <section className="overflow-hidden rounded-md border border-[#d0d0d0] bg-[#e5e7e5]">
              <div className="flex items-center justify-between gap-2 bg-[#b4d5eb] px-4 py-3 text-[#1b1b1b]">
                <h2 className="text-[16px] font-bold">Expenses to pay / paid about {selectedCategory.name}</h2>
                <button type="button" className="rounded border border-[#a8a8a8] bg-[#f3f3f3] px-3 py-1 text-[13px] font-semibold text-[#2c2c2c] hover:bg-[#eaeaea]">
                  + Add new
                </button>
              </div>

              <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] gap-x-2 border-b border-[#d0d0d0] bg-[#b4d5eb] px-4 py-3 text-[13px] font-semibold text-[#1b1b1b]">
                <span>Totals</span>
                <span>OUT</span>
                <span className="text-right">478.00</span>
                <span className="text-right">0.00</span>
                <span className="text-right">478.00</span>
                <span />
              </div>

              <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] gap-x-2 bg-[#d7e7f3] px-4 py-2 text-[13px] font-semibold text-[#1b1b1b]">
                <span>IN</span>
                <span>10.00</span>
                <span>3.00</span>
                <span>7.00</span>
                <span />
                <span />
              </div>

              {selectedRecords.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-gray-500">No planned expenses for this category in the selected date range.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] border-collapse text-left text-[13px]">
                    <thead className="bg-[#b4d5eb] text-[#1d1d1d]">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Date</th>
                        <th className="px-3 py-2 font-semibold">List of Expenses</th>
                        <th className="px-3 py-2 font-semibold">Cost</th>
                        <th className="px-3 py-2 font-semibold">Paid</th>
                        <th className="px-3 py-2 font-semibold">Rest</th>
                        <th className="px-3 py-2 font-semibold">Type</th>
                        <th className="px-3 py-2 font-semibold">Last Casual</th>
                        <th className="px-3 py-2 font-semibold text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecords.map((record) => (
                        <tr key={record.id} className="border-t border-[#d4d4d4] bg-[#dfe8d4]">
                          <td className="px-3 py-2">{record.expireDate || record.recordDate}</td>
                          <td className="px-3 py-2">{record.primaryLabel}</td>
                          <td className="px-3 py-2">{formatAmount(record.value)}</td>
                          <td className="px-3 py-2">{formatAmount(record.pay)}</td>
                          <td className="px-3 py-2">{formatAmount(record.rest)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex min-w-[42px] justify-center rounded-sm px-2 py-1 text-[11px] font-bold uppercase ${record.pay >= record.value ? 'bg-[#3fa64f] text-white' : 'bg-[#db4e4e] text-white'}`}>
                              {record.pay >= record.value ? 'IN' : 'OUT'}
                            </span>
                          </td>
                          <td className="px-3 py-2">{record.subtype || 'd'}</td>
                          <td className="px-3 py-2 text-center">
                            <button type="button" onClick={() => openPayment(record)} className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#b9b9b9] bg-white text-[#4b4b4b] hover:bg-[#f4f4f4]">
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>
                            </button>
                            <button type="button" className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded border border-[#b9b9b9] bg-white text-[#4b4b4b] hover:bg-[#f4f4f4]">
                              <X className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </section>

      <div className="mx-auto mt-5 max-w-[1120px] rounded-t-[8px] border border-[#d7d7d7] bg-[#e7d7a7] px-5 py-4 text-center shadow-sm">
        <div className="text-[19px] font-bold text-[#1f1f1f]">Payment of the expenses selected</div>
        <div className="mt-2 text-[14px] text-[#2a2a2a]">2026-09-05 test 10.00 3.00 7.00 d</div>
      </div>

      {paymentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="planned-payment-title">
          <form onSubmit={savePayment} className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 bg-teal-800 px-4 py-3 text-white">
              <div>
                <h2 id="planned-payment-title" className="font-semibold">Payment of planned expense</h2>
                <p className="mt-0.5 text-sm text-teal-100">{paymentTarget.memberName} · {paymentTarget.primaryLabel}</p>
              </div>
              <button type="button" onClick={() => setPaymentTarget(null)} aria-label="Close" className="rounded p-1 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-4 py-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Payment amount</span>
                <input type="number" min="0.01" max={paymentTarget.rest} step="0.01" required value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} className="h-9 w-full rounded border border-gray-300 px-3" />
                <span className="mt-1 block text-xs text-gray-500">Remaining: {formatAmount(paymentTarget.rest)}</span>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Payment date</span>
                <input type="date" required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="h-9 w-full rounded border border-gray-300 px-3" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Notes</span>
                <input type="text" value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} className="h-9 w-full rounded border border-gray-300 px-3" />
              </label>
              {paymentError && <p role="alert" className="text-sm text-red-600">{paymentError}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
              <button type="button" onClick={() => setPaymentTarget(null)} className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded border border-teal-900 bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save payment
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}