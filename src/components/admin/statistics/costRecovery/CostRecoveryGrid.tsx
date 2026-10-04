'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import {
  COST_RECOVERY_LANGUAGES,
  COST_RECOVERY_TYPES,
  type CostRecoveryCell,
  type CostRecoveryPlan,
  type CostRecoveryType,
} from '@/lib/admin/costRecoveryTypes';

const PLAN_COLOR = '#555555';
const REAL_COLOR = '#000000';
const DIFF_NEGATIVE = '#e01b00';
const DIFF_POSITIVE = '#0b6b2b';

const HEAD_PARAMS = '#0c343d';
const HEAD_LANG = '#45818e';
const HEAD_PLAN = '#3c78d8';
const HEAD_REAL = '#45818e';
const TOTALS_HEAD = '#990000';
const GREY_CELL = '#c4c4c4';
const GREY_TOTALS = '#6b6b6b';

type Props = {
  plan: CostRecoveryPlan;
  real: Record<string, Record<CostRecoveryType, CostRecoveryCell>>;
  dirty: boolean;
  saving: boolean;
  onCostChange: (type: CostRecoveryType, cost: number) => void;
  onPlanChange: (language: string, type: CostRecoveryType, n: number) => void;
  onApply: () => void;
  onChartTrend: (type: CostRecoveryType) => void;
  onLanguageOpen: (language: string) => void;
};

export function formatGridNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2, useGrouping: false });
}

function Diff({ value }: { value: number }) {
  const color = value < 0 ? DIFF_NEGATIVE : value > 0 ? DIFF_POSITIVE : PLAN_COLOR;
  return <span style={{ color }}>{value > 0 ? `+${formatGridNumber(value)}` : formatGridNumber(value)}</span>;
}

function Td({
  children,
  className = '',
  style,
  grey,
}: {
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  grey?: string;
}) {
  return (
    <td
      className={`h-9 border border-gray-300 px-1 text-center text-sm ${className}`}
      style={{ ...style, ...(grey ? { background: grey } : {}) }}
    >
      {grey ? null : children}
    </td>
  );
}

/** Cost in € with up to 2 decimals; accepts both "," and "." as decimal separator. */
function CostInput({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (cost: number) => void;
}) {
  const [draft, setDraft] = useState(value ? String(value) : '');
  useEffect(() => {
    setDraft((d) => (Number(d.replace(',', '.')) === value ? d : value ? String(value) : ''));
  }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      placeholder="0"
      onChange={(e) => {
        const next = e.target.value.replace(/[^\d.,]/g, '');
        if (!/^\d*([.,]\d{0,2})?$/.test(next)) return;
        setDraft(next);
        onChange(Number(next.replace(',', '.')) || 0);
      }}
      className="w-20 border border-[#d9b75a] bg-[#fde7a8] px-1.5 py-1 text-center text-sm font-semibold"
      style={{ color: PLAN_COLOR }}
      aria-label={label}
    />
  );
}

/** Whole numbers only: blocks decimal separators, exponent and sign keys. */
function blockNonInteger(e: React.KeyboardEvent<HTMLInputElement>) {
  if (['.', ',', 'e', 'E', '-', '+'].includes(e.key)) e.preventDefault();
}

export default function CostRecoveryGrid({
  plan,
  real,
  dirty,
  saving,
  onCostChange,
  onPlanChange,
  onApply,
  onChartTrend,
  onLanguageOpen,
}: Props) {
  const planEur = (lang: string, type: CostRecoveryType) =>
    Math.round(plan.costs[type] * (plan.planN[lang]?.[type] ?? 0) * 100) / 100;
  const realCell = (lang: string, type: CostRecoveryType) =>
    real[lang]?.[type] ?? { n: 0, eur: 0 };

  const typeTotals = (type: CostRecoveryType) =>
    COST_RECOVERY_LANGUAGES.reduce(
      (acc, l) => ({
        planN: acc.planN + (plan.planN[l.code]?.[type] ?? 0),
        planEur: acc.planEur + planEur(l.code, type),
        realN: acc.realN + realCell(l.code, type).n,
        realEur: acc.realEur + realCell(l.code, type).eur,
      }),
      { planN: 0, planEur: 0, realN: 0, realEur: 0 },
    );
  const languageEurTotals = (lang: string) =>
    COST_RECOVERY_TYPES.reduce(
      (acc, t) => ({
        plan: acc.plan + planEur(lang, t.id),
        real: acc.real + realCell(lang, t.id).eur,
      }),
      { plan: 0, real: 0 },
    );
  const grandEur = COST_RECOVERY_TYPES.reduce(
    (acc, t) => {
      const tt = typeTotals(t.id);
      return { plan: acc.plan + tt.planEur, real: acc.real + tt.realEur };
    },
    { plan: 0, real: 0 },
  );
  const round = (v: number) => Math.round(v * 100) / 100;

  const groupBorder = 'border-l-2 border-l-gray-500';

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] border-collapse bg-white text-gray-900">
        <colgroup>
          <col className="w-[120px]" />
          <col className="w-[28px]" />
          {[...COST_RECOVERY_TYPES, { id: 'totals' }].map((t) => (
            <Fragment key={t.id}>
              <col />
              <col />
              <col />
            </Fragment>
          ))}
        </colgroup>
        <thead>
          {/* Cost per subscription, one per type of user */}
          <tr className="bg-[#fdf6d8]">
            <th colSpan={2} className="sticky left-0 z-10 border-y border-l border-[#e6dcae] bg-[#fdf6d8]" />
            {COST_RECOVERY_TYPES.map((t) => (
              <th key={t.id} colSpan={3} className="border-y border-[#e6dcae] px-2 py-2.5">
                <label className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-800">
                  Cost
                  <CostInput
                    value={plan.costs[t.id]}
                    label={`Cost of a ${t.label} subscription`}
                    onChange={(cost) => onCostChange(t.id, cost)}
                  />
                </label>
              </th>
            ))}
            <th colSpan={3} className="border-y border-r border-[#e6dcae] px-2 py-2.5">
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={onApply}
                  disabled={saving || !dirty}
                  className="rounded border border-gray-400 bg-gradient-to-b from-white to-gray-200 px-4 py-1 text-sm font-semibold text-gray-800 shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Apply'}
                </button>
                <span className={`text-xs ${dirty ? 'text-[#e01b00]' : 'text-[#0b6b2b]'}`}>
                  {dirty ? 'Not saved' : 'Saved'}
                </span>
              </div>
            </th>
          </tr>
          <tr>
            <th colSpan={2} className="sticky left-0 z-10 bg-white" />
            {COST_RECOVERY_TYPES.map((t) => (
              <th key={t.id} colSpan={3} className="px-1 pt-3 pb-1">
                <button
                  type="button"
                  onClick={() => onChartTrend(t.id)}
                  className="w-full border border-gray-500 bg-gradient-to-b from-gray-100 to-gray-300 py-1 text-sm font-normal text-gray-900 hover:from-white"
                >
                  Chart trend
                </button>
              </th>
            ))}
            <th colSpan={3} />
          </tr>
          <tr>
            <th
              colSpan={2}
              className="sticky left-0 z-10 h-8 border border-gray-400 text-xs font-bold text-[#ffe600]"
              style={{ background: HEAD_PARAMS }}
            >
              Parameters analized
            </th>
            {COST_RECOVERY_TYPES.map((t) => (
              <th
                key={t.id}
                colSpan={3}
                className={`h-8 border border-gray-400 text-sm font-bold ${groupBorder}`}
                style={{ background: t.color, color: t.text }}
              >
                {t.label}
              </th>
            ))}
            <th
              colSpan={3}
              className={`h-8 border border-gray-400 text-base font-bold text-[#ffe600] ${groupBorder}`}
              style={{ background: TOTALS_HEAD }}
            >
              Totals
            </th>
          </tr>
          <tr className="text-sm font-bold text-white">
            <th colSpan={2} className="sticky left-0 z-10 h-8 border border-gray-400" style={{ background: HEAD_LANG }}>
              Languages
            </th>
            {[...COST_RECOVERY_TYPES.map((t) => t.id), 'totals'].map((id) => (
              <Fragment key={id}>
                <th className={`border border-gray-400 ${groupBorder}`} style={{ background: HEAD_PLAN }}>
                  Plan
                </th>
                <th className="border border-gray-400" style={{ background: HEAD_REAL }}>
                  Real
                </th>
                <th className="border border-gray-400" style={{ background: HEAD_REAL }}>
                  Diff
                </th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {COST_RECOVERY_LANGUAGES.map((l) => {
            const eurTotals = languageEurTotals(l.code);
            return (
              <Fragment key={l.code}>
                <tr>
                  <td
                    rowSpan={2}
                    className="sticky left-0 z-10 cursor-pointer select-none border border-gray-300 bg-white px-2 text-center text-sm font-semibold text-gray-800 hover:bg-[#eef6f7]"
                    onDoubleClick={() => onLanguageOpen(l.code)}
                    title="Double-click to see the graphs for each type of user"
                  >
                    {l.label}
                  </td>
                  <Td className="sticky left-[120px] z-10 bg-white text-xs font-bold">N°</Td>
                  {COST_RECOVERY_TYPES.map((t) => {
                    const planN = plan.planN[l.code]?.[t.id] ?? 0;
                    const r = realCell(l.code, t.id);
                    return (
                      <Fragment key={t.id}>
                        <Td className={groupBorder}>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            value={planN || ''}
                            placeholder="0"
                            onKeyDown={blockNonInteger}
                            onChange={(e) =>
                              onPlanChange(l.code, t.id, Math.max(0, Math.floor(Number(e.target.value) || 0)))
                            }
                            className="w-full min-w-0 border border-transparent bg-transparent text-center text-sm hover:border-gray-300 focus:border-[#3c78d8] focus:bg-white focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            style={{ color: PLAN_COLOR }}
                            aria-label={`Planned ${t.label} subscriptions — ${l.label}`}
                          />
                        </Td>
                        <Td style={{ color: REAL_COLOR }}>{formatGridNumber(r.n)}</Td>
                        <Td>
                          <Diff value={r.n - planN} />
                        </Td>
                      </Fragment>
                    );
                  })}
                  <Td className={groupBorder} grey={GREY_CELL} />
                  <Td grey={GREY_CELL} />
                  <Td grey={GREY_CELL} />
                </tr>
                <tr className="bg-[#f5f5f5]">
                  <Td className="sticky left-[120px] z-10 bg-[#f5f5f5] text-xs font-bold">€</Td>
                  {COST_RECOVERY_TYPES.map((t) => {
                    const p = planEur(l.code, t.id);
                    const r = realCell(l.code, t.id).eur;
                    return (
                      <Fragment key={t.id}>
                        <Td className={groupBorder} style={{ color: PLAN_COLOR }}>
                          {formatGridNumber(p)}
                        </Td>
                        <Td style={{ color: REAL_COLOR }}>{formatGridNumber(r)}</Td>
                        <Td>
                          <Diff value={round(r - p)} />
                        </Td>
                      </Fragment>
                    );
                  })}
                  <Td className={groupBorder} style={{ color: PLAN_COLOR }}>
                    {formatGridNumber(round(eurTotals.plan))}
                  </Td>
                  <Td className="font-bold" style={{ color: REAL_COLOR }}>
                    {formatGridNumber(round(eurTotals.real))}
                  </Td>
                  <Td>
                    <Diff value={round(eurTotals.real - eurTotals.plan)} />
                  </Td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-gray-500">
          <tr>
            <td rowSpan={2} className="sticky left-0 z-10 border border-gray-300 bg-white px-2 text-center text-sm font-bold text-gray-800">
              Totals
            </td>
            <Td className="sticky left-[120px] z-10 bg-white text-xs font-bold">N°</Td>
            {COST_RECOVERY_TYPES.map((t) => {
              const tt = typeTotals(t.id);
              return (
                <Fragment key={t.id}>
                  <Td className={groupBorder} style={{ color: PLAN_COLOR }}>
                    {formatGridNumber(tt.planN)}
                  </Td>
                  <Td className="font-bold" style={{ color: REAL_COLOR }}>
                    {formatGridNumber(tt.realN)}
                  </Td>
                  <Td>
                    <Diff value={tt.realN - tt.planN} />
                  </Td>
                </Fragment>
              );
            })}
            <Td className={groupBorder} grey={GREY_TOTALS} />
            <Td grey={GREY_TOTALS} />
            <Td grey={GREY_TOTALS} />
          </tr>
          <tr className="bg-[#f5f5f5]">
            <Td className="sticky left-[120px] z-10 bg-[#f5f5f5] text-xs font-bold">€</Td>
            {COST_RECOVERY_TYPES.map((t) => {
              const tt = typeTotals(t.id);
              return (
                <Fragment key={t.id}>
                  <Td className={groupBorder} style={{ color: PLAN_COLOR }}>
                    {formatGridNumber(round(tt.planEur))}
                  </Td>
                  <Td className="font-bold" style={{ color: REAL_COLOR }}>
                    {formatGridNumber(round(tt.realEur))}
                  </Td>
                  <Td>
                    <Diff value={round(tt.realEur - tt.planEur)} />
                  </Td>
                </Fragment>
              );
            })}
            <Td className={groupBorder} style={{ color: PLAN_COLOR }}>
              {formatGridNumber(round(grandEur.plan))}
            </Td>
            <Td className="font-bold" style={{ color: REAL_COLOR }}>
              {formatGridNumber(round(grandEur.real))}
            </Td>
            <Td>
              <Diff value={round(grandEur.real - grandEur.plan)} />
            </Td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
