
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  RefreshCw,
  Users,
  UserCheck,
  Clock,
  ShieldAlert,
  Pencil,
  X,
  Save,
} from 'lucide-react';
import { ShopFrame, ShopHeader } from '@/components/our-shop/pageChrome';

type MembershipStatus = 'pending' | 'active' | 'suspended';

type Membership = {
  id: string;
  clubId: string;
  customerName: string;
  email: string;
  taxNumber: string;
  status: MembershipStatus;
  joinedAt: string;
  updatedAt: string;
};

type MembershipForm = {
  customerName: string;
  email: string;
  taxNumber: string;
  status: MembershipStatus;
};

const EMPTY_FORM: MembershipForm = {
  customerName: '',
  email: '',
  taxNumber: '',
  status: 'pending',
};

const CLUB_ID = 'demo-club';

const STATUS_STYLES: Record<MembershipStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  suspended: 'bg-red-50 text-red-700 ring-red-600/20',
};

function formatDate(value: string) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function StatusBadge({ status }: { status: MembershipStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export default function MembershipsPage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Membership | null>(null);
  const [form, setForm] = useState<MembershipForm>(EMPTY_FORM);

  const loadMemberships = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/memberships?clubId=${encodeURIComponent(CLUB_ID)}`,
        { cache: 'no-store' },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not load memberships.');
      }

      setMemberships(data.memberships ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load memberships.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMemberships();
  }, [loadMemberships]);

  const counts = useMemo(
    () => ({
      total: memberships.length,
      active: memberships.filter((item) => item.status === 'active').length,
      pending: memberships.filter((item) => item.status === 'pending').length,
      suspended: memberships.filter((item) => item.status === 'suspended')
        .length,
    }),
    [memberships],
  );

  const filteredMemberships = useMemo(() => {
    const query = search.trim().toLowerCase();

    return memberships.filter((item) => {
      const matchesStatus =
        statusFilter === 'all' || item.status === statusFilter;

      const matchesSearch =
        !query ||
        item.customerName.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query) ||
        item.taxNumber.toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [memberships, search, statusFilter]);

  function openCreateModal() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setSuccess('');
    setModalOpen(true);
  }

  function openEditModal(membership: Membership) {
    setEditing(membership);
    setForm({
      customerName: membership.customerName,
      email: membership.email,
      taxNumber: membership.taxNumber,
      status: membership.status,
    });
    setError('');
    setSuccess('');
    setModalOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        ...(editing ? { id: editing.id } : {}),
        clubId: editing?.clubId ?? CLUB_ID,
        customerName: form.customerName.trim(),
        email: form.email.trim(),
        taxNumber: form.taxNumber.trim(),
        status: form.status,
      };

      const response = await fetch('/api/memberships', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not save membership.');
      }

      setSuccess(editing ? 'Membership updated.' : 'Membership created.');
      setModalOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);

      await loadMemberships();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save membership.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ShopFrame>
      <ShopHeader
        title="Club memberships"
        subtitle="Manage member details, membership status, and tax information."
      >
        <button
          onClick={() => void loadMemberships()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
        >
          <Plus size={17} />
          Add member
        </button>
      </ShopHeader>

      {error && !modalOpen && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total members"
          value={counts.total}
          icon={<Users size={20} />}
          iconClass="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Active members"
          value={counts.active}
          icon={<UserCheck size={20} />}
          iconClass="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Pending approval"
          value={counts.pending}
          icon={<Clock size={20} />}
          iconClass="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Suspended"
          value={counts.suspended}
          icon={<ShieldAlert size={20} />}
          iconClass="bg-red-50 text-red-600"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, or tax number..."
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-emerald-500"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-gray-500">
            <RefreshCw size={20} className="animate-spin" />
            Loading memberships...
          </div>
        ) : filteredMemberships.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
              <Users size={22} />
            </div>
            <h2 className="mt-4 font-semibold text-gray-900">
              {memberships.length === 0
                ? 'No members yet'
                : 'No matching members'}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              {memberships.length === 0
                ? 'Add your first club member to start managing memberships.'
                : 'Try changing your search or status filter.'}
            </p>
            {memberships.length === 0 && (
              <button
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Plus size={16} />
                Add first member
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Member</th>
                    <th className="px-5 py-3 font-semibold">Tax number</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Joined</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredMemberships.map((membership) => (
                    <tr key={membership.id} className="hover:bg-gray-50/70">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900">
                          {membership.customerName}
                        </div>
                        <div className="mt-1 text-gray-500">
                          {membership.email}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-600">
                        {membership.taxNumber || '—'}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={membership.status} />
                      </td>
                      <td className="px-5 py-4 text-gray-600">
                        {formatDate(membership.joinedAt)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => openEditModal(membership)}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 font-medium text-gray-700 hover:bg-white hover:text-emerald-700"
                        >
                          <Pencil size={15} />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
              Showing {filteredMemberships.length} of {memberships.length}{' '}
              members
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gray-950/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setModalOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="membership-form-title"
            className="my-auto w-full max-w-xl rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h2
                  id="membership-form-title"
                  className="text-lg font-bold text-gray-900"
                >
                  {editing ? 'Edit membership' : 'Add club member'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Enter the member&apos;s details below.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                aria-label="Close form"
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Full name *
                </label>
                <input
                  required
                  maxLength={120}
                  value={form.customerName}
                  onChange={(event) =>
                    setForm({ ...form, customerName: event.target.value })
                  }
                  placeholder="Alex Morgan"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email address *
                </label>
                <input
                  required
                  type="email"
                  maxLength={254}
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  placeholder="alex@example.com"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Tax number
                </label>
                <input
                  maxLength={100}
                  value={form.taxNumber}
                  onChange={(event) =>
                    setForm({ ...form, taxNumber: event.target.value })
                  }
                  placeholder="Optional tax identification number"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Use fictional data in this demo.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Membership status *
                </label>
                <select
                  required
                  value={form.status}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      status: event.target.value as MembershipStatus,
                    })
                  }
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="pending">Pending approval</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {saving
                    ? 'Saving...'
                    : editing
                      ? 'Save changes'
                      : 'Create membership'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ShopFrame>
  );
}

function StatCard({
  label,
  value,
  icon,
  iconClass,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            {value}
          </p>
        </div>
        <div className={`rounded-xl p-3 ${iconClass}`}>{icon}</div>
      </div>
    </div>
  );
}
