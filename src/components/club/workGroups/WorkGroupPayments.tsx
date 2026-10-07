'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  DEADLINE_RECURRENCES,
  MAX_DEADLINES,
  formatEuro,
  formatWorkGroupDate,
  paymentPlanDates,
  paymentPlanDiscount,
  paymentPlanTotal,
  type WorkGroupPaymentPlan,
} from '@/lib/club/clubWorkGroup.constants';

type Props = {
  price: string;
  onPriceChange: (price: string) => void;
  plans: WorkGroupPaymentPlan[];
  onPlansChange: (plans: WorkGroupPaymentPlan[]) => void;
  defaultFirstDate: string;
};

type Draft = { recurrenceMonths: string; count: string; costEach: string; firstDate: string; showStatusAtCallUp: boolean };

const inputClass = 'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900';

function recurrenceLabel(months: number) {
  return DEADLINE_RECURRENCES.find((r) => r.months === months)?.label ?? '';
}

export default function WorkGroupPayments({ price, onPriceChange, plans, onPlansChange, defaultFirstDate }: Props) {
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [error, setError] = useState('');

  const openNew = () => {
    setError('');
    setEditing({
      id: null,
      draft: { recurrenceMonths: '1', count: '', costEach: '', firstDate: defaultFirstDate, showStatusAtCallUp: false },
    });
  };

  const openEdit = (plan: WorkGroupPaymentPlan) => {
    setError('');
    setEditing({
      id: plan.id,
      draft: {
        recurrenceMonths: String(plan.recurrenceMonths),
        count: String(plan.count),
        costEach: plan.costEach.toFixed(2),
        firstDate: plan.firstDate,
        showStatusAtCallUp: plan.showStatusAtCallUp,
      },
    });
  };

  const saveDraft = () => {
    if (!editing) return;
    const { draft } = editing;
    const count = Number(draft.count);
    const cost = Number(draft.costEach.replace(',', '.'));
    if (!Number.isInteger(count) || count < 1 || count > MAX_DEADLINES) {
      setError('The number of deadlines must be between 1 and 36');
      return;
    }
    if (!Number.isFinite(cost) || cost <= 0) {
      setError('Enter the cost of each deadline');
      return;
    }
    if (!draft.firstDate) {
      setError('Enter the date of the first deadline');
      return;
    }
    const plan: WorkGroupPaymentPlan = {
      id: editing.id ?? `plan-${Date.now()}`,
      recurrenceMonths: Number(draft.recurrenceMonths) as 1 | 2 | 3,
      count,
      costEach: Math.round(cost * 100) / 100,
      firstDate: draft.firstDate,
      showStatusAtCallUp: draft.showStatusAtCallUp,
    };
    onPlansChange(editing.id ? plans.map((p) => (p.id === editing.id ? plan : p)) : [...plans, plan]);
    setEditing(null);
  };

  const patchDraft = (patch: Partial<Draft>) =>
    setEditing((current) => (current ? { ...current, draft: { ...current.draft, ...patch } } : current));

  const draftCount = Number(editing?.draft.count);
  const draftCost = Number(editing?.draft.costEach.replace(',', '.'));
  const draftValid = Number.isInteger(draftCount) && draftCount > 0 && draftCount <= MAX_DEADLINES && draftCost > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block text-xs font-semibold text-gray-600">
          Price (single payment) <span>€</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => onPriceChange(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">Deadlines of payment</h4>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-md bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-800"
        >
          <Plus className="h-4 w-4" /> Add deadlines of payment
        </button>
      </div>

      {plans.length === 0 ? (
        <p className="text-sm text-gray-500">No deadlines of payment yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Recurrence</th>
                <th className="px-3 py-2">Deadlines</th>
                <th className="px-3 py-2">Cost of each deadline</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Discount</th>
                <th className="px-3 py-2">Payment status at the Call for athletes</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const discount = paymentPlanDiscount(plan, price);
                const dates = paymentPlanDates(plan);
                return (
                  <tr key={plan.id} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2">{recurrenceLabel(plan.recurrenceMonths)}</td>
                    <td className="px-3 py-2">
                      <span className="font-semibold">{plan.count}</span>
                      <div className="mt-1 flex max-w-xs flex-wrap gap-1">
                        {dates.map((d, i) => (
                          <span key={`${d}-${i}`} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                            {formatWorkGroupDate(d)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">{formatEuro(plan.costEach)}</td>
                    <td className="px-3 py-2 font-semibold">{formatEuro(paymentPlanTotal(plan))}</td>
                    <td className="px-3 py-2">
                      {discount === null ? (
                        '—'
                      ) : discount >= 0 ? (
                        <span className="font-semibold text-green-700">-{discount}%</span>
                      ) : (
                        <span className="font-semibold text-red-600">+{Math.abs(discount)}%</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{plan.showStatusAtCallUp ? 'Yes' : 'No'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button type="button" onClick={() => openEdit(plan)} className="p-1 text-gray-600 hover:text-violet-700" aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onPlansChange(plans.filter((p) => p.id !== plan.id))}
                        className="p-1 text-gray-600 hover:text-red-600"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500">
        The discount compares the total of the deadlines with the single payment price. The deadlines will be used for the subscription of the athletes.
      </p>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
              <h3 className="text-base font-semibold text-gray-900">Deadlines of payment</h3>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close modal" className="text-gray-500 hover:text-gray-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <label className="block text-xs font-semibold text-gray-600">
                Recurrence of the deadlines
                <select
                  value={editing.draft.recurrenceMonths}
                  onChange={(e) => patchDraft({ recurrenceMonths: e.target.value })}
                  className={inputClass}
                >
                  {DEADLINE_RECURRENCES.map((r) => (
                    <option key={r.months} value={r.months}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-gray-600">
                  Number of deadlines
                  <input
                    type="number"
                    min={1}
                    max={MAX_DEADLINES}
                    value={editing.draft.count}
                    onChange={(e) => patchDraft({ count: e.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  Cost of each deadline <span>€</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editing.draft.costEach}
                    onChange={(e) => patchDraft({ costEach: e.target.value })}
                    className={inputClass}
                  />
                </label>
              </div>
              <label className="block text-xs font-semibold text-gray-600">
                First deadline
                <input
                  type="date"
                  value={editing.draft.firstDate}
                  onChange={(e) => patchDraft({ firstDate: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={editing.draft.showStatusAtCallUp}
                  onChange={(e) => patchDraft({ showStatusAtCallUp: e.target.checked })}
                  className="h-4 w-4 accent-violet-700"
                />
                Display the payment status at the Call for athletes
              </label>
              {draftValid ? (
                <p className="rounded-md bg-violet-50 px-3 py-2 text-sm text-violet-900">
                  <span>Total</span>: <strong>{formatEuro(Math.round(draftCount * draftCost * 100) / 100)}</strong>
                </p>
              ) : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
              <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">
                Cancel
              </button>
              <button type="button" onClick={saveDraft} className="rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
