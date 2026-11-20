'use client';

import { useState } from 'react';
import Link from 'next/link';

const INCOMING = [
  { id: 'memberships', label: 'Memberships', href: '/clubs/memberships/deadlines', procedureType: 'membership' },
  { id: 'subscriptions', label: 'Subscriptions', href: '/clubs/courses/deadlines', procedureType: 'course_subscription' },
  { id: 'services', label: 'Services', href: '/clubs/dead_line', procedureType: 'service_sale' },
  { id: 'sellings', label: 'Sellings', href: '/ArchiveSeles/product_deadline', procedureType: 'product_sale' },
  { id: 'member_debts', label: 'Member debts', href: '/clubs/member_debt_dead_line', procedureType: 'member_debt' },
] as const;

const OUTGOING = [
  { id: 'member_credits', label: 'Member credits', href: '/clubs/member_credit_dead_line', procedureType: 'member_credit' },
  { id: 'employ_to_pay', label: 'Employ to pay', href: '/clubs/member_credit_dead_line', procedureType: 'member_credit' },
] as const;

type Props = {
  /** Path of the current deadlines archive — that pill is highlighted. */
  activeHref?: string | null;
  /** Highlight the expense-only view in the unified deadlines archive. */
  expensesActive?: boolean;
  selectedProcedureType?: string | null;
  onSelectProcedureType?: (procedureType: string | null) => void;
  selectedDirection?: 'IN' | 'OUT' | null;
  onSelectDirection?: (direction: 'IN' | 'OUT') => void;
};

function TypologyPill({
  href,
  label,
  active,
  direction,
  procedureType,
  onSelectProcedureType,
}: {
  href: string;
  label: string;
  active: boolean;
  direction: "in" | "out";
  procedureType: string;
  onSelectProcedureType?: (procedureType: string | null) => void;
}) {
  const directionClass =
    direction === "in"
      ? "bg-[#064e3b] hover:bg-[#043b2d]"
      : "bg-[#b91c1c] hover:bg-[#991b1b]";
  const className = `rounded px-3 py-1 text-[13px] font-bold text-white shadow-sm ${directionClass} ${active ? "ring-2 ring-yellow-400" : ""}`;

  if (onSelectProcedureType) {
    return (
      <button
        type="button"
        onClick={() => onSelectProcedureType(procedureType)}
        aria-pressed={active}
        className={className}
      >
        {label}
      </button>
    );
  }

  return (
    <Link
      href={href}
      className={className}
    >
      {label}
    </Link>
  );
}

/**
 * Incoming / outgoing typology switcher shown above deadline archive tabs
 * (PHP archive_deadlines header + per-typology deadline pages).
 */
export default function DeadlineTypologyNav({
  activeHref,
  expensesActive = false,
  selectedProcedureType,
  onSelectProcedureType,
  selectedDirection,
  onSelectDirection,
}: Props) {
  const [hideIncoming, setHideIncoming] = useState(false);
  const [hideOutgoing, setHideOutgoing] = useState(false);

  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="flex flex-wrap items-center gap-1">
        {!hideIncoming && (
          <>
            <span className="mr-2 text-xs font-bold text-[#064e3b]">
              Deadlines incoming - Payment will be IN
            </span>
            {INCOMING.map((b) => (
              <TypologyPill
                key={b.id}
                href={b.href}
                label={b.label}
                active={onSelectProcedureType
                  ? selectedProcedureType === b.procedureType
                  : Boolean(activeHref && activeHref === b.href)}
                direction="in"
                procedureType={b.procedureType}
                onSelectProcedureType={onSelectProcedureType}
              />
            ))}
            {onSelectDirection && (
              <button
                type="button"
                onClick={() => onSelectDirection('IN')}
                aria-pressed={selectedDirection === 'IN'}
                className={`rounded border border-green-800 px-3 py-1 text-[13px] font-semibold text-green-900 hover:bg-green-50 ${selectedDirection === 'IN' ? 'ring-2 ring-yellow-400' : ''}`}
              >
                All expenses IN
              </button>
            )}
          </>
        )}
        {onSelectDirection && (
          <button
            type="button"
            onClick={() => onSelectDirection('IN')}
            aria-pressed={selectedDirection === 'IN'}
            className={`rounded border border-green-800 px-3 py-1 text-[13px] font-semibold text-green-900 hover:bg-green-50 ${selectedDirection === 'IN' ? 'ring-2 ring-yellow-400' : ''}`}
          >
            All expenses IN
          </button>
        )}
        <label className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-[#064e3b]">
          <input
            type="checkbox"
            checked={hideIncoming}
            onChange={(event) => setHideIncoming(event.target.checked)}
            className="h-4 w-4"
          />
          Hide Deadlines IN
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t border-gray-100 pt-2">
        {!hideOutgoing && (
          <>
            <span className="mr-2 text-xs font-bold text-red-700">
              Deadlines outgoing - Payment will be OUT
            </span>
            {OUTGOING.map((b) => (
              <TypologyPill
                key={b.id}
                href={b.href}
                label={b.label}
                active={onSelectProcedureType
                  ? selectedProcedureType === b.procedureType
                  : Boolean(activeHref && activeHref === b.href)}
                direction="out"
                procedureType={b.procedureType}
                onSelectProcedureType={onSelectProcedureType}
              />
            ))}
            {onSelectProcedureType ? (
              <button
                type="button"
                onClick={() => onSelectProcedureType('expense')}
                aria-pressed={selectedProcedureType === 'expense'}
                className={`rounded border border-red-600 px-2 py-1 text-[13px] font-semibold text-red-700 hover:bg-red-50 ${selectedProcedureType === 'expense' ? "ring-2 ring-yellow-400" : ""}`}
              >
                All other expenses
              </button>
            ) : (
              <Link
                href="/clubs/archive_deadlines?procedureType=expense"
                className={`rounded border border-red-600 px-2 py-1 text-[13px] font-semibold text-red-700 hover:bg-red-50 ${expensesActive ? "ring-2 ring-yellow-400" : ""}`}
              >
                All other expenses
              </Link>
            )}
            {onSelectDirection && (
              <button
                type="button"
                onClick={() => onSelectDirection('OUT')}
                aria-pressed={selectedDirection === 'OUT'}
                className={`rounded border border-red-600 px-3 py-1 text-[13px] font-semibold text-red-700 hover:bg-red-50 ${selectedDirection === 'OUT' ? 'ring-2 ring-yellow-400' : ''}`}
              >
                All expenses OUT
              </button>
            )}
          </>
        )}
        <label className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-red-700">
          <input
            type="checkbox"
            checked={hideOutgoing}
            onChange={(event) => setHideOutgoing(event.target.checked)}
            className="h-4 w-4"
          />
          Hide Deadlines OUT
        </label>
      </div>
    </div>
  );
}
