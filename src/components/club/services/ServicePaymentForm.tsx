'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import ProcedureFormSection, {
  procedureHighlightInputClass,
  procedureInputClass,
  procedureReadonlyInputClass,
} from '@/components/procedures/ProcedureFormLayout';
import TaxDocumentModal, { type TaxDocumentFormValues } from '@/components/procedures/TaxDocumentModal';
import {
  createInstallment,
  deleteInstallment,
  fetchInstallments,
  updateInstallment,
  type InstallmentRow,
} from '@/lib/club/archives/clubArchiveClient';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';
import { formatEuro } from '@/lib/club/servicePurchasesClient';
import type { ServiceSaleFormOptions, ServiceSalePayment, ServiceSalePurchase } from '@/lib/club/serviceSaleClient';
import AdminPasswordConfirmModal from '@/components/club/AdminPasswordConfirmModal';
import PaymentModeSelect from '@/components/club/PaymentModeSelect';
import { useClubDefaultPaymentMethods } from '@/hooks/useClubDefaultPaymentMethods';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';

export type PaymentDistribution = {
  installmentId: string;
  /** When paying multiple archive records, the procedure record id to charge. */
  recordId?: string;
  amount: number;
  newPaid: number;
  newBalance: number;
};

export type ServicePaymentSubmitValues = {
  amountPaid: number;
  paymentDate: string;
  description: string;
  payMode: string;
  paymentType: 'D' | 'B';
  taxDoc: boolean;
  operatorId: string;
  operatorPassword: string;
  debtTotal: number;
  debtExpire: string;
  payWith: number;
  restGive: number;
  taxDocument?: TaxDocumentFormValues;
  createReceipt: boolean;
  receiptNumber?: string;
  receiptAnnotations?: string;
  receiptDocumentType?: string;
  distributions: PaymentDistribution[];
  /** True when paying multiple archive deadline records at once. */
  multiRecord?: boolean;
};

type Props = {
  purchase: ServiceSalePurchase;
  /** Extra open deadlines (same member) from archive multi-select. */
  extraPurchases?: ServiceSalePurchase[];
  payments: ServiceSalePayment[];
  options: ServiceSaleFormOptions;
  procedureType?: string;
  saving?: boolean;
  error?: string;
  success?: string;
  onSubmit: (values: ServicePaymentSubmitValues) => Promise<void>;
  onCancel?: () => void;
  onAddToRecordTotal?: (amount: number) => Promise<void>;
  operatorPassStatus?: string;
  notEnterCustData?: boolean;
  /** When true, hide the receipt/tax document UI and never create receipts. */
  disableReceipt?: boolean;
  /** Selected procedure record ids (for scoping Historical / Payments / Receipts tabs). */
  onSelectedRecordIdsChange?: (recordIds: string[]) => void;
};

function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toYmd(iso: string | null | undefined): string {
  if (!iso) return '';
  const trimmed = iso.trim();
  // Prefer ISO YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  // DD/MM/YYYY
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return '';
}

/**
 * Numeric sort value: expire/due calendar day + time-of-day from createdAt.
 * Oldest deadlines sort first.
 */
function deadlineSortTimestamp(
  expireDate: string | null | undefined,
  paymentDate: string | null | undefined,
  createdAt: string | null | undefined
): number {
  const day = toYmd(expireDate) || toYmd(paymentDate);
  let dayMs = Number.MAX_SAFE_INTEGER;
  if (day) {
    const parsed = Date.parse(`${day}T00:00:00`);
    if (!Number.isNaN(parsed)) dayMs = parsed;
  }

  let timeMs = 0;
  if (createdAt && !Number.isNaN(Date.parse(createdAt))) {
    const t = new Date(createdAt);
    timeMs =
      t.getHours() * 3_600_000 +
      t.getMinutes() * 60_000 +
      t.getSeconds() * 1_000 +
      t.getMilliseconds();
  }
  return dayMs + timeMs;
}

function compareDeadlinesOldestFirst(
  a: {
    expireDate: string | null | undefined;
    paymentDate: string | null | undefined;
    createdAt?: string | null;
    id: string;
  },
  b: {
    expireDate: string | null | undefined;
    paymentDate: string | null | undefined;
    createdAt?: string | null;
    id: string;
  }
): number {
  const diff =
    deadlineSortTimestamp(a.expireDate, a.paymentDate, a.createdAt) -
    deadlineSortTimestamp(b.expireDate, b.paymentDate, b.createdAt);
  if (diff !== 0) return diff;
  return a.id.localeCompare(b.id);
}

/** Expire date for ordering/display (expireDate, else paymentDate). */
function effectiveExpireDate(
  expireDate: string | null | undefined,
  paymentDate: string | null | undefined
): string {
  return toYmd(expireDate) || toYmd(paymentDate);
}

function formatDeadlineWhen(
  expireDate: string | null | undefined,
  paymentDate: string | null | undefined,
  createdAt: string | null | undefined
): string {
  const day = formatDisplayDate(effectiveExpireDate(expireDate, paymentDate) || null);
  if (createdAt && !Number.isNaN(Date.parse(createdAt))) {
    const t = new Date(createdAt).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return `${day} · ${t}`;
  }
  return day;
}

export default function ServicePaymentForm({
  purchase,
  extraPurchases = [],
  payments,
  options,
  procedureType = 'service_sale',
  saving,
  error,
  success,
  onSubmit,
  onCancel,
  onAddToRecordTotal,
  operatorPassStatus = 'Yes',
  notEnterCustData = false,
  disableReceipt = false,
  onSelectedRecordIdsChange,
}: Props) {
  const sectionLabel = `${purchase.sectorName}-${purchase.serviceName}`;
  const multiDeadlineMode = extraPurchases.length > 0;
  const allPurchases = useMemo(
    () => [purchase, ...extraPurchases.filter((p) => p.id !== purchase.id)],
    [purchase, extraPurchases]
  );
  const totalRest = useMemo(
    () => allPurchases.reduce((sum, p) => sum + Math.max(0, p.rest), 0),
    [allPurchases]
  );

  const [installments, setInstallments] = useState<InstallmentRow[]>([]);
  const [selectedInstallmentIds, setSelectedInstallmentIds] = useState<Set<string>>(new Set());
  const [installmentError, setInstallmentError] = useState('');
  const [paymentType, setPaymentType] = useState<'D' | 'B'>('D');
  const [debtTotal, setDebtTotal] = useState(String(totalRest || purchase.rest));
  const [debtExpire, setDebtExpire] = useState(purchase.expireDate ?? '');
  const [description, setDescription] = useState(purchase.notes);
  const [amountPaid, setAmountPaid] = useState('0');
  const amountPaidTouchedRef = useRef(false);
  const [payMode, setPayMode] = useState('cash');
  const defaultPaymentMethods = useClubDefaultPaymentMethods();
  const [taxDoc, setTaxDoc] = useState(!disableReceipt);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [operatorId, setOperatorId] = useState(options.currentOperatorId ?? options.operators[0]?.id ?? '');
  const [operatorPassword, setOperatorPassword] = useState('');
  const isPasswordEnabled = (() => {
    const v = operatorPassStatus.trim().toLowerCase();
    return v === 'yes' || v === 'y' || v === '1' || v === 'true' || v === 't';
  })();
  const [passwordRequired, setPasswordRequired] = useState(isPasswordEnabled);
  const [showPassword, setShowPassword] = useState(false);
  const prevPassStatus = useRef(operatorPassStatus);

  useEffect(() => {
    if (prevPassStatus.current !== operatorPassStatus) {
      prevPassStatus.current = operatorPassStatus;
      setPasswordRequired(isPasswordEnabled);
    }
  }, [operatorPassStatus, isPasswordEnabled]);
  const [payWith, setPayWith] = useState('0');
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [taxDocument, setTaxDocument] = useState<TaxDocumentFormValues | null>(null);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifySaving, setModifySaving] = useState(false);
  const [modifyError, setModifyError] = useState('');
  const [modifyForm, setModifyForm] = useState({
    balance: '',
    paid: '',
    paymentDate: '',
    expireDate: '',
    description: '',
  });
  const [newFormOpen, setNewFormOpen] = useState(false);
  const [newFormSaving, setNewFormSaving] = useState(false);
  const [newForm, setNewForm] = useState({
    balance: '',
    expireDate: new Date().toISOString().slice(0, 10),
    description: '',
  });
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'new' | 'delete' | null>(null);
  /** Which "new" flow triggered the admin-password gate: split the selected deadline, or add an independent one. */
  const [newAction, setNewAction] = useState<'divide' | 'add'>('add');

  useEffect(() => {
    if (multiDeadlineMode) {
      setInstallments([]);
      return;
    }
    fetchInstallments(procedureType, purchase.id)
      .then(setInstallments)
      .catch(() => setInstallments([]));
  }, [procedureType, purchase.id, multiDeadlineMode]);

  const todayYmd = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (!multiDeadlineMode) return;
    setSelectedInstallmentIds(
      new Set(allPurchases.filter((p) => p.rest > 0).map((p) => p.id))
    );
  }, [multiDeadlineMode, allPurchases]);

  const paidAmount = Number(amountPaid) || 0;
  const payWithAmount = Number(payWith) || 0;
  const restGive = Math.max(0, payWithAmount - paidAmount);

  type DeadlineListRow = {
    id: string;
    balance: number;
    paymentDate: string | null;
    expireDate: string | null;
    createdAt: string | null;
    paid: number;
    disabled: boolean;
    label?: string;
    recordId: string;
  };

  const installmentRows = useMemo((): DeadlineListRow[] => {
    let rows: DeadlineListRow[];
    if (multiDeadlineMode) {
      rows = allPurchases
        .filter((p) => p.rest > 0)
        .map((p) => ({
          id: p.id,
          balance: p.rest,
          paymentDate: p.paydate,
          expireDate: p.paydate,
          createdAt: p.createdAt ?? null,
          paid: p.pay,
          disabled: false,
          label: `${p.sectorName}-${p.serviceName}`,
          recordId: p.id,
        }));
    } else if (installments.length > 0) {
      rows = installments.map((row) => ({
        id: row.id,
        balance: row.balance,
        paymentDate: row.paymentDate,
        expireDate: row.expireDate,
        createdAt: row.createdAt ?? null,
        paid: row.paid,
        disabled: false,
        recordId: purchase.id,
      }));
    } else {
      rows = payments.map((p) => ({
        id: p.id,
        balance: p.balance,
        paymentDate: p.paymentDate,
        expireDate: p.paymentDate,
        createdAt: p.paymentDate,
        paid: p.paid,
        disabled: true,
        recordId: purchase.id,
      }));
      if (purchase.rest > 0) {
        rows.unshift({
          id: 'current',
          balance: purchase.rest,
          paymentDate: purchase.paydate,
          expireDate: purchase.paydate,
          createdAt: purchase.createdAt ?? null,
          paid: purchase.pay,
          disabled: false,
          recordId: purchase.id,
        });
      }
    }
    // Client: list chronologically — oldest deadline at the top (date, then time).
    return [...rows].sort(compareDeadlinesOldestFirst);
  }, [multiDeadlineMode, allPurchases, installments, payments, purchase]);

  /** The sum of rests for the records listed in the "Deadlines total" list. */
  const listedTotalRest = useMemo(
    () => installmentRows.reduce((sum, r) => sum + Math.max(0, r.balance), 0),
    [installmentRows]
  );
  const overallNewRest = Math.round(Math.max(0, listedTotalRest - paidAmount) * 100) / 100;

  const expiredDeadlinesStats = useMemo(() => {
    // We want to look at ALL possible deadlines to find which ones are expired.
    const expired = installmentRows.filter((r) => {
      const dateStr = effectiveExpireDate(r.expireDate, r.paymentDate);
      return dateStr && dateStr < todayYmd && r.balance > 0;
    });

    const sum = expired.reduce((acc, r) => acc + r.balance, 0);
    // The debt runs from the day it first fell due, so several expired deadlines report the oldest.
    const oldestDate = expired.reduce((oldest, r) => {
      const dateStr = effectiveExpireDate(r.expireDate, r.paymentDate);
      if (!dateStr) return oldest;
      return !oldest || dateStr < oldest ? dateStr : oldest;
    }, '');

    return { sum, oldestDate };
  }, [installmentRows, todayYmd]);

  useEffect(() => {
    // If there are expired deadlines, auto-fill the Debt section with their sum and oldest date.
    if (expiredDeadlinesStats.sum > 0) {
      setDebtTotal(String(expiredDeadlinesStats.sum.toFixed(2)));
      setDebtExpire(expiredDeadlinesStats.oldestDate);
    } else {
      // Fallback to previous logic if nothing is expired.
      setDebtTotal(String((totalRest || purchase.rest).toFixed(2)));
      // Left empty when the record has no expiration, so paying cannot invent one.
      setDebtExpire(purchase.expireDate ?? '');
    }
    
    // Proactively select the expired installments
    const expiredIds = installmentRows
      .filter((r) => {
        const dateStr = effectiveExpireDate(r.expireDate, r.paymentDate);
        return dateStr && dateStr < todayYmd && r.balance > 0;
      })
      .map(r => r.id);
    
    if (expiredIds.length > 0) {
      setSelectedInstallmentIds(new Set(expiredIds));
    }
  }, [expiredDeadlinesStats, totalRest, purchase.rest, purchase.expireDate, todayYmd, installmentRows]);

  useEffect(() => {
    if (!onSelectedRecordIdsChange) return;
    const fromSelection = Array.from(selectedInstallmentIds)
      .map((id) => installmentRows.find((r) => r.id === id)?.recordId)
      .filter((id): id is string => Boolean(id));
    const uniqueSelected = Array.from(new Set(fromSelection));
    if (uniqueSelected.length > 0) {
      onSelectedRecordIdsChange(uniqueSelected);
      return;
    }
    // Nothing checked → all deadlines currently listed on this form.
    const listed = Array.from(new Set(installmentRows.map((r) => r.recordId).filter(Boolean)));
    onSelectedRecordIdsChange(listed.length > 0 ? listed : [purchase.id]);
  }, [
    selectedInstallmentIds,
    installmentRows,
    purchase.id,
    onSelectedRecordIdsChange,
  ]);

  const selectedTotalRest = useMemo(() => {
    return installmentRows
      .filter((r) => selectedInstallmentIds.has(r.id))
      .reduce((sum, r) => sum + r.balance, 0);
  }, [installmentRows, selectedInstallmentIds]);

  function computeTotalRestForIds(ids: Set<string>): number {
    return installmentRows
      .filter((r) => ids.has(r.id))
      .reduce((sum, r) => sum + Math.max(0, r.balance), 0);
  }

  // Auto-fill Amount paid to the full selected rest when selection changes.
  useEffect(() => {
    amountPaidTouchedRef.current = false;
    setAmountPaid(selectedTotalRest > 0 ? String(Number(selectedTotalRest.toFixed(2))) : '0');
    setPayWith('0');
  }, [selectedTotalRest]);

  const nextRests = useMemo(() => {
    // Waterfall from Amount paid: oldest expire (then time) first.
    const sorted = [...installmentRows]
      .filter((r) => selectedInstallmentIds.has(r.id))
      .sort(compareDeadlinesOldestFirst);
    let remaining = Math.round(paidAmount * 100) / 100;
    return sorted.map((r) => {
      const paidHere = Math.round(Math.min(remaining, r.balance) * 100) / 100;
      remaining = Math.round(Math.max(0, remaining - paidHere) * 100) / 100;
      return {
        id: r.id,
        recordId: r.recordId,
        label: r.label
          ? `${r.label} · ${formatDeadlineWhen(r.expireDate, r.paymentDate, r.createdAt)}`
          : formatDeadlineWhen(r.expireDate, r.paymentDate, r.createdAt),
        newRest: Math.round(Math.max(0, r.balance - paidHere) * 100) / 100,
        paidHere,
        paid: r.paid,
        balance: r.balance,
      };
    });
  }, [installmentRows, selectedInstallmentIds, paidAmount]);

  function buildWaterfallDistributions(amount: number): PaymentDistribution[] {
    const sorted = [...installmentRows]
      .filter((r) => selectedInstallmentIds.has(r.id))
      .sort(compareDeadlinesOldestFirst);
    let remaining = Math.round(amount * 100) / 100;
    const distributions: PaymentDistribution[] = [];
    for (const row of sorted) {
      if (remaining <= 0) break;
      const paidHere = Math.round(Math.min(remaining, row.balance) * 100) / 100;
      if (paidHere <= 0) continue;
      remaining = Math.round((remaining - paidHere) * 100) / 100;
      distributions.push({
        installmentId: row.id,
        recordId: row.recordId,
        amount: paidHere,
        newPaid: Math.round((row.paid + paidHere) * 100) / 100,
        newBalance: Math.round(Math.max(0, row.balance - paidHere) * 100) / 100,
      });
    }
    return distributions;
  }

  function clampAmountPaid(raw: string): string {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return '0';
    const max = selectedTotalRest;
    if (n > max) return String(Number(max.toFixed(2)));
    return String(n);
  }

  function handleAmountPaidChange(raw: string) {
    amountPaidTouchedRef.current = true;
    setAmountPaid(clampAmountPaid(raw));
  }

  function handlePayWithChange(raw: string) {
    setPayWith(raw);
  }

  async function reloadInstallments() {
    const rows = await fetchInstallments(procedureType, purchase.id);
    setInstallments(rows);
  }

  function handleDivideInstallment() {
    // Divide always needs exactly one existing deadline selected — that's what gets split.
    if (selectedInstallmentIds.size !== 1) {
      setInstallmentError('Select exactly one deadline to divide.');
      return;
    }
    setInstallmentError('');
    setNewAction('divide');
    setPendingAction('new');
    setShowAdminPasswordModal(true);
  }

  function handleAddNewInstallment() {
    // Add new: always allowed — creates an independent deadline, not derived from the selection.
    setInstallmentError('');
    setNewAction('add');
    setPendingAction('new');
    setShowAdminPasswordModal(true);
  }

  function openNewFormAfterAdminAuth() {
    if (newAction === 'add') {
      const selectedId = firstSelectedId();
      const selectedRow = selectedId && selectedId !== 'current'
        ? installments.find((r) => r.id === selectedId)
        : null;
      if (selectedRow) {
        // Reply the selected deadline's own content — this creates a brand new deadline from scratch,
        // it does not touch or divide the one it was copied from.
        setNewForm({
          balance: String(selectedRow.balance),
          expireDate: selectedRow.expireDate?.slice(0, 10) ?? todayYmd,
          description: selectedRow.description ?? (description || sectionLabel),
        });
        setNewFormOpen(true);
        return;
      }
    }
    setNewForm({ balance: '', expireDate: todayYmd, description: description || sectionLabel });
    setNewFormOpen(true);
  }

  async function performNewInstallment() {
    setInstallmentError('');
    const deadlineValue = Number(newForm.balance) || 0;
    if (deadlineValue <= 0) {
      setInstallmentError('Deadline amount must be greater than 0.');
      return;
    }
    setNewFormSaving(true);
    try {
      if (newAction === 'divide') {
        const selectedId = firstSelectedId();
        const selectedRow = selectedId ? installmentRows.find((r) => r.id === selectedId) : null;
        if (selectedRow && selectedId && selectedId !== 'current') {
          // Divide: split the amount off the selected deadline's own rest — total owed stays the same.
          if (deadlineValue > selectedRow.balance + 0.001) {
            setInstallmentError(
              `Divide amount cannot exceed the selected deadline's rest (${formatEuro(selectedRow.balance)}).`
            );
            setNewFormSaving(false);
            return;
          }
          await updateInstallment(procedureType, purchase.id, selectedId, {
            balance: Math.round((selectedRow.balance - deadlineValue) * 100) / 100,
          });
        }
      } else if (onAddToRecordTotal) {
        // Add new: no value limit — bump record total/rest by the new deadline amount.
        await onAddToRecordTotal(deadlineValue);
      }
      await createInstallment(procedureType, purchase.id, {
        balance: deadlineValue,
        paid: 0,
        paymentDate: new Date().toISOString().slice(0, 10),
        expireDate: newForm.expireDate || null,
        description: newForm.description || null,
      });
      setNewFormOpen(false);
      setSelectedInstallmentIds(new Set());
      await reloadInstallments();
    } catch (e) {
      setInstallmentError(e instanceof Error ? e.message : 'Failed to create installment');
    } finally {
      setNewFormSaving(false);
    }
  }

  function firstSelectedId(): string | null {
    return selectedInstallmentIds.size === 1 ? Array.from(selectedInstallmentIds)[0] : null;
  }

  function handleDeleteInstallment() {
    const id = firstSelectedId();
    if (!id || id === 'current') return;
    setPendingAction('delete');
    setShowAdminPasswordModal(true);
  }

  async function performDeleteInstallment() {
    const id = firstSelectedId();
    if (!id || id === 'current') return;
    setInstallmentError('');
    try {
      await deleteInstallment(procedureType, purchase.id, id);
      setSelectedInstallmentIds(new Set());
      await reloadInstallments();
    } catch (e) {
      setInstallmentError(e instanceof Error ? e.message : 'Failed to delete installment');
    }
  }

  function handleModifyInstallment() {
    const id = firstSelectedId();
    if (!id || id === 'current') {
      setInstallmentError('Select exactly one saved installment to modify.');
      return;
    }
    const row = installments.find((r) => r.id === id);
    if (!row) return;
    setInstallmentError('');
    setModifyError('');
    setModifyForm({
      balance: String(row.balance + row.paid),
      paid: String(row.paid),
      paymentDate: row.paymentDate.slice(0, 10),
      expireDate: row.expireDate?.slice(0, 10) ?? '',
      description: row.description ?? '',
    });
    setModifyOpen(true);
  }

  async function handleSaveModifyInstallment(e: React.FormEvent) {
    e.preventDefault();
    const id = firstSelectedId();
    if (!id || id === 'current') return;

    const deadlineTotal = Number(modifyForm.balance) || 0;
    const currentPaid = Number(modifyForm.paid) || 0;
    if (deadlineTotal < currentPaid) {
      setModifyError('Deadline total cannot be less than the amount already paid.');
      return;
    }

    const row = installments.find((r) => r.id === id);
    const oldDeadlineTotal = row ? row.balance + row.paid : deadlineTotal;
    const increase = Math.round((deadlineTotal - oldDeadlineTotal) * 100) / 100;
    const otherTotal = installments
      .filter((r) => r.id !== id)
      .reduce((sum, r) => sum + r.balance + r.paid, 0);
    const newGrandTotal = otherTotal + deadlineTotal;

    setModifySaving(true);
    setModifyError('');
    setInstallmentError('');
    try {
      // Like New deadline: allow raising Deadline above current cost by bumping record total.
      if (increase > 0 && onAddToRecordTotal) {
        await onAddToRecordTotal(increase);
      } else if (increase > 0.001 && !onAddToRecordTotal) {
        setModifyError(
          `Total of all deadlines (€${newGrandTotal.toFixed(2)}) would exceed original cost (€${purchase.value.toFixed(2)}).`
        );
        setModifySaving(false);
        return;
      }

      const newRest = Math.round((deadlineTotal - currentPaid) * 100) / 100;
      await updateInstallment(procedureType, purchase.id, id, {
        balance: newRest,
        paid: currentPaid,
        paymentDate: modifyForm.paymentDate,
        expireDate: modifyForm.expireDate || null,
        description: modifyForm.description || null,
      });
      // Close immediately after successful save (even if reload fails).
      setModifyOpen(false);
      setModifyError('');
      try {
        await reloadInstallments();
      } catch {
        /* list refresh is secondary to closing the form */
      }
    } catch (err) {
      setModifyError(err instanceof Error ? err.message : 'Failed to update installment');
    } finally {
      setModifySaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInstallmentError('');

    if (selectedInstallmentIds.size === 0) {
      setInstallmentError('Select at least one deadline to pay.');
      return;
    }
    if (paidAmount <= 0) {
      setInstallmentError('Enter Amount paid greater than 0 (this is the value written to Archive of Payments).');
      return;
    }
    if (paidAmount > selectedTotalRest) {
      setInstallmentError(
        `Amount paid cannot exceed selected Rest total (${selectedTotalRest.toFixed(2)}).`
      );
      return;
    }
    if (!payMode) {
      setInstallmentError('Please select pay mode.');
      return;
    }
    if (!operatorId) {
      setInstallmentError('Please select an operator.');
      return;
    }
    if (passwordRequired && !operatorPassword.trim()) {
      setInstallmentError('Please enter the operator password.');
      return;
    }

    // Rebuild waterfall at submit time from the typed Amount paid (never from selected total).
    const distributions = buildWaterfallDistributions(paidAmount);
    const distributedSum = Math.round(
      distributions.reduce((s, d) => s + d.amount, 0) * 100
    ) / 100;

    if (distributions.length === 0) {
      setInstallmentError('No amount to distribute across the selected deadlines.');
      return;
    }
    if (Math.abs(distributedSum - paidAmount) > 0.02) {
      setInstallmentError(
        `Distribution mismatch: Amount paid ${paidAmount.toFixed(2)} vs allocated ${distributedSum.toFixed(2)}.`
      );
      return;
    }

    await onSubmit({
      amountPaid: paidAmount,
      paymentDate,
      description,
      payMode,
      paymentType,
      taxDoc,
      operatorId,
      operatorPassword,
      debtTotal: Number(debtTotal) || totalRest || purchase.value,
      debtExpire,
      payWith: payWithAmount,
      restGive,
      taxDocument: disableReceipt ? undefined : taxDocument ?? undefined,
      // Receipt is only tagged in the modal; real save happens on Confirm.
      createReceipt: disableReceipt ? false : Boolean(taxDoc && taxDocument),
      receiptNumber: taxDocument?.documentNumber || undefined,
      receiptAnnotations: taxDocument?.causal || undefined,
      receiptDocumentType: taxDocument?.documentType || undefined,
      distributions,
      multiRecord: multiDeadlineMode,
    });
  }

  const selectedInstallmentId = firstSelectedId();
  /** Divide always needs exactly one checked deadline — that's the one it splits. */
  const canDivideDeadline = !multiDeadlineMode && selectedInstallmentIds.size === 1;
  /** Add new is independent of the selection — it creates a deadline from scratch. */
  const canAddNewDeadline = !multiDeadlineMode;
  const selectedDivideRow = installmentRows.find((r) => r.id === selectedInstallmentId) ?? null;
  const canModifyDelete =
    !multiDeadlineMode &&
    Boolean(selectedInstallmentId) &&
    selectedInstallmentId !== 'current' &&
    selectedInstallmentIds.size === 1;
  const hasPayableRest = totalRest > 0;
  const memberImageUrl = resolvePublicImageUrl(purchase.memberImage);
  const [memberImageBroken, setMemberImageBroken] = useState(false);

  useEffect(() => {
    setMemberImageBroken(false);
  }, [purchase.memberImage, purchase.id]);

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {multiDeadlineMode && (
          <div className="flex items-center gap-3 rounded border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-teal-300 bg-teal-100">
              {memberImageUrl && !memberImageBroken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={memberImageUrl}
                  alt={purchase.memberName}
                  className="h-full w-full object-cover"
                  onError={() => setMemberImageBroken(true)}
                />
              ) : (
                <span className="text-[9px] font-semibold leading-tight text-teal-700">
                  NO
                  <br />
                  IMG
                </span>
              )}
            </div>
            <p className="min-w-0">
              Paying <strong>{allPurchases.filter((p) => p.rest > 0).length}</strong> open deadlines
              for <strong>{purchase.memberName}</strong> (combined rest {formatEuro(totalRest)}).
            </p>
          </div>
        )}
        {!hasPayableRest && !multiDeadlineMode && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No open rest to pay. You can still use <strong>Add new</strong> (admin password) to add more debt
            with any amount.
          </div>
        )}
        <ProcedureFormSection title="Deadlines">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 border border-gray-200 rounded p-3 bg-gray-50 max-h-56 overflow-y-auto">
              <p className="text-sm font-medium text-red-700 mb-2">Deadlines total</p>
              <ul className="space-y-3 text-sm">
                {installmentRows.map((row) => (
                  <li key={row.id} className="border-b border-gray-200 pb-2 last:border-0">
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedInstallmentIds.has(row.id)}
                        disabled={row.disabled && row.id !== 'current'}
                        onChange={() => {
                          const next = new Set(selectedInstallmentIds);
                          if (next.has(row.id)) next.delete(row.id);
                          else next.add(row.id);
                          setSelectedInstallmentIds(next);

                          // Immediately sync "Amount paid" to the selected Rest sum.
                          // (Avoid edge cases where effects run after a user interaction.)
                          const nextTotalRest = computeTotalRestForIds(next);
                          amountPaidTouchedRef.current = false;
                          setAmountPaid(
                            nextTotalRest > 0 ? String(Number(nextTotalRest.toFixed(2))) : '0'
                          );
                          setPayWith('0');
                        }}
                        className="mt-1"
                      />
                      <span className={row.balance <= 0 ? 'opacity-60' : undefined}>
                        {multiDeadlineMode || row.label ? (
                          <>
                            <span className="font-semibold text-red-600">
                              {row.label || sectionLabel}
                            </span>
                            <div className="mt-0.5 text-gray-700">
                              Expire date of{' '}
                              <span className="text-blue-500">
                                {formatDeadlineWhen(row.expireDate, row.paymentDate, row.createdAt)}
                              </span>
                              {' '}                              of {formatEuro(row.balance + row.paid)} Rest{' '}
                              <span className="text-red-600">{formatEuro(row.balance)}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            Purchase service in section{' '}
                            <strong className="text-red-600">{sectionLabel}</strong>
                            <ul className="mt-1 ml-2 text-gray-600">
                              <li>
                                Expire date of{' '}
                                <span className="text-blue-500">
                                  {formatDeadlineWhen(row.expireDate, row.paymentDate, row.createdAt)}
                                </span>
                                {' '}of {formatEuro(row.balance + row.paid)} Rest{' '}
                                <span className="text-red-600">{formatEuro(row.balance)}</span>
                              </li>
                            </ul>
                          </>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
                {installmentRows.length === 0 && (
                  <li className="text-gray-500">No deadlines yet. Use Add new to add one.</li>
                )}
              </ul>
            </div>
            {!multiDeadlineMode && (
            <div className="flex flex-col gap-2 md:w-28">
              <button
                type="button"
                onClick={handleDivideInstallment}
                disabled={!canDivideDeadline}
                className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              >
                Divide deadlines
              </button>
              <button
                type="button"
                onClick={handleModifyInstallment}
                disabled={!canModifyDelete}
                className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              >
                Modify
              </button>
              <button
                type="button"
                onClick={handleDeleteInstallment}
                disabled={!canModifyDelete}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={handleAddNewInstallment}
                disabled={!canAddNewDeadline}
                className="mt-2 rounded bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              >
                Add new
              </button>
            </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Selected total:{' '}
            <strong className={selectedTotalRest > 0 ? 'text-red-700' : ''}>
              {formatEuro(selectedTotalRest)}
            </strong>
          </p>
          {installmentError && <p className="text-red-600 text-xs mt-2">{installmentError}</p>}
        </ProcedureFormSection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ProcedureFormSection title="Type of payment">
            <div className="flex gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="paymentType"
                  value="D"
                  checked={paymentType === 'D'}
                  onChange={() => setPaymentType('D')}
                />
                Down payment
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="paymentType"
                  value="B"
                  checked={paymentType === 'B'}
                  onChange={() => setPaymentType('B')}
                />
                Balance
              </label>
            </div>
          </ProcedureFormSection>

          <ProcedureFormSection title="Debt">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="block">
                <span className="text-gray-600">Total</span>
                <input
                  type="number"
                  step="0.01"
                  className={`mt-1 ${procedureHighlightInputClass}`}
                  style={{ backgroundColor: '#d3f07b' }}
                  value={debtTotal}
                  onChange={(e) => setDebtTotal(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-gray-600">Expired</span>
                <input
                  type="date"
                  className={`mt-1 ${procedureHighlightInputClass}`}
                  style={{ backgroundColor: '#d3f07b' }}
                  value={debtExpire}
                  onChange={(e) => setDebtExpire(e.target.value)}
                />
              </label>
            </div>
          </ProcedureFormSection>
        </div>

        <label className="block text-sm">
          <span className="text-gray-600">Description</span>
          <textarea
            className={`mt-1 ${procedureInputClass}`}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter description"
          />
        </label>

        <div className="rounded border border-gray-300 p-4 space-y-4">
          {/*
            Labels and controls live in two separate grid rows so a long/wrapping
            label (e.g. the "Amount paid" hint) can never push its control out of
            line with the controls in the other columns.
          */}
          <div>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <label htmlFor="servicePaymentAmountPaid" className="mb-1 block min-w-0 text-gray-600">
                Amount paid
                {selectedTotalRest > 0 && (
                  <span className="ml-1 font-normal text-gray-400">
                    (type e.g. 3 — max {formatEuro(selectedTotalRest)}; oldest first)
                  </span>
                )}
              </label>
              <label htmlFor="servicePaymentPayMode" className="mb-1 block min-w-0 text-gray-600">
                Pay mode
              </label>
              <span className="mb-1 block min-w-0" aria-hidden>
                &nbsp;
              </span>
              <span className="mb-1 block min-w-0" aria-hidden>
                &nbsp;
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <input
                id="servicePaymentAmountPaid"
                type="number"
                min="0"
                step="0.01"
                max={selectedTotalRest}
                className={`h-10 min-w-0 ${procedureHighlightInputClass}`}
                style={{ backgroundColor: '#fff984' }}
                value={amountPaid}
                onChange={(e) => handleAmountPaidChange(e.target.value)}
                onBlur={(e) => handleAmountPaidChange(e.target.value)}
              />
              <PaymentModeSelect
                id="servicePaymentPayMode"
                className={`h-10 min-w-0 ${procedureInputClass}`}
                value={payMode}
                onChange={setPayMode}
                defaultPaymentMethods={defaultPaymentMethods}
              />
              {!disableReceipt ? (
                <div className="flex h-10 min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={taxDoc}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setTaxDoc(checked);
                      if (!checked) setTaxDocument(null);
                    }}
                  />
                  <span>Tax doc</span>
                  {taxDocument && (
                    <span className="text-xs text-teal-700">· receipt ready at Confirm</span>
                  )}
                </div>
              ) : (
                <div className="flex h-10 min-w-0 items-center gap-2 text-gray-400" aria-hidden>
                  -
                </div>
              )}
              <div className="min-w-0">
                {!disableReceipt ? (
                  <button
                    type="button"
                    onClick={() => setTaxModalOpen(true)}
                    disabled={!taxDoc}
                    className="h-10 rounded bg-gray-200 px-3 text-sm hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Open form
                  </button>
                ) : (
                  <span className="text-xs text-gray-500" aria-hidden>
                    -
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex min-w-0 flex-col">
              <span className="mb-1 block min-h-[1.25rem] text-gray-600">Date</span>
              <input
                type="date"
                className={`h-10 ${procedureHighlightInputClass}`}
                style={{ backgroundColor: '#fff984' }}
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </label>
            <label className="flex min-w-0 flex-col">
              <span className="mb-1 block min-h-[1.25rem] text-gray-600">Operator</span>
              <select
                className={`h-10 ${procedureInputClass}`}
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
              >
                <option value="">select</option>
                {options.operators.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex min-w-0 flex-col">
              <span className="mb-1 block min-h-[1.25rem]" aria-hidden>
                &nbsp;
              </span>
              <div className="flex h-10 items-center gap-2">
                <input
                  type="checkbox"
                  checked={passwordRequired}
                  disabled={isPasswordEnabled}
                  onChange={(e) => setPasswordRequired(e.target.checked)}
                />
                <span>Password</span>
              </div>
            </div>
            <div className="relative flex min-w-0 flex-col">
              <span className="mb-1 block min-h-[1.25rem]" aria-hidden>
                &nbsp;
              </span>
              {passwordRequired ? (
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`h-10 ${procedureInputClass}`}
                    value={operatorPassword}
                    onChange={(e) => setOperatorPassword(e.target.value)}
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              ) : (
                <div className="h-10" aria-hidden />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <label className="flex min-w-0 flex-col">
              <span className="mb-1 block min-h-[1.25rem] text-gray-600">Pay with €</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className={`h-10 ${procedureHighlightInputClass}`}
                value={payWith}
                onChange={(e) => handlePayWithChange(e.target.value)}
              />
            </label>
            <label className="flex min-w-0 flex-col">
              <span className="mb-1 block min-h-[1.25rem] text-gray-600">Resto to give</span>
              <input
                type="text"
                readOnly
                className={`h-10 ${procedureInputClass}`}
                style={{ backgroundColor: '#d3f07b' }}
                value={restGive.toFixed(2)}
              />
            </label>
          </div>

          {nextRests.some((r) => r.paidHere > 0) && (
            <div className="text-sm text-gray-600 space-y-1">
              {nextRests
                .filter((r) => r.paidHere > 0)
                .map((r) => (
                  <p key={r.id}>
                    <span className="font-medium">{r.label}</span> — Pay{' '}
                    <strong className="text-teal-700">{formatEuro(r.paidHere)}</strong>
                    {' · '}Rest after:{' '}
                    <strong className="text-red-600">{formatEuro(r.newRest)}</strong>
                  </p>
                ))}
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {installmentError && <p className="text-red-600 text-sm">{installmentError}</p>}
        {success && <p className="text-green-700 text-sm">{success}</p>}

        <div className="flex justify-center gap-3">
          <button
            type="submit"
            disabled={saving || !hasPayableRest || selectedInstallmentIds.size === 0 || paidAmount <= 0}
            className="px-6 py-2 bg-red-700 text-white rounded hover:bg-red-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Confirm'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Exit
            </button>
          )}
        </div>
      </form>

      {!disableReceipt && (
        <TaxDocumentModal
          open={taxModalOpen}
          memberName={purchase.memberName}
          defaultCausal={description}
          defaultTotal={paidAmount}
          defaultResidual={overallNewRest}
          initial={
            taxDocument
              ? {
                  ...taxDocument,
                  // Always sync receipt Total to current Amount paid when opening.
                  total: paidAmount,
                  residualTotal: overallNewRest,
                }
              : undefined
          }
          hideMemberName={notEnterCustData}
          onClose={() => setTaxModalOpen(false)}
          onSave={(values) => {
            setTaxDocument(values);
            setTaxDoc(true);
          }}
        />
      )}

      {modifyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSaveModifyInstallment}
            className="bg-white rounded-lg shadow-lg w-full max-w-md p-5 space-y-3 text-sm"
          >
            <h3 className="text-lg font-medium text-gray-900">Modify deadline</h3>
            {modifyError ? <p className="text-red-600 text-xs">{modifyError}</p> : null}
            <label className="block">
              <span className="text-gray-600">Deadline</span>
              <input
                type="number"
                step="0.01"
                min={Number(modifyForm.paid) || 0}
                className={`mt-1 ${procedureInputClass}`}
                value={modifyForm.balance}
                onChange={(e) => setModifyForm((f) => ({ ...f, balance: e.target.value }))}
                required
              />
            </label>
            <label className="block">
              <span className="text-gray-600">Paid</span>
              <input
                type="number"
                step="0.01"
                className={`mt-1 ${procedureReadonlyInputClass}`}
                disabled
                value={modifyForm.paid}
              />
            </label>
            <label className="block">
              <span className="text-gray-600">Payment date</span>
              <input
                type="date"
                className={`mt-1 ${procedureReadonlyInputClass}`}
                disabled
                value={modifyForm.paymentDate}
              />
            </label>
            <label className="block">
              <span className="text-gray-600">Expiration date</span>
              <input
                type="date"
                min={todayYmd}
                className={`mt-1 ${procedureInputClass}`}
                style={{ backgroundColor: '#d3f07b' }}
                value={modifyForm.expireDate}
                onChange={(e) => setModifyForm((f) => ({ ...f, expireDate: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-gray-600">Description</span>
              <textarea
                className={`mt-1 ${procedureInputClass}`}
                rows={2}
                value={modifyForm.description}
                onChange={(e) => setModifyForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setModifyOpen(false);
                  setModifyError('');
                }}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modifySaving}
                className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800 disabled:opacity-50"
              >
                {modifySaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {newFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); void performNewInstallment(); }}
            className="bg-white rounded-lg shadow-lg w-full max-w-md p-5 space-y-3 text-sm"
          >
            <h3 className="text-lg font-medium text-gray-900">
              {newAction === 'add' ? 'Add new deadline' : 'Divide deadline'}
            </h3>
            <p className="text-xs text-gray-500">
              {newAction === 'add'
                ? 'A brand new, independent deadline — amount may exceed current rest; record total will increase by this value.'
                : `Split this amount off the selected deadline's rest${
                    selectedDivideRow ? ` (max ${formatEuro(selectedDivideRow.balance)})` : ''
                  } into a new deadline — the total owed stays the same.`}
            </p>
            <label className="block">
              <span className="text-gray-600">Deadline</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={newAction === 'divide' && selectedDivideRow ? selectedDivideRow.balance : undefined}
                className={`mt-1 ${procedureInputClass}`}
                value={newForm.balance}
                onChange={(e) => setNewForm((f) => ({ ...f, balance: e.target.value }))}
                required
              />
            </label>
            <label className="block">
              <span className="text-gray-600">Expiration date</span>
              <input
                type="date"
                min={todayYmd}
                className={`mt-1 ${procedureInputClass}`}
                style={{ backgroundColor: '#d3f07b' }}
                value={newForm.expireDate}
                onChange={(e) => setNewForm((f) => ({ ...f, expireDate: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-gray-600">Description</span>
              <textarea
                className={`mt-1 ${procedureInputClass}`}
                rows={2}
                value={newForm.description}
                onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewFormOpen(false)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={newFormSaving}
                className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800 disabled:opacity-50"
              >
                {newFormSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      <AdminPasswordConfirmModal
        isOpen={showAdminPasswordModal}
        onClose={() => { setShowAdminPasswordModal(false); setPendingAction(null); }}
        onVerified={() => {
          setShowAdminPasswordModal(false);
          if (pendingAction === 'delete') void performDeleteInstallment();
          if (pendingAction === 'new') openNewFormAfterAdminAuth();
          setPendingAction(null);
        }}
      />
    </>
  );
}
