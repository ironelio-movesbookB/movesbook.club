'use client';

import ArchiveActionsBar from '@/components/procedures/ArchiveActionsBar';
import type { ReactNode } from 'react';

export type ArchiveOrderBy = 'recent' | 'old';

export type ArchiveListFilterValues = {
  search: string;
  fromDate: string;
  toDate: string;
  orderBy: ArchiveOrderBy;
};

export type ArchiveListFilterParams = {
  search?: string;
  fromDate?: string;
  toDate?: string;
  orderBy?: ArchiveOrderBy;
};

type Props = {
  title?: string;
  values: ArchiveListFilterValues;
  onChange: (patch: Partial<ArchiveListFilterValues>) => void;
  onApply: () => void;
  onClear: () => void;
  dateRangeError?: string;
  /** Legacy page selector + Print row. */
  pagination?: ReactNode;
  selectedCount?: number;
  onDeleteSelected?: () => void;
  /** Hide filter form (actions + pagination only). */
  hideFilters?: boolean;
};

const inputClass =
  'block h-9 w-full rounded border border-gray-400 bg-white px-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700';

/** Search / date / order filters + archive actions / page selector chrome. */
export default function ArchiveListToolbar({
  title = 'Filter',
  values,
  onChange,
  onApply,
  onClear,
  dateRangeError,
  pagination,
  selectedCount,
  onDeleteSelected,
  hideFilters = false,
}: Props) {
  return (
    <div className="mb-3">
      {!hideFilters && (
        <div className="mb-3 rounded-md border border-teal-800/20 bg-[#eef6f5] px-4 py-3">
          <div className="mb-2 text-[13px] font-semibold text-teal-900">{title}</div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onApply();
            }}
          >
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
              <label className="flex min-w-[180px] flex-1 flex-col">
                <span className="mb-1 block text-[12px] font-semibold text-gray-800">Search</span>
                <input
                  type="text"
                  className={inputClass}
                  value={values.search}
                  onChange={(e) => onChange({ search: e.target.value })}
                  placeholder="Name, typology, notes..."
                />
              </label>
              <label className="flex flex-col">
                <span className="mb-1 block text-[12px] font-semibold text-gray-800">From</span>
                <input
                  type="date"
                  className={`${inputClass} ${dateRangeError ? 'border-red-500 focus:border-red-600 focus:ring-red-500' : ''}`}
                  value={values.fromDate}
                  max={values.toDate || undefined}
                  onChange={(e) => onChange({ fromDate: e.target.value })}
                />
              </label>
              <label className="flex flex-col">
                <span className="mb-1 block text-[12px] font-semibold text-gray-800">To</span>
                <input
                  type="date"
                  className={`${inputClass} ${dateRangeError ? 'border-red-500 focus:border-red-600 focus:ring-red-500' : ''}`}
                  value={values.toDate}
                  min={values.fromDate || undefined}
                  onChange={(e) => onChange({ toDate: e.target.value })}
                />
              </label>
              <label className="flex min-w-[150px] flex-col">
                <span className="mb-1 block text-[12px] font-semibold text-gray-800">Order</span>
                <select
                  className={`${inputClass} !mb-0 leading-normal`}
                  value={values.orderBy}
                  onChange={(e) => onChange({ orderBy: e.target.value as ArchiveOrderBy })}
                >
                  <option value="recent">Most recent</option>
                  <option value="old">Oldest first</option>
                </select>
              </label>
              <div className="flex h-9 items-center gap-2 self-end">
                <button
                  type="submit"
                  className="h-9 rounded border border-teal-900 bg-teal-800 px-4 text-[13px] font-semibold text-white hover:bg-teal-900"
                >
                  Filter
                </button>
                <button
                  type="button"
                  onClick={onClear}
                  className="h-9 rounded border border-gray-400 bg-white px-4 text-[13px] font-semibold text-gray-800 hover:bg-gray-100"
                >
                  Clear
                </button>
              </div>
            </div>
            {dateRangeError && (
              <p className="mt-2 text-[12px] font-medium text-red-600">{dateRangeError}</p>
            )}
          </form>
        </div>
      )}

      <ArchiveActionsBar
        shareTitle={title}
        pagination={pagination}
        selectedCount={selectedCount}
        onDeleteSelected={onDeleteSelected}
      />
    </div>
  );
}

export function emptyArchiveFilterValues(): ArchiveListFilterValues {
  return { search: '', fromDate: '', toDate: '', orderBy: 'recent' };
}

export function toArchiveFilterParams(
  values: ArchiveListFilterValues
): ArchiveListFilterParams {
  return {
    search: values.search.trim() || undefined,
    fromDate: values.fromDate || undefined,
    toDate: values.toDate || undefined,
    orderBy: values.orderBy,
  };
}

export function validateArchiveDateRange(fromDate: string, toDate: string): string {
  if (fromDate && toDate && fromDate > toDate) {
    return '"From" date cannot be after "To" date.';
  }
  return '';
}
