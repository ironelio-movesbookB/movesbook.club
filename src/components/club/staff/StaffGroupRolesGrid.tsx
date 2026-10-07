'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import { formatYmd, type StaffGroupLink } from '@/lib/club/clubStaffAdmin.constants';

/** Every group linked to each staff member, with the role assigned in that group. */
export default function StaffGroupRolesGrid() {
  const [items, setItems] = useState<StaffGroupLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    clubApiFetch<{ items: StaffGroupLink[] }>('/api/club/staff/group-roles')
      .then((data) => setItems(data.items))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load groups'))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      `${item.staffName} ${item.username} ${item.groupName} ${item.role} ${item.notes}`.toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <>
      <div className="bg-[#c4b5e0] px-4 py-2.5 text-base font-semibold text-gray-900">Groups and roles of the staff</div>
      <div className="flex flex-wrap items-end gap-3 border border-t-0 border-gray-200 bg-white px-4 py-3">
        <label className="flex flex-col text-xs text-gray-600">
          Search
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, group, role"
            className="mt-1 w-56 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
          />
        </label>
        <span className="ml-auto text-sm text-gray-500">
          <span translate="no">{rows.length}</span> <span>rows</span>
        </span>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="overflow-x-auto border border-t-0 border-gray-300 bg-white">
        <table className="min-w-full border-collapse text-sm [&_td]:border [&_td]:border-gray-300 [&_th]:border [&_th]:border-gray-300">
          <thead>
            <tr className="bg-[#efe7b3] text-left text-gray-900">
              <th className="px-3 py-2 font-semibold">Name of Staff</th>
              <th className="px-3 py-2 font-semibold">Username</th>
              <th className="px-3 py-2 font-semibold">Group assigned</th>
              <th className="px-3 py-2 font-semibold">Date assignment</th>
              <th className="px-3 py-2 font-semibold">Role</th>
              <th className="px-3 py-2 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  No staff member is linked to a group yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="bg-[#e8f4fc]">
                  <td className="px-3 py-2" translate="no">
                    <Link href={`/club/staff/${row.staffId}`} className="text-blue-700 hover:underline">
                      {row.staffName}
                    </Link>
                  </td>
                  <td className="px-3 py-2" translate="no">
                    {row.username}
                  </td>
                  <td className="px-3 py-2" translate="no">
                    {row.groupName}
                  </td>
                  <td className="px-3 py-2">{formatYmd(row.assignedAt)}</td>
                  <td className="px-3 py-2">{row.role || '—'}</td>
                  <td className="px-3 py-2" translate="no">
                    {row.notes}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
