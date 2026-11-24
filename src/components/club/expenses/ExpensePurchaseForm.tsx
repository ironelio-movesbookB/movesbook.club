'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { BarChart3, Eye, EyeOff, X } from 'lucide-react';
import ProcedureFormSection, {
  ProcedureFormCell,
  ProcedureFormGrid,
  procedureHighlightInputClass,
  procedureInputClass,
  procedureReadonlyInputClass,
} from '@/components/procedures/ProcedureFormLayout';
import { createProcedureClient } from '@/lib/club/procedureClient';
import { uploadExpenseInvoice } from '@/lib/club/expenseInvoiceClient';
import { fetchCompanies } from '@/lib/club/archives/clubArchiveClient';
import PaymentModeSelect from '@/components/club/PaymentModeSelect';
import { useClubDefaultPaymentMethods } from '@/hooks/useClubDefaultPaymentMethods';
import { getProcedureDefinition } from '@/lib/procedures/registry';
import {
  PROCEDURE_TYPE_CODES,
  type ExpenseRecurrenceInterval,
} from '@/lib/procedures/types';
import { clubApiFetch } from "@/lib/club/servicePurchasesClient";
import {
  ExpenseCategoryIcon,
  EXPENSE_ICON_OPTIONS,
} from "@/components/club/expenses/ExpenseCategoryIcon";

type ExpenseFormOptions = {
  expenses: { id: string; name: string }[];
  members: { id: string; name: string }[];
  operators: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  clubName: string;
  clubMemberId: string;
  currentOperatorId: string | null;
};

type ExpenseCategoryOption = {
  id: string;
  icon: string | null;
};

const RECURRENCE_INTERVALS: {
  value: ExpenseRecurrenceInterval;
  label: string;
}[] = [
  { value: "7d", label: "7 days" },
  { value: "14d", label: "14 days" },
  { value: "15d", label: "15 days" },
  { value: "1m", label: "month" },
  { value: "2m", label: "2 months" },
  { value: "3m", label: "3 months" },
];

export default function ExpensePurchaseForm() {
  const router = useRouter();
  const def = getProcedureDefinition(PROCEDURE_TYPE_CODES.EXPENSE)!;
  const client = useMemo(
    () => createProcedureClient(PROCEDURE_TYPE_CODES.EXPENSE),
    [],
  );
  const defaultPaymentMethods = useClubDefaultPaymentMethods();

  const [options, setOptions] = useState<ExpenseFormOptions | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<
    ExpenseCategoryOption[]
  >([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState('');
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const [createdRecordId, setCreatedRecordId] = useState<string | null>(null);
  const [expenseId, setExpenseId] = useState('');
  const [expenseName, setExpenseName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [operatorPassword, setOperatorPassword] = useState('');
  const [value, setValue] = useState('');
  const [pay, setPay] = useState('');
  const [movementDate, setMovementDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [movementTime, setMovementTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  // Planned expense: when the rest is due. The deadline shows up in Expense Deadlines until paid.
  const [dueDate, setDueDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [causal, setCausal] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [categoryAverage, setCategoryAverage] = useState<number | null>(null);
  const [categoryAverageCount, setCategoryAverageCount] = useState(0);
  const [categoryAverageLoading, setCategoryAverageLoading] = useState(false);
  const [categoryAverageError, setCategoryAverageError] = useState('');
  const [recurrent, setRecurrent] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] =
    useState<ExpenseRecurrenceInterval>("7d");
  const [repeatCount, setRepeatCount] = useState("1");

  useEffect(() => {
    Promise.all([
      client.fetchFormOptions<ExpenseFormOptions>(),
      fetchCompanies(),
      clubApiFetch<{ flatItems?: ExpenseCategoryOption[] }>(
        "/api/club/settings/tables/expenses",
      ).catch(() => ({ flatItems: [] })),
    ])
      .then(([opts, co, expenseCategoryResponse]) => {
        setOptions(opts);
        setExpenseCategories(expenseCategoryResponse.flatItems ?? []);
        setCompanies(co.length ? co : opts.companies);
        if (opts.currentOperatorId) setOperatorId(opts.currentOperatorId);
        else if (opts.operators[0]?.id) setOperatorId(opts.operators[0].id);
        const companyList = co.length ? co : opts.companies;
        if (companyList[0]?.id) setCompanyId(companyList[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false));
  }, [client]);

  const selectedExpense = options?.expenses.find((e) => e.id === expenseId);
  const selectedExpenseIcon = expenseCategories.find(
    (expense) => expense.id === expenseId,
  )?.icon;
  const selectedIconLabel = EXPENSE_ICON_OPTIONS.find(
    (option) => option.value === selectedExpenseIcon,
  )?.label;
  const selectedCompany = companies.find((c) => c.id === companyId);
  const total = Number(value) || 0;
  const paid = pay === '' ? 0 : Number(pay);
  const rest = Math.max(0, total - paid);

  useEffect(() => {
    if (selectedExpense) setExpenseName(selectedExpense.name);
  }, [selectedExpense]);

  useEffect(() => {
    if (!expenseId) {
      setCategoryAverage(null);
      setCategoryAverageCount(0);
      setCategoryAverageError('');
      return;
    }

    const controller = new AbortController();
    setCategoryAverageLoading(true);
    setCategoryAverageError('');
    const query = new URLSearchParams({
      expenseId,
      beforeDate: movementDate,
    });
    clubApiFetch<{ average: number | null; count: number }>(
      `/api/club/procedures/expense/category-average?${query}`,
      { signal: controller.signal },
    )
      .then((result) => {
        setCategoryAverage(result.average);
        setCategoryAverageCount(result.count);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setCategoryAverage(null);
        setCategoryAverageCount(0);
        setCategoryAverageError(
          err instanceof Error
            ? err.message
            : "Unable to load the category average.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setCategoryAverageLoading(false);
      });

    return () => controller.abort();
  }, [expenseId, movementDate]);

  useEffect(() => {
    if (!invoiceFile) {
      setInvoicePreviewUrl('');
      return;
    }

    const previewUrl = URL.createObjectURL(invoiceFile);
    setInvoicePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [invoiceFile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!options?.clubMemberId)
      return setError('The club account could not be identified.');
    if (!expenseName.trim())
      return setError('Please select or enter an expense.');
    if (!invoiceFile)
      return setError('Please load the invoice picture for this expense.');
    if (total <= 0) return setError('Amount must be greater than zero.');
    if (!operatorId) return setError('Please select an operator.');
    if (!operatorPassword.trim())
      return setError('Operator password is required.');
    if (paid < 0) return setError('Payment cannot be negative.');
    if (paid > total) return setError('Payment cannot exceed total.');
    if (
      recurrent &&
      (!Number.isInteger(Number(repeatCount)) ||
        Number(repeatCount) < 1 ||
        Number(repeatCount) > 1000)
    ) {
      return setError("Repeat must be a whole number between 1 and 1000.");
    }
    if (rest > 0 && !dueDate)
      return setError('Please set the planned payment date for the rest.');
    if (rest > 0 && dueDate < movementDate) {
      return setError(
        'The planned payment date cannot be before the expense date.',
      );
    }

    setSaving(true);
    try {
      let recordId = createdRecordId;
      if (!recordId) {
        const created = await client.createRecord({
          memberId: options.clubMemberId,
          totalAmount: total,
          initialPayment: paid,
          recordDate: movementDate,
          // An initial payment is made on the expense date; a fully paid expense has nothing planned.
          paymentDate: movementDate,
          dueDate: rest > 0 ? dueDate : movementDate,
          causal,
          notes: causal,
          expenseId: expenseId || null,
          expenseName: expenseName.trim(),
          operatorId,
          operatorPassword,
          payMode,
          movementTime,
          companyId,
          companyName: selectedCompany?.name,
          recurrent,
          ...(recurrent
            ? {
                recurrenceInterval,
                repeatCount: Number(repeatCount),
              }
            : {}),
        });
        recordId = created.recordId;
        setCreatedRecordId(recordId);
      }
      await uploadExpenseInvoice(recordId, invoiceFile);
      router.push(def.routes.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-600">Loading form...</div>;

  return (
    <>
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-6 space-y-6">
        <ProcedureFormSection title="Movement data">
          <ProcedureFormGrid>
            <ProcedureFormCell label="Official name of Club/Team">
              <input
                type="text"
                value={options?.clubName ?? ''}
                readOnly
                disabled
                className={procedureReadonlyInputClass}
              />
            </ProcedureFormCell>
            <ProcedureFormCell label="Date">
              <input
                type="date"
                className={procedureInputClass}
                value={movementDate}
                onChange={(e) => setMovementDate(e.target.value)}
              />
            </ProcedureFormCell>
            <ProcedureFormCell label="Hour">
              <input
                type="time"
                className={procedureInputClass}
                value={movementTime}
                onChange={(e) => setMovementTime(e.target.value)}
              />
            </ProcedureFormCell>
          </ProcedureFormGrid>
        </ProcedureFormSection>

        <ProcedureFormSection title="Expense">
          <ProcedureFormGrid>
            <ProcedureFormCell label="Expense category">
              <p
                className="mb-1 min-h-4 text-right text-xs text-red-600"
                aria-live="polite"
              >
                {expenseId
                  ? categoryAverageLoading
                    ? "Loading average..."
                    : categoryAverageError
                      ? categoryAverageError
                      : categoryAverage == null
                        ? "No previous records"
                        : `Average of ${categoryAverageCount} records: €${categoryAverage.toFixed(2)}`
                  : ''}
              </p>
              <select
                className={procedureInputClass}
                value={expenseId}
                onChange={(e) => setExpenseId(e.target.value)}
              >
                <option value="">Select or type below</option>
                {options?.expenses.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </ProcedureFormCell>
            <ProcedureFormCell label="Expense name">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className={`${procedureInputClass} min-w-0 flex-1`}
                  value={expenseName}
                  onChange={(e) => setExpenseName(e.target.value)}
                />
                <span
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-gray-300 bg-white text-gray-700"
                  title={selectedIconLabel ?? "Expense icon"}
                  aria-label={selectedIconLabel ?? "Expense icon"}
                >
                  <ExpenseCategoryIcon
                    name={selectedExpenseIcon ?? "coins"}
                    className="h-5 w-5"
                  />
                </span>
                <button
                  type="button"
                  disabled
                  title="Statistics display will be added later."
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded border border-teal-800 bg-teal-800 px-3 text-sm font-semibold text-white opacity-60"
                >
                  <BarChart3 aria-hidden="true" className="h-4 w-4" />
                  Statistic
                </button>
              </div>
            </ProcedureFormCell>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={recurrent}
                  onChange={(event) => setRecurrent(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Recurrent
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                Every
                <select
                  className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                  value={recurrenceInterval}
                  onChange={(event) => {
                    const selectedInterval = RECURRENCE_INTERVALS.find(
                      (interval) => interval.value === event.target.value,
                    );
                    if (selectedInterval) {
                      setRecurrenceInterval(selectedInterval.value);
                    }
                  }}
                  disabled={!recurrent}
                >
                  {RECURRENCE_INTERVALS.map((interval) => (
                    <option key={interval.value} value={interval.value}>
                      {interval.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                Repeat
                <input
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  className="w-20 rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                  value={repeatCount}
                  onChange={(event) => setRepeatCount(event.target.value)}
                  disabled={!recurrent}
                />
                times
              </label>
              {recurrent && (
                <span className="text-xs text-gray-500">
                  Additional occurrences are created unpaid on their scheduled
                  dates.
                </span>
              )}
            </div>
            <ProcedureFormCell label="Value">
              <input
                type="number"
                min="0"
                step="0.01"
                className={procedureInputClass}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </ProcedureFormCell>
            <ProcedureFormCell label="Pay now">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0 = planned, pay later"
                className={procedureHighlightInputClass}
                value={pay}
                onChange={(e) => setPay(e.target.value)}
              />
            </ProcedureFormCell>
            <ProcedureFormCell label="Planned payment date">
              <input
                type="date"
                className={
                  rest > 0 ? procedureInputClass : procedureReadonlyInputClass
                }
                value={rest > 0 ? dueDate : movementDate}
                min={movementDate}
                disabled={rest <= 0}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </ProcedureFormCell>
            <ProcedureFormCell label="Causal">
              <input
                type="text"
                className={procedureInputClass}
                value={causal}
                onChange={(e) => setCausal(e.target.value)}
              />
            </ProcedureFormCell>
          </ProcedureFormGrid>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm bg-gray-50 p-3 rounded">
            <div>
              Total: <strong>€{total.toFixed(2)}</strong>
            </div>
            <div>
              Paid: <strong>€{paid.toFixed(2)}</strong>
            </div>
            <div>
              Rest: <strong className="text-red-600">€{rest.toFixed(2)}</strong>
            </div>
          </div>
          {total > 0 && (
            <p className="mt-2 text-xs text-gray-600">
              {rest <= 0
                ? 'Fully paid now: the payment is recorded as OUT in the Archive of Payments.'
                : paid > 0
                  ? `€${paid.toFixed(2)} is paid now (OUT); the rest of €${rest.toFixed(2)} is planned for ${dueDate}.`
                  : `Planned expense: nothing is paid now; €${rest.toFixed(2)} is planned for ${dueDate}. Pay it later from Expense Deadlines.`}
            </p>
          )}
        </ProcedureFormSection>

        <ProcedureFormSection title="Type of payment">
          <ProcedureFormGrid>
            <ProcedureFormCell label="Payment method">
              <PaymentModeSelect
                className={procedureInputClass}
                value={payMode}
                onChange={setPayMode}
                defaultPaymentMethods={defaultPaymentMethods}
                allowEmpty={false}
              />
            </ProcedureFormCell>
            <ProcedureFormCell label="Invoice">
              <input
                ref={invoiceInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.doc,.docx,.odt,.pages,.txt,.rtf,.md,.pdf,.html,.xhtml,image/jpeg,image/png,image/gif,image/bmp,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,application/vnd.apple.pages,text/plain,text/rtf,text/markdown,text/html,application/xhtml+xml"
                className="hidden"
                onChange={(event) => {
                  setInvoiceFile(event.currentTarget.files?.[0] ?? null);
                  event.currentTarget.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => invoiceInputRef.current?.click()}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
              >
                Load invoice
              </button>
              <p className="mt-1 text-xs text-gray-500">
                One invoice picture per expense. You can replace it before
                saving.
              </p>
              {invoiceFile && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="min-w-0 flex-1 break-all">
                      {invoiceFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setInvoiceFile(null)}
                      aria-label="Remove invoice"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-600 hover:bg-gray-100 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {invoicePreviewUrl &&
                    invoiceFile.type.startsWith('image/') && (
                      <Image
                        src={invoicePreviewUrl}
                        alt={`Preview of ${invoiceFile.name}`}
                        width={640}
                        height={480}
                        unoptimized
                        className="max-h-64 max-w-full rounded border border-gray-200 object-contain"
                      />
                    )}
                  {invoicePreviewUrl &&
                    invoiceFile.type === 'application/pdf' && (
                      <iframe
                        src={invoicePreviewUrl}
                        title={`Preview of ${invoiceFile.name}`}
                        className="h-64 w-full rounded border border-gray-200"
                      />
                    )}
                </div>
              )}
            </ProcedureFormCell>
            <ProcedureFormCell label="Operator">
              <select
                className={procedureInputClass}
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
              >
                {options?.operators.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </ProcedureFormCell>
            <ProcedureFormCell label="Password">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={procedureInputClass}
                  value={operatorPassword}
                  onChange={(e) => setOperatorPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </ProcedureFormCell>
          </ProcedureFormGrid>
        </ProcedureFormSection>

        <ProcedureFormSection title="Company" titleClassName="text-green-800">
          <ProcedureFormGrid>
            <ProcedureFormCell label="Company">
              <select
                className={procedureInputClass}
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </ProcedureFormCell>
          </ProcedureFormGrid>
        </ProcedureFormSection>

        {error && (
          <div className="text-red-600 bg-red-50 border border-red-200 rounded px-4 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-red-700 text-white rounded disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => router.push(def.routes.records)}
            className="px-6 py-2 bg-gray-200 rounded"
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
