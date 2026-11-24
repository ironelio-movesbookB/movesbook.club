'use client';

import Link from 'next/link';

const INCOMING = [
  { id: 'memberships', label: 'Memberships', href: '/clubs/memberships/deadlines' },
  { id: 'subscriptions', label: 'Subscriptions', href: '/clubs/courses/deadlines' },
  { id: 'services', label: 'Services', href: '/clubs/dead_line' },
  { id: 'sellings', label: 'Sellings', href: '/ArchiveSeles/product_deadline' },
  { id: 'member_debts', label: 'Member debts', href: '/clubs/member_debt_dead_line' },
] as const;

const OUTGOING = [
  { id: 'member_credits', label: 'Member credits', href: '/clubs/member_credit_dead_line' },
  { id: 'employ_to_pay', label: 'Employ to pay', href: '/clubs/member_credit_dead_line' },
] as const;

type Props = {
  /** Path of the current deadlines archive — that pill is highlighted. */
  activeHref?: string | null;
};

function TypologyPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 text-[13px] font-bold text-white rounded shadow-sm ${
        active ? 'bg-blue-600 ring-2 ring-blue-300' : 'bg-[#222] hover:bg-black'
      }`}
    >
      {label}
    </Link>
  );
}

/**
 * Incoming / outgoing typology switcher shown above deadline archive tabs
 * (PHP archive_deadlines header + per-typology deadline pages).
 */
export default function DeadlineTypologyNav({ activeHref }: Props) {
  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-xs font-bold text-red-600 mr-2">
          Deadlines incoming - Payment will be IN
        </span>
        {INCOMING.map((b) => (
          <TypologyPill
            key={b.id}
            href={b.href}
            label={b.label}
            active={Boolean(activeHref && activeHref === b.href)}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t border-gray-100 pt-2">
        <span className="text-xs font-bold text-red-600 mr-2">
          Deadlines outcoming - Payment will be OUT
        </span>
        {OUTGOING.map((b) => (
          <TypologyPill
            key={b.id}
            href={b.href}
            label={b.label}
            active={Boolean(activeHref && activeHref === b.href)}
          />
        ))}
      </div>
    </div>
  );
}
