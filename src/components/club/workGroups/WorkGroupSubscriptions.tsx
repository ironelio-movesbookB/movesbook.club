'use client';

import { BarChart3, ClipboardList, Columns, LayoutList, Mail, Send, Share2, Trash2 } from 'lucide-react';

const COLUMNS = ['Image', 'Member', 'Subscription', 'Start', 'End', 'Amount', 'Installments'];

/** Grid of the subscriptions to the group. Rows arrive with the subscription form (not built yet). */
export default function WorkGroupSubscriptions() {
  const toolButton = 'inline-flex items-center gap-1.5 text-sm text-gray-400 cursor-not-allowed';
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="bg-[#14594a] px-4 py-3 text-base font-semibold text-white">Manage subscriptions</div>
      <div className="space-y-4 p-4">
        <div className="rounded-md border border-teal-100 bg-teal-50/60 p-3">
          <p className="mb-2 text-xs font-semibold text-teal-900">Filter · Manage subscriptions</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-end">
            <label className="text-xs font-semibold text-gray-700">
              Search
              <input disabled placeholder="Name, subscription, notes..." className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-gray-700">
              From
              <input disabled type="date" className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-gray-700">
              To
              <input disabled type="date" className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-gray-700">
              Order
              <select disabled className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                <option>Most recent</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button type="button" disabled className="rounded-md bg-[#14594a] px-4 py-2 text-sm font-semibold text-white opacity-60">
                Filter
              </button>
              <button type="button" disabled className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 opacity-60">
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex flex-wrap gap-4">
            <span className={toolButton}><Mail className="h-4 w-4" /> Send msg</span>
            <span className={toolButton}><Send className="h-4 w-4" /> Send data</span>
            <span className={toolButton}><Share2 className="h-4 w-4" /> Share</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <span className={toolButton}><ClipboardList className="h-4 w-4" /> Totals</span>
            <span className={toolButton}><BarChart3 className="h-4 w-4" /> Statistics</span>
            <span className={toolButton}><Trash2 className="h-4 w-4" /> Delete</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <select disabled className="rounded-md border border-gray-300 px-2 py-1.5">
              <option>25</option>
            </select>
            <button type="button" disabled className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-400">Prev</button>
            <span className="rounded-md bg-gray-900 px-3 py-1.5 font-semibold text-white">1</span>
            <button type="button" disabled className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-400">Next</button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled className="rounded-md bg-gray-700 px-4 py-1.5 text-sm font-semibold text-white opacity-60">Print</button>
            <span className="rounded-md border border-yellow-400 p-1.5 text-gray-500"><Columns className="h-4 w-4" /></span>
            <span className="rounded-md border border-gray-200 p-1.5 text-gray-400"><LayoutList className="h-4 w-4" /></span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-[#14594a] text-left text-white">
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c} className="px-3 py-2.5 font-semibold">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-10 text-center text-red-600">
                  There are no subscriptions at the moment
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">
          Subscriptions to this group will appear here once the subscription form for groups is available.
        </p>
      </div>
    </div>
  );
}
