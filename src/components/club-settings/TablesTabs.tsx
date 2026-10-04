'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getUserInfo } from '@/utils/auth.utils';
import { isTeamAccountUserType } from '@/utils/dashboardRouting';

type TablesTabsProps = {
  active: string;
};

const TABLE_TABS = [
  { key: 'areas', label: 'Areas', href: '/club/settings/tables/areas', enabled: true },
  { key: 'services', label: 'Services', href: '/club/settings/tables/services', enabled: true },
  { key: 'member_type', label: 'Member type', href: '/club/settings/tables/member_type', enabled: true },
  { key: 'professions', label: 'Professions', href: '/club/settings/tables/professions', enabled: true },
  { key: 'employees', label: 'Employees', href: '/club/settings/tables/employees', enabled: true },
  { key: 'contacts', label: 'Contacts', href: '/club/settings/tables/contacts', enabled: true },
  { key: 'list_of_the_expenses', label: 'List of the expenses', href: '/club/settings/tables/list_of_the_expenses', enabled: true },
  { key: 'category', label: 'Category', href: '/club/settings/tables/category', enabled: true },
  { key: 'unit', label: 'Unit', href: '/club/settings/tables/unit', enabled: true },
  { key: 'special_services', label: 'Special Services', href: '/club/settings/tables/special_services', enabled: true }
] as const;

/** Team admins only manage member types; the other tables are club-only. */
const TEAM_TABLE_KEYS = new Set<string>(['member_type']);

export default function TablesTabs({ active }: TablesTabsProps) {
  const [isTeamAccount, setIsTeamAccount] = useState(false);
  useEffect(() => {
    setIsTeamAccount(isTeamAccountUserType(String(getUserInfo()?.userType || '')));
  }, []);
  const tabs = isTeamAccount ? TABLE_TABS.filter((tab) => TEAM_TABLE_KEYS.has(tab.key)) : TABLE_TABS;

  return (
    <div className="overflow-x-auto border-b border-gray-200 bg-white">
      <div className="flex min-w-max items-center px-4">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          const className = `relative px-4 py-3 text-sm font-semibold transition ${
            isActive
              ? 'text-gray-950'
              : tab.enabled
                ? 'text-gray-500 hover:text-gray-950'
                : 'cursor-not-allowed text-gray-400'
          }`;

          const content = (
            <>
              {tab.label}
              {isActive && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-gray-950" />}
            </>
          );

          if (!tab.enabled) {
            return (
              <button key={tab.key} type="button" className={className} disabled title="Build this table later">
                {content}
              </button>
            );
          }

          return (
            <Link key={tab.key} href={tab.href} className={className}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
