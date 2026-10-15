'use client';

import React from 'react';
import Link from 'next/link';
import type { SubscriptionListRow, SubscriptionUserType } from '@/types/adminSubscriptionSettings';
import {
  CLUB_TEMPLATE_ROWS,
  formatNotifyChannels,
  getEditHref,
  getUserTypeLabel,
} from '@/lib/admin/subscriptionSettingsMock';
import { hasCreatableCompaniesSetting } from '@/lib/admin/subscriptionEditSettingsLayout';

const TABLE_COLUMN_COUNT = 21;

type SubscriptionSettingsTableProps = {
  rows: SubscriptionListRow[];
  userTypeFilter?: SubscriptionUserType | null;
  showFreeLabel?: boolean;
  onShowFreeLabelChange?: (value: boolean) => void;
  defaultRowId?: number;
  onDefaultChange?: (id: number) => void;
};

function formatValue(value: number, showFree: boolean): string {
  if (showFree && value === 0) return 'Free';
  return String(value);
}

function formatManageableUsersValue(row: SubscriptionListRow, value: number): string {
  if (!hasCreatableCompaniesSetting(row.userType)) return '—';
  return String(value);
}

function SubscriptionTable({
  rows,
  showFreeLabel,
  defaultRowId,
  onDefaultChange,
  showCategoryHeaders = true,
}: {
  rows: SubscriptionListRow[];
  showFreeLabel: boolean;
  defaultRowId?: number;
  onDefaultChange?: (id: number) => void;
  showCategoryHeaders?: boolean;
}) {
  let lastType: SubscriptionUserType | null = null;

  return (
    <table className="w-full text-xs border-collapse border border-gray-300">
      <thead>
        <tr className="bg-[#5bc0de] text-white">
          <th className="border border-gray-300 px-2 py-2 text-center font-bold" colSpan={2}>
            Default Settings
          </th>
          <th className="border border-gray-300 px-2 py-2 text-center font-bold">cod</th>
          <th className="border border-gray-300 px-2 py-2 text-left font-bold">Name Subscription</th>
          <th className="border border-gray-300 px-2 py-2 text-center font-bold" colSpan={2}>
            Days
          </th>
          <th className="border border-gray-300 px-2 py-2 text-center font-bold" colSpan={2}>
            Price
          </th>
          <th className="border border-gray-300 px-2 py-2 text-center font-bold" colSpan={4}>
            Credits
          </th>
          <th className="border border-gray-300 px-2 py-2 text-center font-bold" colSpan={4}>
            User that can be invited
          </th>
          <th className="border border-gray-300 px-2 py-2 text-center font-bold" colSpan={3}>
            Max number of manageable users
          </th>
          <th className="border border-gray-300 px-2 py-2 text-center font-bold">
            Notify at expiration
          </th>
          <th className="border border-gray-300 px-2 py-2 text-center font-bold">Action</th>
        </tr>
        <tr className="bg-[#5bc0de] text-white">
          <th className="border border-gray-300 px-1 py-1" />
          <th className="border border-gray-300 px-1 py-1" />
          <th className="border border-gray-300 px-1 py-1" />
          <th className="border border-gray-300 px-1 py-1" />
          <th className="border border-gray-300 px-1 py-1 text-center">Days1</th>
          <th className="border border-gray-300 px-1 py-1 text-center">Days2</th>
          <th className="border border-gray-300 px-1 py-1 text-center">Price1</th>
          <th className="border border-gray-300 px-1 py-1 text-center">Price2</th>
          <th className="border border-gray-300 px-1 py-1 text-center">Credit1</th>
          <th className="border border-gray-300 px-1 py-1 text-center">Credit2</th>
          <th className="border border-gray-300 px-1 py-1 text-center">Credit3</th>
          <th className="border border-gray-300 px-1 py-1 text-center">Credit4</th>
          <th className="border border-gray-300 px-1 py-1 text-center">A</th>
          <th className="border border-gray-300 px-1 py-1 text-center">T</th>
          <th className="border border-gray-300 px-1 py-1 text-center">G</th>
          <th className="border border-gray-300 px-1 py-1 text-center">C</th>
          <th className="border border-gray-300 px-1 py-1 text-center bg-[#fffacd] text-red-600 font-bold">
            Creatable companies
          </th>
          <th className="border border-gray-300 px-1 py-1 text-center bg-[#fffacd] font-bold text-gray-900">
            Users - 1th subscription
          </th>
          <th className="border border-gray-300 px-1 py-1 text-center bg-[#fffacd] font-bold text-gray-900">
            Users - next subscriptions
          </th>
          <th className="border border-gray-300 px-1 py-1" />
          <th className="border border-gray-300 px-1 py-1" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const showHeader = showCategoryHeaders && row.userType !== lastType;
          if (showHeader) lastType = row.userType;

          return (
            <React.Fragment key={row.id}>
              {showHeader ? (
                <tr className="bg-[#d9d9d9]">
                  <td
                    colSpan={TABLE_COLUMN_COUNT}
                    className="border border-gray-300 px-3 py-1.5 font-bold text-gray-800 text-sm"
                  >
                    {getUserTypeLabel(row.userType)}
                  </td>
                </tr>
              ) : null}
              <tr className={index % 2 === 0 ? 'bg-white' : 'bg-[#f9f9f9]'}>
                <td className="border border-gray-300 px-2 py-1.5 text-center w-8">
                  <input
                    type="radio"
                    name="default-subscription"
                    checked={(defaultRowId ?? rows.find((r) => r.isDefault)?.id) === row.id}
                    onChange={() => onDefaultChange?.(row.id)}
                    className="cursor-pointer"
                  />
                </td>
                <td className="border border-gray-300 w-2" />
                <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">
                  {row.code}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-gray-700">{row.name}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">
                  {formatValue(row.days1, showFreeLabel)}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">
                  {formatValue(row.days2, showFreeLabel)}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">
                  {formatValue(row.price1, showFreeLabel)}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">
                  {formatValue(row.price2, showFreeLabel)}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">
                  {formatValue(row.credit1, showFreeLabel)}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">
                  {formatValue(row.credit2, showFreeLabel)}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">
                  {formatValue(row.credit3, showFreeLabel)}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">
                  {formatValue(row.credit4, showFreeLabel)}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">
                  {row.inviteAthletes}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">
                  {row.inviteTeams}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">
                  {row.inviteGroups}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">
                  {row.inviteClubs}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700 bg-[#fffacd]/40">
                  {formatManageableUsersValue(row, row.creatableCompanies)}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700 bg-[#fffacd]/40">
                  {formatManageableUsersValue(row, row.usersFirstSubscription)}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700 bg-[#fffacd]/40">
                  {formatManageableUsersValue(row, row.usersRenewal)}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-600 text-[11px]">
                  {formatNotifyChannels(row.notifyChannels)}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center">
                  <Link
                    href={getEditHref(row)}
                    className="text-[#337ab7] hover:underline font-semibold"
                  >
                    Setting
                  </Link>
                </td>
              </tr>
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

export default function SubscriptionSettingsTable({
  rows,
  userTypeFilter,
  showFreeLabel = false,
  onShowFreeLabelChange,
  defaultRowId,
  onDefaultChange,
}: SubscriptionSettingsTableProps) {
  const isClubView = userTypeFilter === 'club';

  return (
    <div className="flex-1 bg-white p-6 overflow-x-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Settings Subscription</h2>

      <label className="flex items-center gap-2 mb-4 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={showFreeLabel}
          onChange={(e) => onShowFreeLabelChange?.(e.target.checked)}
          className="cursor-pointer"
        />
        Put the display to user instead of all values = 0 the word &apos;Free&apos;
      </label>

      <div className="bg-[#d9edf7] border border-[#bce8f1] text-[#31708f] px-4 py-3 mb-6 text-sm flex items-start gap-2">
        <span className="text-lg leading-none">🔧</span>
        <p>
          This section allows to calibrate and set the parameters for each of the versions of the
          system for Single Users, Coaches, Teams, Groups and Clubs Subscriptions.
        </p>
      </div>

      {isClubView ? (
        <div className="space-y-8">
          <SubscriptionTable
            rows={rows}
            showFreeLabel={showFreeLabel}
            defaultRowId={defaultRowId}
            onDefaultChange={onDefaultChange}
            showCategoryHeaders={false}
          />
          <SubscriptionTable
            rows={CLUB_TEMPLATE_ROWS}
            showFreeLabel={showFreeLabel}
            showCategoryHeaders={false}
          />
        </div>
      ) : (
        <SubscriptionTable
          rows={rows}
          showFreeLabel={showFreeLabel}
          defaultRowId={defaultRowId}
          onDefaultChange={onDefaultChange}
        />
      )}
    </div>
  );
}
