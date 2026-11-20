"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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
  color?: string | null;
  children: ExpenseCategory[];
};

type ExpenseFormOptions = {
  operators: { id: string; name: string; image?: string | null }[];
  currentOperatorId: string | null;
  clubMemberId: string;
};

type DateRange = {
  fromDate: string;
  toDate: string;
};

type CategorizedRecord = ProcedureRecordView & {
  categoryId: string | null;
};

const PAGE_SIZE = 100;
const EXPENSE_CHART_COLORS = [
  '#0f766e',
  '#b45309',
  '#2563eb',
  '#be123c',
  '#4d7c0f',
  '#7c3aed',
  '#0e7490',
  '#a16207',
];
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
  const [options, setOptions] = useState<ExpenseFormOptions | null>(null);
  const [operatorId, setOperatorId] = useState('');
  const [operatorPassword, setOperatorPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [showExpiredPending, setShowExpiredPending] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [chartBranchId, setChartBranchId] = useState('all');
  const [chartSubBranchId, setChartSubBranchId] = useState('all');
  const [editTarget, setEditTarget] = useState<CategorizedRecord | null>(null);
  const [amountToDo, setAmountToDo] = useState('');
  const [expenseExpirationDate, setExpenseExpirationDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [newExpenseOpen, setNewExpenseOpen] = useState(false);
  const [newExpenseCategoryId, setNewExpenseCategoryId] = useState('');
  const [newExpenseDirection, setNewExpenseDirection] = useState<'IN' | 'OUT'>(
    'OUT',
  );
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseExpirationDate, setNewExpenseExpirationDate] = useState('');
  const [newExpenseNote, setNewExpenseNote] = useState('');
  const [newExpenseError, setNewExpenseError] = useState('');
  const [paymentTarget, setPaymentTarget] = useState<CategorizedRecord | null>(
    null,
  );
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentMode, setPaymentMode] = useState('cash');
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
        setOptions(formOptions);
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
  const expenseCategories = useMemo(
    () => flattenCategories(categories),
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
  const today = toDateInput(new Date());
  const visibleRecords = useMemo(
    () =>
      records.filter((record) => {
        const inRange =
          (!appliedRange.fromDate ||
            record.recordDate >= appliedRange.fromDate) &&
          (!appliedRange.toDate || record.recordDate <= appliedRange.toDate);
        const isPending = record.rest > 0;
        const isExpired = Boolean(record.expireDate && record.expireDate <= today);
        return (
          inRange &&
          (showExpiredPending
            ? isPending && isExpired
            : showAll
              ? record.rest >= 0
              : isPending)
        );
      }),
    [records, appliedRange, showAll, showExpiredPending, today],
  );
  const selectedRecords = useMemo(
    () =>
      selectedCategory
        ? visibleRecords.filter(
            (record) => recordMatchesCategory(record, selectedCategory),
          )
        : [],
    [visibleRecords, selectedCategory],
  );
  const chartBranch = useMemo(
    () => categories.find((category) => category.id === chartBranchId) ?? null,
    [categories, chartBranchId],
  );
  const chartSubBranches = chartBranch?.children ?? [];
  const expenseChartData = useMemo(() => {
    const subBranch = chartSubBranches.find(
      (category) => category.id === chartSubBranchId,
    );
    let chartCategories: ExpenseCategory[];
    if (subBranch) {
      chartCategories = [subBranch];
    } else if (chartBranch) {
      if (chartBranch.children.length === 0) {
        chartCategories = [chartBranch];
      } else {
        const hasDirectExpenses = visibleRecords.some(
          (record) => record.categoryId === chartBranch.id,
        );
        chartCategories = [
          ...(hasDirectExpenses ? [chartBranch] : []),
          ...chartBranch.children,
        ];
      }
    } else {
      chartCategories = categories;
    }

    return chartCategories.flatMap((category, index) => {
      const isDirectParentSlice =
        chartBranch !== null &&
        chartSubBranchId === 'all' &&
        category.id === chartBranch.id &&
        category.children.length > 0;
      const rows = visibleRecords.filter((record) =>
        isDirectParentSlice
          ? record.categoryId === category.id
          : recordMatchesCategory(record, category),
      );
      if (rows.length === 0) return [];
      return [{
        id: category.id,
        name: category.name,
        icon: category.icon ?? null,
        color: category.color || EXPENSE_CHART_COLORS[index % EXPENSE_CHART_COLORS.length],
        cost: rows.reduce((total, record) => total + Number(record.value || 0), 0),
      }];
    });
  }, [categories, visibleRecords, chartBranch, chartSubBranches, chartSubBranchId]);
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
      out: sumRows(
        selectedRecords.filter(
          (record) => (record.expenseDirection ?? 'OUT') === 'OUT',
        ),
      ),
      in: sumRows(selectedRecords.filter((record) => record.expenseDirection === 'IN')),
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
    const outgoingRows = rows.filter(
      (row) => (row.expenseDirection ?? 'OUT') === 'OUT',
    );
    const incomingRows = rows.filter(
      (row) => row.expenseDirection === 'IN',
    );

    const totalCost = outgoingRows.reduce(
      (sum, row) => sum + Number(row.value || 0),
      0,
    );
    const totalPaid = outgoingRows.reduce(
      (sum, row) => sum + Number(row.pay || 0),
      0,
    );
    const totalRestValue = outgoingRows.reduce(
      (sum, row) => sum + Math.max(0, Number(row.rest || 0)),
      0,
    );
    const lastPaymentDate = outgoingRows.reduce(
      (latest, row) =>
        row.lastPaymentDate && row.lastPaymentDate > latest
          ? row.lastPaymentDate
          : latest,
      '',
    );
    const incomingSummary = incomingRows.length
      ? {
          totalCost: incomingRows.reduce(
            (sum, row) => sum + Number(row.value || 0),
            0,
          ),
          totalPaid: incomingRows.reduce(
            (sum, row) => sum + Number(row.pay || 0),
            0,
          ),
          totalRestValue: incomingRows.reduce(
            (sum, row) => sum + Math.max(0, Number(row.rest || 0)),
            0,
          ),
          lastPaymentDate: incomingRows.reduce(
            (latest, row) =>
              row.lastPaymentDate && row.lastPaymentDate > latest
                ? row.lastPaymentDate
                : latest,
            '',
          ),
        }
      : null;

    return {
      totalCost,
      totalPaid,
      totalRestValue,
      lastPaymentDate,
      incoming: incomingSummary,
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

  async function toggleExpenseLock() {
    if (isUnlocked) {
      setIsUnlocked(false);
      setPaymentTarget(null);
      setEditTarget(null);
      return;
    }
    if (!operatorId) {
      setUnlockError('Select an operator first.');
      return;
    }
    if (!operatorPassword.trim()) {
      setUnlockError("Enter the selected operator's password.");
      return;
    }

    setUnlocking(true);
    setUnlockError('');
    try {
      const result = await clubApiFetch<{ valid: boolean }>(
        '/api/club/procedures/expense/verify-operator-password',
        {
          method: 'POST',
          body: JSON.stringify({ operatorId, password: operatorPassword }),
        },
      );
      if (!result.valid) {
        setIsUnlocked(false);
        setUnlockError('Incorrect operator password.');
        return;
      }
      setIsUnlocked(true);
    } catch (err) {
      setIsUnlocked(false);
      setUnlockError(
        err instanceof Error ? err.message : 'Unable to verify password.',
      );
    } finally {
      setUnlocking(false);
    }
  }

  function openExpenseEdit(record: CategorizedRecord) {
    if (!isUnlocked) return;
    setEditTarget(record);
    setAmountToDo(record.value.toFixed(2));
    setAdminPassword('');
    setExpenseExpirationDate(record.expenseExpirationDate || '');
    setEditNotes(record.notes);
    setEditError('');
  }

  function openAddExpense() {
    if (!isUnlocked) {
      setUnlockError("Unlock expenses before adding an expense.");
      return;
    }
    setNewExpenseCategoryId(
      selectedCategoryId ?? expenseCategories[0]?.id ?? '',
    );
    setNewExpenseDirection('OUT');
    setNewExpenseAmount('');
    setNewExpenseExpirationDate(today);
    setNewExpenseNote('');
    setNewExpenseError('');
    setNewExpenseOpen(true);
  }

  async function saveNewExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isUnlocked)
      return setNewExpenseError("Unlock expenses before adding an expense.");
    const category = expenseCategories.find(
      (item) => item.id === newExpenseCategoryId,
    );
    if (!category) return setNewExpenseError("Select an expense sector.");
    const amount = Number(newExpenseAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return setNewExpenseError("Enter an amount greater than zero.");
    }
    if (!newExpenseExpirationDate) {
      return setNewExpenseError(
        newExpenseDirection === 'IN'
          ? 'Select a date of incoming.'
          : 'Select an expiration date.',
      );
    }
    if (!options?.clubMemberId) {
      return setNewExpenseError("The club account could not be identified.");
    }
    if (!operatorPassword.trim()) {
      return setNewExpenseError('Enter the operator password.');
    }

    setSaving(true);
    setNewExpenseError('');
    try {
      await procedureClient.createRecord({
        memberId: options.clubMemberId,
        totalAmount: amount,
        initialPayment: 0,
        recordDate: today,
        paymentDate: today,
        dueDate: newExpenseExpirationDate,
        notes: newExpenseNote.trim() || null,
        causal: newExpenseNote.trim() || null,
        expenseId: category.id,
        expenseName: category.name,
        expenseDirection: newExpenseDirection,
        operatorId,
        operatorPassword,
      });

      const nextRange = {
        fromDate:
          !appliedRange.fromDate || today < appliedRange.fromDate
            ? today
            : appliedRange.fromDate,
        toDate:
          !appliedRange.toDate || today > appliedRange.toDate
            ? today
            : appliedRange.toDate,
      };
      setRangeDraft(nextRange);
      setAppliedRange(nextRange);
      setSelectedCategoryId(category.id);
      if (category.parentId !== '0') {
        setExpandedIds((current) => new Set(current).add(category.parentId));
      }
      setNewExpenseOpen(false);
      await loadRecords(nextRange, showAll);
    } catch (err) {
      setNewExpenseError(
        err instanceof Error ? err.message : "Unable to save the new expense.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveExpenseEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) return;
    if (!isUnlocked) return setEditError("Unlock expenses before editing.");
    const amount = Number(amountToDo);
    const amountChanged = amount !== editTarget.value;
    const expenseExpirationChanged =
      expenseExpirationDate !== (editTarget.expenseExpirationDate || '');
    const protectedFieldsChanged = amountChanged || expenseExpirationChanged;
    if (protectedFieldsChanged && !adminPassword.trim())
      return setEditError('Enter the Club Admin password to edit the amount or expiration date.');
    if (editTarget.rest <= 0)
      return setEditError("A fully paid expense cannot be edited.");
    if (!operatorId) return setEditError('Select an operator.');
    if (!Number.isFinite(amount) || amount < editTarget.pay) {
      return setEditError(
        `Payment to do cannot be less than already paid (${formatAmount(editTarget.pay)}).`,
      );
    }

    setSaving(true);
    setEditError("");
    try {
      await procedureClient.updateRecord(editTarget.id, {
        ...(amountChanged ? { totalAmount: amount } : {}),
        ...(expenseExpirationChanged
          ? { expenseExpirationDate: expenseExpirationDate || null }
          : {}),
        ...(protectedFieldsChanged ? { adminPassword } : {}),
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
        <div
          onClick={() => {
            setSelectedCategoryId(category.id);
            setPaymentTarget(null);
          }}
          className={`grid cursor-pointer grid-cols-[1fr_5rem] items-center gap-2 border-b border-gray-200 border-l-4 px-3 py-2 text-teal-900 ${isSelected ? "border-l-teal-800 bg-teal-200" : "border-l-transparent bg-gray-50"}`}
        >
          <div className="grid min-w-0 grid-cols-[1.5rem_1.25rem_minmax(0,1fr)] items-center gap-2">
            {children.length > 0 ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleCategory(category.id);
                }}
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
              <span />
            )}
            <input
              type="radio"
              className="justify-self-center"
              name="expense-category"
              checked={isSelected}
              onChange={() => {
                setSelectedCategoryId(category.id);
                setPaymentTarget(null);
              }}
              aria-label={`Select ${category.name}`}
            />
            <span className="flex min-w-0 items-center gap-2">
              <ExpenseCategoryIcon
                name={category.icon}
                className="h-4 w-4 shrink-0 text-teal-700"
              />
              <span
                className={`truncate text-[15px] font-semibold ${isSelected ? "text-red-700" : "text-[#1b1b1b]"}`}
              >
                {category.name}
              </span>
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
              className={`grid cursor-pointer grid-cols-[1.5rem_1.25rem_minmax(0,1fr)_5rem] items-center gap-2 border-l-4 px-3 py-2 text-sm ${
                selectedCategoryId === child.id
                  ? "border-l-teal-800 bg-teal-50"
                  : "border-l-transparent bg-white hover:bg-teal-50"
              }`}
            >
              <span />
              <input
                type="radio"
                className="justify-self-center"
                name="expense-category"
                checked={selectedCategoryId === child.id}
                onChange={() => {
                  setSelectedCategoryId(child.id);
                  setPaymentTarget(null);
                }}
              />
              <span className="flex min-w-0 items-center gap-2">
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
        <h1 className="flex min-h-[52px] items-center justify-between gap-3 bg-teal-800 px-4 py-3 text-lg font-semibold text-white">
          Insert a new movement about expenses
          <Link
            href="/clubs/archive_expense_list"
            className="shrink-0 rounded border border-white/80 px-3 py-1 text-[13px] font-semibold text-white hover:bg-white/10"
          >
            Archive Expenses
          </Link>
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
              onClick={() => void toggleExpenseLock()}
              disabled={unlocking}
              aria-pressed={isUnlocked}
              className={`mt-5 h-9 rounded px-4 text-[13px] font-semibold text-white disabled:opacity-60 ${isUnlocked ? 'border border-teal-900 bg-teal-800 hover:bg-teal-900' : 'border border-red-800 bg-red-700 hover:bg-red-800'}`}
            >
              {unlocking ? 'Checking...' : isUnlocked ? 'Unlocked' : 'Locked'}
            </button>
            {unlockError && (
              <p role="alert" className="mt-5 text-xs font-medium text-red-700">
                {unlockError}
              </p>
            )}
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
                            {record.rest <= 0 ? (
                              <span className="inline-flex min-w-[54px] justify-center rounded-sm bg-[#3fa64f] px-2 py-1 text-[11px] font-bold uppercase text-white">
                                {(record.expenseDirection ?? 'OUT') === 'IN'
                                  ? 'RECEIVED'
                                  : 'PAID'}
                              </span>
                            ) : (
                              <span
                                className={`inline-flex min-w-[42px] justify-center rounded-sm px-2 py-1 text-[11px] font-bold uppercase ${(record.expenseDirection ?? 'OUT') === 'IN' ? 'bg-[#3fa64f] text-white' : 'bg-[#db4e4e] text-white'}`}
                              >
                                {record.expenseDirection ?? 'OUT'}
                              </span>
                            )}
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
        <>
          <div className="mx-auto mt-4 rounded-md border border-teal-800/20 bg-[#eef6f5] px-5 py-4 text-center">
            <div className="text-lg font-bold text-teal-950">
              Summary of expenses selected
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-800 md:grid-cols-4">
              <div className="rounded border border-teal-800/20 bg-white px-3 py-2">
                A = Total cost{" "}
                <strong>{formatAmount(selectedSummary.totalCost)}</strong>
              </div>
              <div className="rounded border border-teal-800/20 bg-white px-3 py-2">
                B = Total paid{" "}
                <strong>{formatAmount(selectedSummary.totalPaid)}</strong>
              </div>
              <div className="rounded border border-teal-800/20 bg-white px-3 py-2">
                C = Rest{" "}
                <strong className="text-red-700">
                  {formatAmount(selectedSummary.totalRestValue)}
                </strong>
              </div>
              <div className="rounded border border-teal-800/20 bg-white px-3 py-2">
                D = Date last payment{" "}
                <strong>{selectedSummary.lastPaymentDate || "—"}</strong>
              </div>
            </div>
          </div>
          {selectedSummary.incoming && (
            <div className="mx-auto mt-3 rounded-md border border-green-800/20 bg-green-50 px-5 py-4 text-center">
              <div className="text-lg font-bold text-green-900">
                Summary of incoming expenses selected
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-800 md:grid-cols-4">
                <div className="rounded border border-green-800/20 bg-white px-3 py-2">
                  A = Total incoming{" "}
                  <strong>{formatAmount(selectedSummary.incoming.totalCost)}</strong>
                </div>
                <div className="rounded border border-green-800/20 bg-white px-3 py-2">
                  B = Total received{" "}
                  <strong>{formatAmount(selectedSummary.incoming.totalPaid)}</strong>
                </div>
                <div className="rounded border border-green-800/20 bg-white px-3 py-2">
                  C = Incoming rest{" "}
                  <strong className="text-green-900">
                    {formatAmount(selectedSummary.incoming.totalRestValue)}
                  </strong>
                </div>
                <div className="rounded border border-green-800/20 bg-white px-3 py-2">
                  D = Date last received{" "}
                  <strong>{selectedSummary.incoming.lastPaymentDate || "—"}</strong>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {categories.length > 0 && (
        <section className="mx-auto mt-4 w-full overflow-hidden rounded-md border border-gray-200 bg-white">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-teal-800/20 bg-[#eef6f5] px-4 py-3">
            <h2 className="text-lg font-bold text-teal-950">Expense charts</h2>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
                <span>Branch</span>
                <select
                  value={chartBranchId}
                  onChange={(event) => {
                    setChartBranchId(event.target.value);
                    setChartSubBranchId('all');
                  }}
                  className="h-9 min-w-44 rounded border border-gray-300 bg-white px-2 text-sm font-normal"
                >
                  <option value="all">All branches</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
                <span>Sub-branch</span>
                <select
                  value={chartSubBranchId}
                  onChange={(event) => setChartSubBranchId(event.target.value)}
                  disabled={!chartBranch || chartSubBranches.length === 0}
                  className="h-9 min-w-44 rounded border border-gray-300 bg-white px-2 text-sm font-normal disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="all">All sub-branches</option>
                  {chartSubBranches.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {expenseChartData.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-500">
              No expenses in the selected date range.
            </p>
          ) : (
            <>
              <div className="grid gap-4 p-4 lg:grid-cols-2">
                <div className="min-w-0 border border-gray-200 p-3">
                  <h3 className="mb-2 text-sm font-semibold text-gray-800">
                    Cost by branch
                  </h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={expenseChartData}
                      margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value) => formatAmount(Number(value))}
                        labelFormatter={(label) => String(label)}
                      />
                      <Bar dataKey="cost" name="Cost" radius={[3, 3, 0, 0]}>
                        {expenseChartData.map((item) => (
                          <Cell key={item.id} fill={item.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="min-w-0 border border-gray-200 p-3">
                  <h3 className="mb-2 text-sm font-semibold text-gray-800">
                    Cost share by branch
                  </h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={expenseChartData}
                        dataKey="cost"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="38%"
                        outerRadius="78%"
                        paddingAngle={1}
                      >
                        {expenseChartData.map((item) => (
                          <Cell key={item.id} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatAmount(Number(value))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <ul className="grid gap-x-4 gap-y-2 border-t border-gray-200 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
                {expenseChartData.map((item) => (
                  <li
                    key={item.id}
                    className="flex min-w-0 items-center gap-2 text-sm text-gray-800"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm border border-black/15"
                      style={{ backgroundColor: item.color }}
                      aria-hidden="true"
                    />
                    <ExpenseCategoryIcon
                      name={item.icon}
                      className="h-4 w-4 shrink-0 text-gray-600"
                    />
                    <span className="min-w-0 flex-1 truncate" title={item.name}>
                      {item.name}
                    </span>
                    <strong className="shrink-0">{formatAmount(item.cost)}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
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
                <span className="mb-1 block font-medium">Club Admin password</span>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  autoComplete="current-password"
                  className="h-9 w-full rounded border border-gray-300 px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">
                  {editTarget.expenseDirection === 'IN'
                    ? 'Value in incoming'
                    : 'Payment to do'}
                </span>
                <input
                  type="number"
                  min={editTarget.pay}
                  step="0.01"
                  required
                  value={amountToDo}
                  onChange={(event) => setAmountToDo(event.target.value)}
                  disabled={saving || !adminPassword.trim()}
                  className="h-9 w-full rounded border border-gray-300 px-3"
                />
                <span className="mt-1 block text-xs text-gray-500">
                  Already paid: {formatAmount(editTarget.pay)}
                </span>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Rest after</span>
                <input
                  type="text"
                  readOnly
                  value={formatAmount(
                    Math.max(0, (Number(amountToDo) || 0) - editTarget.pay),
                  )}
                  className="h-9 w-full rounded border border-gray-300 bg-gray-50 px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Date of last payment</span>
                <input
                  type="text"
                  value={editTarget.lastPaymentDate || '—'}
                  readOnly
                  className="h-9 w-full rounded border border-gray-300 bg-gray-50 px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">
                  {editTarget.expenseDirection === 'IN'
                    ? 'Date of incoming'
                    : 'Expiration date'}
                </span>
                <input
                  type="date"
                  value={expenseExpirationDate}
                  onChange={(event) =>
                    setExpenseExpirationDate(event.target.value)
                  }
                  disabled={saving || !adminPassword.trim()}
                  className="h-9 w-full rounded border border-gray-300 px-3 disabled:bg-gray-100 disabled:text-gray-500"
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

      {newExpenseOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="planned-expense-create-title"
        >
          <form
            onSubmit={saveNewExpense}
            className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl"
          >
            <div className="border-b border-gray-200 bg-teal-800 px-4 py-3 text-white">
              <h2 id="planned-expense-create-title" className="font-semibold">
                Add planned expense
              </h2>
            </div>
            <div className="space-y-4 px-4 py-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Expense sector</span>
                <select
                  required
                  value={newExpenseCategoryId}
                  onChange={(event) =>
                    setNewExpenseCategoryId(event.target.value)
                  }
                  className="h-9 w-full rounded border border-gray-300 bg-white px-3"
                >
                  <option value="">Select a sector</option>
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Expense type</span>
                <select
                  value={newExpenseDirection}
                  onChange={(event) =>
                    setNewExpenseDirection(event.target.value as 'IN' | 'OUT')
                  }
                  className="h-9 w-full rounded border border-gray-300 bg-white px-3"
                >
                  <option value="OUT">Outgoing (OUT)</option>
                  <option value="IN">Incoming (IN)</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">
                  {newExpenseDirection === 'IN'
                    ? 'Value in incoming'
                    : 'Value to pay'}
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={newExpenseAmount}
                  onChange={(event) => setNewExpenseAmount(event.target.value)}
                  className="h-9 w-full rounded border border-gray-300 px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">
                  {newExpenseDirection === 'IN'
                    ? 'Date of incoming'
                    : 'Expiration date'}
                </span>
                <input
                  type="date"
                  required
                  value={newExpenseExpirationDate}
                  onChange={(event) =>
                    setNewExpenseExpirationDate(event.target.value)
                  }
                  className="h-9 w-full rounded border border-gray-300 px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Note</span>
                <input
                  type="text"
                  value={newExpenseNote}
                  onChange={(event) => setNewExpenseNote(event.target.value)}
                  className="h-9 w-full rounded border border-gray-300 px-3"
                />
              </label>
              {newExpenseError && (
                <p role="alert" className="text-sm text-red-600">
                  {newExpenseError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
              <button
                type="button"
                onClick={() => setNewExpenseOpen(false)}
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
                Save expense
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
