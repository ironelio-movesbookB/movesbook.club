'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { ProcedureTab } from './types';

type Props = {
  tabs: ProcedureTab[];
  activeTab: string;
  trailing?: ReactNode;
};

export default function ProcedureArchiveTabs({ tabs, activeTab, trailing }: Props) {
  const tabClass = (tabId: string, disabled?: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-t border-b-2 ${
      disabled
        ? 'border-transparent text-gray-300 cursor-not-allowed bg-gray-50'
        : activeTab === tabId
          ? 'border-teal-600 text-teal-700 bg-white'
          : 'border-transparent text-gray-600 hover:text-teal-600'
    }`;

  return (
    <div className="border-b border-gray-200 mb-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <nav className="flex flex-wrap gap-1 items-end min-w-0">
          {tabs.map((tab) => {
            if (tab.onClick) {
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={tab.onClick}
                  disabled={tab.disabled}
                  className={tabClass(tab.id, tab.disabled)}
                  title={
                    tab.disabled
                      ? 'Select 2+ deadlines of the same member with Rest > 0'
                      : undefined
                  }
                >
                  {tab.label}
                </button>
              );
            }
            if (!tab.href) return null;
            // The active tab marks where you already are — on the payment form it must never
            // navigate back to the archive grid behind it.
            if (tab.id === activeTab) {
              return (
                <span key={tab.id} aria-current="page" className={tabClass(tab.id)}>
                  {tab.label}
                </span>
              );
            }
            return (
              <Link key={tab.id} href={tab.href} className={tabClass(tab.id)}>
                {tab.label}
              </Link>
            );
          })}
        </nav>
        {trailing ? <div className="pb-2 shrink-0">{trailing}</div> : null}
      </div>
    </div>
  );
}
