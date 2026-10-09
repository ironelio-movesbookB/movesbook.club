'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import ProcedureFormSection, {
  ProcedureFormCell,
  ProcedureFormGrid,
  procedureHighlightInputClass,
  procedureInputClass,
  procedureReadonlyInputClass,
} from '@/components/procedures/ProcedureFormLayout';
import { createProcedureClient } from '@/lib/club/procedureClient';
import { fetchCompanies } from '@/lib/club/archives/clubArchiveClient';
import PaymentModeSelect from '@/components/club/PaymentModeSelect';
import { useClubDefaultPaymentMethods } from '@/hooks/useClubDefaultPaymentMethods';
import { getProcedureDefinition } from '@/lib/procedures/registry';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';

type ExpenseFormOptions = {
  expenses: { id: string; name: string }[];
  members: { id: string; name: string }[];
  operators: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  clubName: string;
  clubMemberId: string;
  currentOperatorId: string | null;
};

export default function ExpensePurchaseForm() {
  const router = useRouter();
  const def = getProcedureDefinition(PROCEDURE_TYPE_CODES.EXPENSE)!;
  const client = useMemo(() => createProcedureClient(PROCEDURE_TYPE_CODES.EXPENSE), []);
  const defaultPaymentMethods = useClubDefaultPaymentMethods();

  const [options, setOptions] = useState<ExpenseFormOptions | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [expenseId, setExpenseId] = useState('');
  const [expenseName, setExpenseName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [operatorPassword, setOperatorPassword] = useState('');
  const [value, setValue] = useState('');
  const [pay, setPay] = useState('');
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [movementTime, setMovementTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  // Planned expense: when the rest is due. The deadline shows up in Expense Deadlines until paid.
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [causal, setCausal] = useState('');
  const [payMode, setPayMode] = useState('cash');

  useEffect(() => {
    Promise.all([client.fetchFormOptions<ExpenseFormOptions>(), fetchCompanies()])
      .then(([opts, co]) => {
        setOptions(opts);
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
  const selectedCompany = companies.find((c) => c.id === companyId);
  const total = Number(value) || 0;
  const paid = pay === '' ? 0 : Number(pay);
  const rest = Math.max(0, total - paid);

  useEffect(() => {
    if (selectedExpense) setExpenseName(selectedExpense.name);
  }, [selectedExpense]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!options?.clubMemberId) return setError('The club account could not be identified.');
    if (!expenseName.trim()) return setError('Please select or enter an expense.');
    if (total <= 0) return setError('Amount must be greater than zero.');
    if (!operatorId) return setError('Please select an operator.');
    if (!operatorPassword.trim()) return setError('Operator password is required.');
    if (paid < 0) return setError('Payment cannot be negative.');
    if (paid > total) return setError('Payment cannot exceed total.');
    if (rest > 0 && !dueDate) return setError('Please set the planned payment date for the rest.');
    if (rest > 0 && dueDate < movementDate) {
      return setError('The planned payment date cannot be before the expense date.');
    }

    setSaving(true);
    try {
      await client.createRecord({
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
      });
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
            <ProcedureFormCell label="Club">
              <input
                type="text"
                value={options?.clubName ?? ''}
                readOnly
                disabled
                className={procedureReadonlyInputClass}
              />
            </ProcedureFormCell>
            <ProcedureFormCell label="Date">
              <input type="date" className={procedureInputClass} value={movementDate} onChange={(e) => setMovementDate(e.target.value)} />
            </ProcedureFormCell>
            <ProcedureFormCell label="Hour">
              <input type="time" className={procedureInputClass} value={movementTime} onChange={(e) => setMovementTime(e.target.value)} />
            </ProcedureFormCell>
          </ProcedureFormGrid>
        </ProcedureFormSection>

        <ProcedureFormSection title="Expense">
          <ProcedureFormGrid>
            <ProcedureFormCell label="Expense category">
              <select className={procedureInputClass} value={expenseId} onChange={(e) => setExpenseId(e.target.value)}>
                <option value="">Select or type below</option>
                {options?.expenses.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </ProcedureFormCell>
            <ProcedureFormCell label="Expense name">
              <input type="text" className={procedureInputClass} value={expenseName} onChange={(e) => setExpenseName(e.target.value)} />
            </ProcedureFormCell>
            <ProcedureFormCell label="Value">
              <input type="number" min="0" step="0.01" className={procedureInputClass} value={value} onChange={(e) => setValue(e.target.value)} />
            </ProcedureFormCell>
            <ProcedureFormCell label="Pay now">
              <input type="number" min="0" step="0.01" placeholder="0 = planned, pay later" className={procedureHighlightInputClass} value={pay} onChange={(e) => setPay(e.target.value)} />
            </ProcedureFormCell>
            <ProcedureFormCell label="Planned payment date">
              <input
                type="date"
                className={rest > 0 ? procedureInputClass : procedureReadonlyInputClass}
                value={rest > 0 ? dueDate : movementDate}
                min={movementDate}
                disabled={rest <= 0}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </ProcedureFormCell>
            <ProcedureFormCell label="Causal">
              <input type="text" className={procedureInputClass} value={causal} onChange={(e) => setCausal(e.target.value)} />
            </ProcedureFormCell>
          </ProcedureFormGrid>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm bg-gray-50 p-3 rounded">
            <div>Total: <strong>€{total.toFixed(2)}</strong></div>
            <div>Paid: <strong>€{paid.toFixed(2)}</strong></div>
            <div>Rest: <strong className="text-red-600">€{rest.toFixed(2)}</strong></div>
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
            <ProcedureFormCell label="Operator">
              <select className={procedureInputClass} value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
                {options?.operators.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </ProcedureFormCell>
            <ProcedureFormCell label="Password">
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} className={procedureInputClass} value={operatorPassword} onChange={(e) => setOperatorPassword(e.target.value)} />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </ProcedureFormCell>
          </ProcedureFormGrid>
        </ProcedureFormSection>

        <ProcedureFormSection title="Company" titleClassName="text-green-800">
          <ProcedureFormGrid>
            <ProcedureFormCell label="Company">
              <select className={procedureInputClass} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </ProcedureFormCell>
          </ProcedureFormGrid>
        </ProcedureFormSection>

        {error && <div className="text-red-600 bg-red-50 border border-red-200 rounded px-4 py-2 text-sm">{error}</div>}

        <div className="flex justify-center gap-3">
          <button type="submit" disabled={saving} className="px-6 py-2 bg-red-700 text-white rounded disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={() => router.push(def.routes.records)} className="px-6 py-2 bg-gray-200 rounded">Cancel</button>
        </div>
      </form>

    </>
  );
}
