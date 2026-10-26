"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Loader2,
  X,
} from "lucide-react";
import { clubApiFetch } from "@/lib/club/servicePurchasesClient";
import { resolvePublicImageUrl } from "@/lib/profileImageUrl";
import {
  createProcedureClient,
  type ProcedureRecordView,
} from "@/lib/club/procedureClient";
import { PROCEDURE_TYPE_CODES } from "@/lib/procedures/types";
import { ExpenseCategoryIcon } from "@/components/club/expenses/ExpenseCategoryIcon";

type ExpenseCategory = {
  id: string;
  name: string;
  parentId: string;
  icon?: string | null;
  children: ExpenseCategory[];
};

type ExpenseFormOptions = {
  operators: { id: string; name: string; image?: string | null }[];
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
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultDateRange(): DateRange {
  const today = new Date();
  const from = new Date(today);
  const to = new Date(today);
  from.setDate(today.getDate() - 30);
  to.setDate(today.getDate() + 30);
  return {
    fromDate: toDateInput(from),
    toDate: toDateInput(to),
  };
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    value,
  );
}

function flattenCategories(categories: ExpenseCategory[]): ExpenseCategory[] {
  return categories.flatMap((category) => [
    category,
    ...flattenCategories(category.children ?? []),
  ]);
}

function findCategoryId(
  record: ProcedureRecordView,
  categories: ExpenseCategory[],
): string | null {
  const flat = flattenCategories(categories);
  if (
    record.expenseId &&
    flat.some((category) => category.id === record.expenseId)
  ) {
    return record.expenseId;
  }

  const expenseName = record.primaryLabel.trim().toLocaleLowerCase();
  return (
    flat.find(
      (category) => category.name.trim().toLocaleLowerCase() === expenseName,
    )?.id ?? null
  );
}

function recordMatchesCategory(
  record: CategorizedRecord,
  category: ExpenseCategory,
): boolean {
  if (record.categoryId === category.id) return true;
  return flattenCategories(category.children ?? []).some(
    (child) => child.id === record.categoryId,
  );
}

async function fetchAllExpenseDeadlines(
  range: DateRange,
  showAll: boolean,
): Promise<ProcedureRecordView[]> {
  const firstPage = await procedureClient.fetchDeadlines({
    page: 1,
    pageSize: PAGE_SIZE,
    includePaid: showAll,
    fromDate: range.fromDate || undefined,
    toDate: range.toDate || undefined,
    orderBy: "old",
  });
  const records = [...firstPage.items];

  for (let page = 2; records.length < firstPage.total; page += 1) {
    const result = await procedureClient.fetchDeadlines({
      page,
      pageSize: PAGE_SIZE,
      includePaid: showAll,
      fromDate: range.fromDate || undefined,
      toDate: range.toDate || undefined,
      orderBy: "old",
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
  const [operators, setOperators] = useState<ExpenseFormOptions["operators"]>(
    [],
  );
  const [operatorId, setOperatorId] = useState("");
  const [operatorPassword, setOperatorPassword] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [editTarget, setEditTarget] = useState<CategorizedRecord | null>(null);
  const [amountToDo, setAmountToDo] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [paymentTarget, setPaymentTarget] = useState<CategorizedRecord | null>(
    null,
  );
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editError, setEditError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const selectedOperator = operators.find(
    (operator) => operator.id === operatorId,
  );
  const operatorImageUrl = resolvePublicImageUrl(selectedOperator?.image);

  const loadRecords = useCallback(
    async (range: DateRange, includeAll: boolean) => {
      setLoading(true);
      setError("");
      try {
        const [categoryResponse, formOptions, deadlineRecords] =
          await Promise.all([
            clubApiFetch<{ items: ExpenseCategory[] }>(
              "/api/club/settings/tables/expenses",
            ),
            procedureClient.fetchFormOptions<ExpenseFormOptions>(),
            fetchAllExpenseDeadlines(range, includeAll),
          ]);
        const nextCategories = Array.isArray(categoryResponse.items)
          ? categoryResponse.items
          : [];
        const mappedRecords = deadlineRecords.map((record) => ({
          ...record,
          categoryId: findCategoryId(record, nextCategories),
        }));

        setCategories(nextCategories);
        setOperators(formOptions.operators ?? []);
        setOperatorId(
          (current) =>
            current ||
            formOptions.currentOperatorId ||
            formOptions.operators[0]?.id ||
            "",
        );
        setRecords(mappedRecords);
        setSelectedCategoryId(
          (current) => current ?? nextCategories[0]?.id ?? null,
        );
        setExpandedIds((current) =>
          current.size
            ? current
            : new Set(nextCategories.map((category) => category.id)),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load planned expenses.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadRecords(appliedRange, showAll);
  }, [appliedRange, loadRecords, showAll]);

  const allCategoryIds = useMemo(
    () => flattenCategories(categories).map((category) => category.id),
    [categories],
  );
  const selectedCategory = useMemo(
    () =>
      flattenCategories(categories).find(
        (category) => category.id === selectedCategoryId,
      ) ?? null,
    [categories, selectedCategoryId],
  );
  const categoryIcons = useMemo(
    () =>
      new Map(
        flattenCategories(categories).map((category) => [
          category.id,
          category.icon ?? null,
        ]),
      ),
    [categories],
  );
  const visibleRecords = useMemo(
    () =>
      records.filter((record) => {
        const inRange =
          (!appliedRange.fromDate ||
            record.recordDate >= appliedRange.fromDate) &&
          (!appliedRange.toDate || record.recordDate <= appliedRange.toDate);
        return inRange && (showAll ? record.rest >= 0 : record.rest > 0);
      }),
    [records, appliedRange, showAll],
  );
  const selectedRecords = useMemo(
    () =>
      selectedCategory
        ? visibleRecords.filter(
            (record) => record.categoryId === selectedCategory.id,
          )
        : [],
    [visibleRecords, selectedCategory],
  );
  const today = toDateInput(new Date());
  const selectedTotals = useMemo(() => {
    const sumRows = (rows: CategorizedRecord[]) =>
      rows.reduce(
        (totals, record) => ({
          cost: totals.cost + record.value,
          paid: totals.paid + record.pay,
          rest: totals.rest + Math.max(0, record.rest),
          expiredRest:
            totals.expiredRest +
            (record.expireDate && record.expireDate <= today
              ? Math.max(0, record.rest)
              : 0),
        }),
        { cost: 0, paid: 0, rest: 0, expiredRest: 0 },
      );

    return {
      out: sumRows(selectedRecords.filter((record) => record.rest > 0)),
      in: sumRows(
        selectedRecords.filter((record) => record.pay >= record.value),
      ),
    };
  }, [selectedRecords, today]);
  const totalRest = visibleRecords.reduce(
    (total, record) => total + Math.max(0, record.rest),
    0,
  );
  const expiredRest = visibleRecords.reduce(
    (total, record) =>
      record.expireDate && record.expireDate <= today
        ? total + Math.max(0, record.rest)
        : total,
    0,
  );
  const selectedSummary = useMemo(() => {
    if (!selectedCategory) return null;
    const rows = selectedRecords;
    if (rows.length === 0) return null;

    const totalCost = rows.reduce(
      (sum, row) => sum + Number(row.value || 0),
      0,
    );
    const totalPaid = rows.reduce((sum, row) => sum + Number(row.pay || 0), 0);
    const totalRestValue = rows.reduce(
      (sum, row) => sum + Math.max(0, Number(row.rest || 0)),
      0,
    );
    const lastRow = rows[rows.length - 1];

    return {
      totalCost,
      totalPaid,
      totalRestValue,
      lastDate: lastRow?.expireDate || lastRow?.recordDate || "",
      lastLabel: lastRow?.primaryLabel || "",
      lastCasual: lastRow?.lastPaymentDate || lastRow?.operatorName || "",
    };
  }, [selectedCategory, selectedRecords]);

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
    if (
      rangeDraft.fromDate &&
      rangeDraft.toDate &&
      rangeDraft.fromDate > rangeDraft.toDate
    ) {
      setError("The start date cannot be after the end date.");
      return;
    }
    setAppliedRange({ ...rangeDraft });
    setSelectedCategoryId(null);
    setPaymentTarget(null);
  }

  function resetFilters() {
    const nextDefault = getDefaultDateRange();
    setRangeDraft(nextDefault);
    setAppliedRange(nextDefault);
    setShowAll(false);
    setSelectedCategoryId(null);
    setPaymentTarget(null);
    setError("");
  }

  function openExpenseEdit(record: CategorizedRecord) {
    setEditTarget(record);
    setAmountToDo(record.value.toFixed(2));
    setExpirationDate(record.expireDate || "");
    setEditNotes(record.notes);
    setEditError("");
  }

  async function saveExpenseEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) return;
    if (editTarget.rest <= 0)
      return setEditError("A fully paid expense cannot be edited.");
    const amount = Number(amountToDo);
    if (!operatorId) return setEditError("Select an operator.");
    if (!Number.isFinite(amount) || amount < editTarget.pay) {
      return setEditError(
        `Payment to do cannot be less than already paid (${formatAmount(editTarget.pay)}).`,
      );
    }

    setSaving(true);
    setEditError("");
    try {
      await procedureClient.updateRecord(editTarget.id, {
        totalAmount: amount,
        dueDate: expirationDate || null,
        notes: editNotes,
        operatorId,
      });
      setEditTarget(null);
      await loadRecords(appliedRange, showAll);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Unable to save expense changes.",
      );
    } finally {
      setSaving(false);
    }
  }

  function selectExpenseForPayment(record: CategorizedRecord) {
    setPaymentTarget((current) => (current?.id === record.id ? null : record));
    setPaymentAmount(record.rest.toFixed(2));
    setPaymentNotes("");
    setPaymentError("");
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentTarget) return;
    const amount = Number(paymentAmount);
    if (!operatorId) return setPaymentError("Select an operator.");
    if (!operatorPassword.trim())
      return setPaymentError(
        "Enter the operator password in the Operator section.",
      );
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > paymentTarget.rest
    ) {
      return setPaymentError(
        `Enter an amount greater than zero and no more than the remaining ${formatAmount(paymentTarget.rest)}.`,
      );
    }

    setSaving(true);
    setPaymentError("");
    try {
      await procedureClient.addPayment(paymentTarget.id, {
        amountPaid: amount,
        paymentDate: toDateInput(new Date()),
        notes: paymentNotes,
        payMode: "cash",
        operatorId,
        operatorPassword,
        createReceipt: false,
      });
      setPaymentTarget(null);
      await loadRecords(appliedRange, showAll);
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : "Unable to save payment.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(record: CategorizedRecord) {
    if (record.pay > 0 && record.rest > 0) {
      window.alert("Deletion is not possible, expense in pending");
      return;
    }
    if (!operatorPassword.trim()) {
      window.alert("Enter the operator password in the Operator section.");
      return;
    }
    if (!window.confirm(`Delete the expense "${record.primaryLabel}"?`)) return;

    setSaving(true);
    setError("");
    try {
      await procedureClient.deleteRecord(record.id, operatorPassword);
      setPaymentTarget((current) =>
        current?.id === record.id ? null : current,
      );
      await loadRecords(appliedRange, showAll);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete expense.",
      );
    } finally {
      setSaving(false);
    }
  }

  function categoryTotal(category: ExpenseCategory): number {
    return visibleRecords
      .filter((record) => recordMatchesCategory(record, category))
      .reduce((total, record) => total + Math.max(0, record.rest), 0);
  }

  function categoryExpiredRest(category: ExpenseCategory): number {
    return visibleRecords
      .filter(
        (record) =>
          recordMatchesCategory(record, category) &&
          record.expireDate &&
          record.expireDate <= today,
      )
      .reduce((total, record) => total + Math.max(0, record.rest), 0);
  }

  function renderCategory(category: ExpenseCategory) {
    const children = category.children ?? [];
    const expanded = expandedIds.has(category.id);
    const amount = categoryTotal(category);
    const isSelected = selectedCategoryId === category.id;

    return (
      <div key={category.id} className="bg-white">
        <div className="grid grid-cols-[1fr_5rem] items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-teal-900">
          <div className="flex min-w-0 items-center gap-2">
            {children.length > 0 ? (
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                aria-label={
                  expanded
                    ? `Collapse ${category.name}`
                    : `Expand ${category.name}`
                }
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-teal-800 hover:bg-teal-100"
              >
                {expanded ? "−" : "+"}
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}
            {children.length === 0 && (
              <input
                type="radio"
                name="expense-category"
                checked={isSelected}
                onChange={() => {
                  setSelectedCategoryId(category.id);
                  setPaymentTarget(null);
                }}
                aria-label={`Select ${category.name}`}
              />
            )}
            <ExpenseCategoryIcon
              name={category.icon}
              className="h-4 w-4 shrink-0 text-teal-700"
            />
            <span
              className={`truncate text-[15px] font-semibold ${isSelected ? "text-red-700" : "text-[#1b1b1b]"}`}
            >
              {category.name}
            </span>
          </div>
          <span className="text-right text-[14px] font-semibold text-[#1b1b1b]">
            {formatAmount(amount)} /{" "}
            <span className="text-red-700">
              {formatAmount(categoryExpiredRest(category))}
            </span>
          </span>
        </div>
        {expanded &&
          children.map((child) => (
            <label
              key={child.id}
              className={`grid cursor-pointer grid-cols-[1fr_5rem] items-center gap-2 border-l-2 px-3 py-2 text-sm ${
                selectedCategoryId === child.id
                  ? "border-l-teal-800 bg-teal-50"
                  : "border-l-transparent bg-white hover:bg-teal-50"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2 pl-5">
                <input
                  type="radio"
                  name="expense-category"
                  checked={selectedCategoryId === child.id}
                  onChange={() => {
                    setSelectedCategoryId(child.id);
                    setPaymentTarget(null);
                  }}
                />
                <ExpenseCategoryIcon
                  name={child.icon}
                  className="h-4 w-4 shrink-0 text-teal-700"
                />
                <span
                  className={`truncate ${selectedCategoryId === child.id ? "text-red-700" : "text-[#212121]"}`}
                >
                  {child.name}
                </span>
              </span>
              <span className="text-right text-[#212121]">
                {formatAmount(categoryTotal(child))} /{" "}
                <span className="text-red-700">
                  {formatAmount(categoryExpiredRest(child))}
                </span>
              </span>
            </label>
          ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <section className="mx-auto w-full overflow-hidden rounded-lg border border-gray-200 bg-white">
        <h1 className="flex min-h-[52px] items-center bg-teal-800 px-4 py-3 text-lg font-semibold text-white">
          Insert a new movement about expenses
        </h1>

        <div className="space-y-4 p-4">
          <div className="flex min-h-[88px] flex-wrap items-center gap-3 rounded-md border border-teal-800/20 bg-[#eef6f5] p-3">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-teal-800/20 bg-white text-teal-800">
              {operatorImageUrl ? (
                <Image
                  src={operatorImageUrl}
                  alt={selectedOperator?.name ?? "Selected operator"}
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-xs font-semibold">
                  {selectedOperator?.name.slice(0, 1).toUpperCase() ?? "U"}
                </span>
              )}
            </div>

            <div className="flex min-w-[180px] flex-col text-[13px]">
              <span className="mb-1 font-semibold text-gray-800">Operator</span>
              <select
                value={operatorId}
                onChange={(event) => setOperatorId(event.target.value)}
                required
                aria-label="Active operator"
                className="h-9 min-w-[190px] rounded border border-gray-400 bg-white px-2.5 text-gray-900 focus:border-teal-800 focus:outline-none focus:ring-1 focus:ring-teal-800"
              >
                <option value="">Select active operator</option>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.name}
                  </option>
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
              className="mt-5 h-9 w-[180px] rounded border border-gray-400 bg-white px-2.5 text-gray-900 placeholder:text-gray-500 focus:border-teal-800 focus:outline-none focus:ring-1 focus:ring-teal-800"
            />

            <button
              type="button"
              className="mt-5 h-9 rounded border border-teal-900 bg-teal-800 px-4 text-[13px] font-semibold text-white hover:bg-teal-900"
            >
              Unlock
            </button>
          </div>

          <form
            onSubmit={applyRange}
            className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-md border border-teal-800/20 bg-[#eef6f5] px-4 py-3"
          >
            <span className="flex h-9 items-center gap-2 text-[13px] font-semibold text-teal-900">
              <CalendarDays aria-hidden="true" className="h-4 w-4" /> Range
            </span>
            <label className="flex flex-col text-[12px] font-semibold text-gray-800">
              <span className="mb-1">From</span>
              <input
                type="date"
                value={rangeDraft.fromDate}
                onChange={(event) =>
                  setRangeDraft((current) => ({
                    ...current,
                    fromDate: event.target.value,
                  }))
                }
                className="h-9 w-[160px] rounded border border-gray-400 bg-white px-2.5 text-[13px] font-normal text-gray-900 focus:border-teal-800 focus:outline-none focus:ring-1 focus:ring-teal-800"
              />
            </label>
            <label className="flex flex-col text-[12px] font-semibold text-gray-800">
              <span className="mb-1">To</span>
              <input
                type="date"
                value={rangeDraft.toDate}
                onChange={(event) =>
                  setRangeDraft((current) => ({
                    ...current,
                    toDate: event.target.value,
                  }))
                }
                className="h-9 w-[160px] rounded border border-gray-400 bg-white px-2.5 text-[13px] font-normal text-gray-900 focus:border-teal-800 focus:outline-none focus:ring-1 focus:ring-teal-800"
              />
            </label>
            <button
              type="submit"
              className="h-9 min-w-[80px] rounded border border-teal-900 bg-teal-800 px-4 text-[13px] font-semibold text-white hover:bg-teal-900"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="h-9 min-w-[80px] rounded border border-gray-400 bg-white px-4 text-[13px] font-semibold text-gray-800 hover:bg-gray-100"
            >
              Reset
            </button>
          </form>

          {error && (
            <p
              role="alert"
              className="mb-2 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
            <div className="flex min-h-[46px] items-center justify-between gap-3 border-b border-gray-200 bg-gray-100 px-3 text-[15px] font-semibold text-gray-900">
              <span>List of expenses</span>
              <div className="flex items-center gap-4 text-gray-800">
                <label className="inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] font-normal">
                  <input
                    type="checkbox"
                    checked={showAll}
                    onChange={(event) => setShowAll(event.target.checked)}
                  />
                  Show all expenses
                </label>
                <button
                  type="button"
                  aria-label={
                    expandedIds.size === allCategoryIds.length
                      ? "Collapse all expenses"
                      : "Expand all expenses"
                  }
                  title={
                    expandedIds.size === allCategoryIds.length
                      ? "Collapse all"
                      : "Expand all"
                  }
                  onClick={() =>
                    setExpandedIds(
                      expandedIds.size === allCategoryIds.length
                        ? new Set()
                        : new Set(allCategoryIds),
                    )
                  }
                  className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 hover:bg-teal-50"
                >
                  {expandedIds.size === allCategoryIds.length ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-[1fr_90px] border-b border-gray-200 bg-white px-3 py-2 text-[15px] font-semibold text-gray-900">
              <span>Total</span>
              <span className="text-right">
                {formatAmount(totalRest)} /{" "}
                <span className="text-red-700">
                  {formatAmount(expiredRest)}
                </span>
              </span>
            </div>
            {loading ? (
              <div className="flex min-h-28 items-center justify-center text-sm text-gray-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
                planned expenses
              </div>
            ) : categories.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500">
                No expense categories found.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {categories.map(renderCategory)}
              </div>
            )}
          </div>

          {selectedCategory && (
            <section className="overflow-hidden rounded-md border border-gray-200 bg-white">
              <div className="flex items-center justify-between gap-2 bg-[#eef6f5] px-4 py-3 text-teal-950">
                <h2 className="text-[16px] font-bold">
                  Expenses to pay / paid about{" "}
                  <span className="text-red-700">{selectedCategory.name}</span>
                </h2>
                <button
                  type="button"
                  className="rounded border border-gray-400 bg-white px-3 py-1 text-[13px] font-semibold text-gray-800 hover:bg-gray-100"
                >
                  + Add new
                </button>
              </div>

              {selectedRecords.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-gray-500">
                  No planned expenses for this category in the selected date
                  range.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] border-collapse text-left text-[13px]">
                    <thead className="bg-teal-800 text-white">
                      <tr className="border-b border-teal-700 bg-teal-100 text-teal-950">
                        <th
                          colSpan={2}
                          className="px-3 py-2 text-left font-semibold"
                        >
                          OUT
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          {formatAmount(selectedTotals.out.cost)}
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          {formatAmount(selectedTotals.out.paid)}
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          {formatAmount(selectedTotals.out.rest)} /{" "}
                          <span className="text-red-700">
                            {formatAmount(selectedTotals.out.expiredRest)}
                          </span>
                        </th>
                        <th colSpan={3} />
                      </tr>
                      <tr className="border-b border-teal-700 bg-teal-50 text-teal-950">
                        <th
                          colSpan={2}
                          className="px-3 py-2 text-left font-semibold"
                        >
                          IN
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          {formatAmount(selectedTotals.in.cost)}
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          {formatAmount(selectedTotals.in.paid)}
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          {formatAmount(selectedTotals.in.rest)} /{" "}
                          <span className="text-red-700">
                            {formatAmount(selectedTotals.in.expiredRest)}
                          </span>
                        </th>
                        <th colSpan={3} />
                      </tr>
                      <tr>
                        <th className="px-3 py-2 font-semibold">Date</th>
                        <th className="px-3 py-2 font-semibold">
                          List of Expenses
                        </th>
                        <th className="px-3 py-2 font-semibold">Cost</th>
                        <th className="px-3 py-2 font-semibold">Paid</th>
                        <th className="px-3 py-2 font-semibold">Rest</th>
                        <th className="px-3 py-2 font-semibold">Type</th>
                        <th className="px-3 py-2 font-semibold">Last Casual</th>
                        <th className="px-3 py-2 font-semibold text-center">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecords.map((record) => (
                        <tr
                          key={record.id}
                          className={`border-t border-gray-200 ${paymentTarget?.id === record.id ? "bg-teal-50" : "bg-white hover:bg-gray-50"}`}
                        >
                          <td className="px-3 py-2">
                            {record.expireDate || record.recordDate}
                          </td>
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-2">
                              <ExpenseCategoryIcon
                                name={
                                  record.categoryId
                                    ? (categoryIcons.get(record.categoryId) ??
                                      null)
                                    : null
                                }
                                className="h-4 w-4 shrink-0 text-teal-700"
                              />
                              <span>{record.primaryLabel}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {formatAmount(record.value)}
                          </td>
                          <td className="px-3 py-2">
                            {formatAmount(record.pay)}
                          </td>
                          <td className="px-3 py-2">
                            {formatAmount(record.rest)}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex min-w-[42px] justify-center rounded-sm px-2 py-1 text-[11px] font-bold uppercase ${record.pay >= record.value ? "bg-[#3fa64f] text-white" : "bg-[#db4e4e] text-white"}`}
                            >
                              {record.pay >= record.value ? "IN" : "OUT"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {record.lastPaymentDate ||
                              record.operatorName ||
                              "—"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => selectExpenseForPayment(record)}
                              aria-label={
                                paymentTarget?.id === record.id
                                  ? "Deselect expense for payment"
                                  : "Select expense for payment"
                              }
                              title={
                                paymentTarget?.id === record.id
                                  ? "Deselect for payment"
                                  : "Select for payment"
                              }
                              className={`inline-flex h-7 w-7 items-center justify-center rounded border ${paymentTarget?.id === record.id ? "border-teal-800 bg-teal-800 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-teal-50"}`}
                            >
                              <CircleDollarSign className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openExpenseEdit(record)}
                              disabled={record.rest <= 0}
                              aria-label="Edit expense"
                              title={
                                record.rest > 0
                                  ? "Edit expense"
                                  : "Fully paid expenses cannot be edited"
                              }
                              className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                              >
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteExpense(record)}
                              disabled={saving}
                              aria-label="Delete expense"
                              title="Delete expense"
                              className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {paymentTarget &&
                selectedRecords.some(
                  (record) => record.id === paymentTarget.id,
                ) && (
                  <form
                    onSubmit={savePayment}
                    className="grid gap-3 border-t border-[#d0d0d0] bg-white px-4 py-4 md:grid-cols-[minmax(170px,1fr)_minmax(220px,2fr)_auto] md:items-start"
                  >
                    <div>
                      <label
                        htmlFor="planned-expense-payment-amount"
                        className="mb-1 block text-sm font-semibold text-[#1b1b1b]"
                      >
                        Payment amount
                      </label>
                      <input
                        id="planned-expense-payment-amount"
                        type="number"
                        min="0.01"
                        max={paymentTarget.rest}
                        step="0.01"
                        required
                        value={paymentAmount}
                        onChange={(event) =>
                          setPaymentAmount(event.target.value)
                        }
                        className="h-9 w-full rounded border border-gray-300 px-3"
                      />
                      <p className="mt-1 text-xs text-gray-600">
                        Remaining: {formatAmount(paymentTarget.rest)}
                      </p>
                    </div>
                    <div>
                      <label
                        htmlFor="planned-expense-payment-notes"
                        className="mb-1 block text-sm font-semibold text-[#1b1b1b]"
                      >
                        Note (optional)
                      </label>
                      <input
                        id="planned-expense-payment-notes"
                        type="text"
                        value={paymentNotes}
                        onChange={(event) =>
                          setPaymentNotes(event.target.value)
                        }
                        className="h-9 w-full rounded border border-gray-300 px-3"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving || !operatorId}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded border border-teal-900 bg-teal-800 px-4 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-60 md:mt-6"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Save payment
                    </button>
                    {paymentError && (
                      <p
                        role="alert"
                        className="text-sm text-red-600 md:col-span-3"
                      >
                        {paymentError}
                      </p>
                    )}
                  </form>
                )}
            </section>
          )}
        </div>
      </section>

      {selectedSummary && (
        <div className="mx-auto mt-4 rounded-md border border-teal-800/20 bg-[#eef6f5] px-5 py-4 text-center">
          <div className="text-lg font-bold text-teal-950">
            Payment of the expenses selected
          </div>
          <div className="mt-2 text-sm text-gray-700">
            {selectedSummary.lastDate} {selectedSummary.lastLabel}{" "}
            {formatAmount(selectedSummary.totalCost)}{" "}
            {formatAmount(selectedSummary.totalPaid)}{" "}
            {formatAmount(selectedSummary.totalRestValue)}{" "}
            {selectedSummary.lastCasual}
          </div>
        </div>
      )}

      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="planned-expense-edit-title"
        >
          <form
            onSubmit={saveExpenseEdit}
            className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-200 bg-teal-800 px-4 py-3 text-white">
              <div>
                <h2 id="planned-expense-edit-title" className="font-semibold">
                  Edit planned expense
                </h2>
                <p className="mt-0.5 text-sm text-teal-100">
                  {editTarget.memberName} · {editTarget.primaryLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                aria-label="Close"
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-4 py-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Payment to do</span>
                <input
                  type="number"
                  min={editTarget.pay}
                  step="0.01"
                  required
                  value={amountToDo}
                  onChange={(event) => setAmountToDo(event.target.value)}
                  className="h-9 w-full rounded border border-gray-300 px-3"
                />
                <span className="mt-1 block text-xs text-gray-500">
                  Already paid: {formatAmount(editTarget.pay)}
                </span>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Date payment</span>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(event) => setExpirationDate(event.target.value)}
                  className="h-9 w-full rounded border border-gray-300 px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Notes</span>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(event) => setEditNotes(event.target.value)}
                  className="h-9 w-full rounded border border-gray-300 px-3"
                />
              </label>
              {editError && (
                <p role="alert" className="text-sm text-red-600">
                  {editError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded border border-teal-900 bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
