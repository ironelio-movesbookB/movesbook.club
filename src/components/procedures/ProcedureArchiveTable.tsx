'use client';

import React, { useMemo, useState } from 'react';
import type { Column, Member } from './types';
import ArchiveSortHeader from '@/components/procedures/ArchiveSortHeader';
import {
  isColumnSortable,
  nextArchiveSort,
  sortArchiveRows,
  type ArchiveSortState,
} from '@/components/procedures/archiveColumnSort';

type Props = {
  columns: Column[];
  rows: Member[];
  selectedId?: string | null;
  onRowClick?: (row: Member) => void;
  onRowDoubleClick?: (row: Member) => void;
  loading?: boolean;
  emptyMessage?: string;
  /** Multi-select checkboxes (Archive of Deadlines → pay more). */
  selectable?: boolean;
  /** When true, all rows with an id can be selected (alias for selectOnlyOpenRest=false). */
  selectableAll?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (row: Member) => void;
  onToggleSelectAll?: (checked: boolean) => void;
  /**
   * When selectable: only rows with Rest > 0 can be checked (deadline pay flow).
   * Set false for archives where every row is selectable (e.g. Cash movements).
   */
  selectOnlyOpenRest?: boolean;
  /**
   * Optional controlled sort. When `onSortChange` is set, the table does not
   * reorder rows itself (parent / API should). Otherwise sorts the current page client-side.
   */
  sort?: ArchiveSortState | null;
  onSortChange?: (next: ArchiveSortState) => void;
  /** Extra classes on each data row (e.g. status text color). */
  getRowClassName?: (row: Member) => string;
};

const ACTION_KEYS = new Set(['edit', 'delete', 'options']);

export default function ProcedureArchiveTable({
  columns,
  rows,
  selectedId,
  onRowClick,
  onRowDoubleClick,
  loading,
  emptyMessage = 'No records found.',
  selectable,
  selectableAll = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  selectOnlyOpenRest = true,
  sort: controlledSort,
  onSortChange,
  getRowClassName,
}: Props) {
  const [internalSort, setInternalSort] = useState<ArchiveSortState | null>(null);
  const sort = controlledSort !== undefined ? controlledSort : internalSort;
  const clientSort = !onSortChange;

  const displayRows = useMemo(
    () => (clientSort ? sortArchiveRows(rows, sort) : rows),
    [clientSort, rows, sort]
  );

  function handleSort(key: keyof Member) {
    const next = nextArchiveSort(sort, key);
    if (onSortChange) onSortChange(next);
    else setInternalSort(next);
  }

  const rowIsCheckable = (r: Member) =>
    Boolean(r.id) &&
    (selectableAll || !selectOnlyOpenRest || (r.rest ?? 0) > 0);
  const selectableRows = displayRows.filter(rowIsCheckable);
  const allSelectableChecked =
    selectableRows.length > 0 &&
    selectableRows.every((r) => r.id && selectedIds?.has(r.id));

  // Wide archives scroll sideways, so the trailing action columns are pinned to the right edge as
  // a single cell and stay reachable without scrolling.
  let actionCount = 0;
  for (let i = columns.length - 1; i >= 0; i -= 1) {
    if (!ACTION_KEYS.has(String(columns[i]!.key))) break;
    actionCount += 1;
  }
  const dataColumns = actionCount > 0 ? columns.slice(0, columns.length - actionCount) : columns;
  const actionColumns = actionCount > 0 ? columns.slice(columns.length - actionCount) : [];

  const colSpan =
    dataColumns.length + (actionColumns.length > 0 ? 1 : 0) + (selectable ? 1 : 0);

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-teal-800 text-white">
          <tr>
            {selectable && (
              <th className="px-2 py-2 w-10">
                <input
                  type="checkbox"
                  checked={allSelectableChecked}
                  disabled={loading || selectableRows.length === 0}
                  onChange={(e) => onToggleSelectAll?.(e.target.checked)}
                  aria-label={
                    !selectableAll && selectOnlyOpenRest
                      ? 'Select all with Rest > 0'
                      : 'Select all'
                  }
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
            )}
            {dataColumns.map((col) => {
              const sortable = isColumnSortable(col.key, col.sortable);
              const active = sort?.key === col.key;
              return (
                <th key={String(col.key)} className="px-3 py-2 text-left whitespace-nowrap">
                  <ArchiveSortHeader
                    label={col.header}
                    sortable={sortable}
                    active={active}
                    direction={active ? sort!.dir : 'asc'}
                    onSort={() => handleSort(col.key)}
                  />
                </th>
              );
            })}
            {actionColumns.length > 0 && (
              <th className="sticky right-0 z-20 border-l border-teal-700 bg-teal-800 px-3 py-2 text-left whitespace-nowrap">
                <span className="flex items-center gap-4">
                  {actionColumns.map((col) => (
                    <span key={String(col.key)}>{col.header}</span>
                  ))}
                </span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={Math.max(colSpan, 1)} className="px-3 py-8 text-center text-gray-500">
                Loading...
              </td>
            </tr>
          ) : displayRows.length === 0 ? (
            <tr>
              <td colSpan={Math.max(colSpan, 1)} className="px-3 py-8 text-center text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            displayRows.map((row) => {
              const isSelected = selectedId && row.id === selectedId;
              const isChecked = Boolean(row.id && selectedIds?.has(row.id));
              const canCheck = rowIsCheckable(row);
              // Pinned cells need the row's own background, hover included, or the scrolled
              // columns show through them.
              const rowBg = row.isDuplicate
                ? 'bg-red-100'
                : isChecked
                  ? 'bg-amber-50'
                  : isSelected
                    ? 'bg-amber-100'
                    : 'bg-white';
              const rowHover = row.isDuplicate ? 'hover:bg-red-200' : 'hover:bg-teal-50';
              const actionHover = row.isDuplicate
                ? 'group-hover:bg-red-200'
                : 'group-hover:bg-teal-50';
              const statusClass = getRowClassName?.(row) ?? '';
              return (
                <tr
                  key={row.id ?? `${row.name}-${row.insertDate}`}
                  className={`group border-t cursor-pointer ${rowBg} ${rowHover} ${
                    row.isDuplicate ? 'text-red-800' : ''
                  } ${statusClass}`}
                  onClick={() => onRowClick?.(row)}
                  onDoubleClick={() => onRowDoubleClick?.(row)}
                >
                  {selectable && (
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!canCheck}
                        onChange={() => row.id && canCheck && onToggleSelect?.(row)}
                        aria-label={`Select ${row.name ?? row.id}`}
                      />
                    </td>
                  )}
                  {dataColumns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={`px-3 py-2 whitespace-nowrap ${statusClass || 'text-gray-800'}`}
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : (row[col.key] as React.ReactNode) ?? '-'}
                    </td>
                  ))}
                  {actionColumns.length > 0 && (
                    <td
                      className={`sticky right-0 z-10 border-l border-gray-200 px-3 py-2 text-gray-800 whitespace-nowrap ${rowBg} ${actionHover}`}
                    >
                      <span className="flex items-center gap-4">
                        {actionColumns.map((col) => (
                          <span key={String(col.key)}>
                            {col.render
                              ? col.render(row[col.key], row)
                              : (row[col.key] as React.ReactNode) ?? '-'}
                          </span>
                        ))}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
