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
      setCategories(nextCategories);
      setOperators(formOptions.operators ?? []);
      setOperatorId((current) =>
        current || formOptions.currentOperatorId || formOptions.operators[0]?.id || ''
      );
      setRecords(
        deadlineRecords.map((record) => ({
          ...record,
          categoryId: findCategoryId(record, nextCategories),
        }))
      );
      setExpandedIds((current) => current.size ? current : new Set(nextCategories.map((category) => category.id)));
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
    return (
      <div key={category.id}>
        <div className="grid grid-cols-[1fr_5rem] items-center gap-2 border-b border-gray-200 bg-gray-100 px-3 py-2 text-teal-900">
          <div className="flex min-w-0 items-center gap-2">
            {children.length > 0 ? (
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                aria-label={expanded ? `Collapse ${category.name}` : `Expand ${category.name}`}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-teal-800 hover:bg-teal-100"
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
                checked={selectedCategoryId === category.id}
                onChange={() => setSelectedCategoryId(category.id)}
                aria-label={`Select ${category.name}`}
              />
            )}
              <span className="truncate font-semibold">{category.name}</span>
          </div>
          <span className="text-right">{formatAmount(categoryTotal(category))}</span>
        </div>
        {expanded && children.map((child) => (
          <label
            key={child.id}
            className={`grid cursor-pointer grid-cols-[1fr_5rem] items-center gap-2 border-l-2 px-3 py-2 text-sm ${
              selectedCategoryId === child.id
                ? 'border-l-teal-800 bg-teal-50'
                : 'border-l-transparent bg-white hover:bg-teal-50'
            }`}
          >
            <span className="flex min-w-0 items-center gap-2 pl-5">
              <input
                type="radio"
                name="expense-category"
                checked={selectedCategoryId === child.id}
                onChange={() => setSelectedCategoryId(child.id)}
              />
              <span className="truncate">{child.name}</span>
            </span>
            <span className="text-right text-gray-700">{formatAmount(categoryTotal(child))}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 text-gray-800">
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <h1 className="flex min-h-11 items-center bg-teal-800 px-4 py-3 text-lg font-semibold text-white">
          Insert a new movement about expenses
        </h1>

        <div className="space-y-3 p-4">
          <div className="flex min-h-[92px] flex-wrap items-center gap-3 rounded-md border border-teal-800/20 bg-[#eef6f5] p-3">
            <div className="flex h-[76px] w-[92px] shrink-0 flex-col items-center justify-center rounded border border-gray-200 bg-white text-gray-400">
              <span className="text-3xl font-bold leading-none">NO</span>
              <span className="text-[9px] font-bold tracking-[0.2em]">IMAGE</span>
              <span className="text-[8px]">AVAILABLE</span>
            </div>
            <label className="flex min-w-[180px] flex-col text-[13px]">
              <span className="mb-1 font-semibold text-gray-800">Operator</span>
              <select
                value={operatorId}
                onChange={(event) => setOperatorId(event.target.value)}
                className="h-9 rounded border border-gray-400 bg-white px-2.5 text-gray-900 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
              >
                <option value="">Select operator</option>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>{operator.name}</option>
                ))}
              </select>
            </label>
            <input
              type="password"
              value={operatorPassword}
              onChange={(event) => setOperatorPassword(event.target.value)}
              aria-label="Operator password"
              autoComplete="current-password"
              className="mt-5 h-9 w-52 rounded border border-gray-400 bg-white px-2.5 text-gray-900 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
          </div>

          <form onSubmit={applyRange} className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-md border border-teal-800/20 bg-[#eef6f5] px-4 py-3">
            <span className="flex h-9 items-center gap-2 text-[13px] font-semibold text-teal-900"><CalendarDays aria-hidden="true" className="h-5 w-5" /> Range</span>
            <label className="flex flex-col text-[12px] font-semibold text-gray-800">
              <span className="mb-1">From</span>
              <input
                type="date"
                value={rangeDraft.fromDate}
                onChange={(event) => setRangeDraft((current) => ({ ...current, fromDate: event.target.value }))}
                className="h-9 w-48 rounded border border-gray-400 bg-white px-2.5 text-[13px] font-normal text-gray-900 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </label>
            <label className="flex flex-col text-[12px] font-semibold text-gray-800">
              <span className="mb-1">To</span>
              <input
                type="date"
                value={rangeDraft.toDate}
                onChange={(event) => setRangeDraft((current) => ({ ...current, toDate: event.target.value }))}
                className="h-9 w-48 rounded border border-gray-400 bg-white px-2.5 text-[13px] font-normal text-gray-900 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </label>
            <button type="submit" className="h-9 min-w-28 rounded border border-teal-900 bg-teal-800 px-4 text-[13px] font-semibold text-white hover:bg-teal-900">
              Apply
            </button>
            <button type="button" onClick={resetFilters} className="h-9 min-w-28 rounded border border-gray-400 bg-white px-4 text-[13px] font-semibold text-gray-800 hover:bg-gray-100">
              Rest
            </button>
          </form>

          {error && <p role="alert" className="mb-2 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="overflow-hidden rounded-md border border-gray-200">
            <div className="flex min-h-10 items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-900">
              <span>List of expenses</span>
              <div className="flex items-center gap-4 text-gray-800">
                <label className="inline-flex items-center gap-1.5 whitespace-nowrap font-normal">
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
                  className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                >
                  {expandedIds.size === allCategoryIds.length
                    ? <ChevronUp className="h-4 w-4" />
                    : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-[1fr_5rem] border-b border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700">
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
              <div className="divide-y divide-gray-100">{categories.map(renderCategory)}</div>
            )}
          </div>

          {selectedCategory && (
            <section className="mt-4 overflow-hidden rounded-lg border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-teal-800 px-4 py-3 text-white">
                <h2 className="text-sm font-semibold">Planned payments · {selectedCategory.name}</h2>
                <span className="text-sm">Remaining: {formatAmount(selectedRecords.reduce((sum, record) => sum + Math.max(0, record.rest), 0))}</span>
              </div>
              {selectedRecords.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-gray-500">No planned expenses for this category in the selected date range.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                    <thead className="bg-teal-800 text-xs uppercase text-white">
                      <tr>
                        <th className="px-3 py-2">Member</th>
                        <th className="px-3 py-2">Expense</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Planned</th>
                        <th className="px-3 py-2">Paid</th>
                        <th className="px-3 py-2">Rest</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedRecords.map((record) => (
                        <tr key={record.id} className="border-t border-gray-200 hover:bg-teal-50">
                          <td className="px-3 py-2">{record.memberName}</td>
                          <td className="px-3 py-2">{record.primaryLabel}</td>
                          <td className="px-3 py-2">{record.expireDate || record.recordDate}</td>
                          <td className="px-3 py-2">{formatAmount(record.value)}</td>
                          <td className="px-3 py-2">{formatAmount(record.pay)}</td>
                          <td className="px-3 py-2">{formatAmount(record.rest)}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              disabled={record.rest <= 0}
                              onClick={() => openPayment(record)}
                              className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-semibold hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Pay
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