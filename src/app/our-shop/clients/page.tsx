
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Users,
  Mail,
  ShoppingBag,
  Euro,
  ArrowUpRight,
  RefreshCw,
  X,
  CalendarDays,
  Package,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { ShopFrame, ShopHeader } from '@/components/our-shop/pageChrome';
import { shopFetch } from '@/lib/shop/browser';

type OrderStatus = 'pending' | 'completed' | 'cancelled';

type OrderItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
};

type DemoOrder = {
  id: string;
  orderNumber: string;
  clubId: string;
  clubSlug: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  status: OrderStatus;
  createdAt: string;
  photoUrl?: string;
};

type Client = {
  email: string;
  name: string;
  photoUrl?: string;
  orderCount: number;
  completedOrderCount: number;
  totalSpent: number;
  totalOrdered: number;
  lastOrderDate: string;
  orders: DemoOrder[];
};

type FilterType = 'all' | 'active' | 'no-orders';

const currency = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
});

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

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase() || '?';
}

function getStatusClasses(status: OrderStatus) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700';
    case 'cancelled':
      return 'bg-red-50 text-red-700';
    default:
      return 'bg-amber-50 text-amber-700';
  }
}

export default function ClientsPage() {
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    firstName: '',
    surname: '',
    email: '',
    phone: '',
    taxCode: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await shopFetch('/api/club/shop/customers');

      if (!response.ok) {
        throw new Error('Could not load customer information.');
      }

      const data: unknown = await response.json();
      const payload =
        data && typeof data === 'object'
          ? (data as {
              orders?: DemoOrder[];
              customers?: { id: string; email: string; name: string; photoUrl?: string | null }[];
            })
          : null;
      const orderRows = Array.isArray(data) ? (data as DemoOrder[]) : payload?.orders;

      if (!Array.isArray(orderRows)) {
        throw new Error('The orders API returned an unexpected response.');
      }

      const directory = payload?.customers ?? [];
      const known = new Set(orderRows.map((order) => order.customerEmail?.trim().toLowerCase()).filter(Boolean));
      const placeholders: DemoOrder[] = directory
        .filter((customer) => customer.email && !known.has(customer.email.trim().toLowerCase()))
        .map((customer) => ({
          id: customer.id,
          orderNumber: '',
          clubId: '',
          clubSlug: '',
          customerName: customer.name,
          customerEmail: customer.email,
          items: [],
          subtotal: 0,
          status: 'pending',
          createdAt: '',
          photoUrl: customer.photoUrl || undefined,
        }));

      setOrders([...orderRows, ...placeholders]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while loading clients.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const clients = useMemo(() => {
    const clientMap = new Map<string, Client>();

    for (const order of orders) {
      const email = order.customerEmail?.trim().toLowerCase();

      if (!email) continue;

      let client = clientMap.get(email);

      if (!client) {
        client = {
          email,
          name: order.customerName?.trim() || 'Unknown customer',
          orderCount: 0,
          completedOrderCount: 0,
          totalSpent: 0,
          totalOrdered: 0,
          lastOrderDate: order.createdAt || '',
          orders: [],
          photoUrl: order.photoUrl,
        };

        clientMap.set(email, client);
      }

      if (!order.orderNumber) continue;

      if (
        order.createdAt &&
        (!client.lastOrderDate ||
          new Date(order.createdAt).getTime() >
            new Date(client.lastOrderDate).getTime())
      ) {
        client.lastOrderDate = order.createdAt;
      }

      if (
        (!client.name || client.name === 'Unknown customer') &&
        order.customerName
      ) {
        client.name = order.customerName;
      }

      client.orders.push(order);
      client.orderCount += 1;

      if (order.status === 'completed') {
        client.completedOrderCount += 1;
        client.totalSpent += Number(order.subtotal) || 0;
      }

      if (order.status !== 'cancelled') {
        client.totalOrdered += 1;
      }
    }

    return Array.from(clientMap.values()).sort(
      (a, b) =>
        new Date(b.lastOrderDate).getTime() -
        new Date(a.lastOrderDate).getTime(),
    );
  }, [orders]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();

    return clients.filter((client) => {
      const matchesSearch =
        !query ||
        client.name.toLowerCase().includes(query) ||
        client.email.includes(query);

      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && client.completedOrderCount > 0) ||
        (filter === 'no-orders' && client.orderCount === 0);

      return matchesSearch && matchesFilter;
    });
  }, [clients, search, filter]);

  const totalRevenue = clients.reduce(
    (total, client) => total + client.totalSpent,
    0,
  );

  const completedOrders = orders.filter(
    (order) => order.status === 'completed',
  ).length;

  const averageSpent =
    clients.length > 0 ? totalRevenue / clients.length : 0;

  function openClient(client: Client) {
    setSelectedClient(client);
  }

  async function createCustomer() {
    setError('');
    try {
      let photoUrl = '';
      if (photoFile) {
        const body = new FormData();
        body.append('file', photoFile);
        const upload = await shopFetch('/api/club/shop/uploads', { method: 'POST', body });
        const uploaded = await upload.json();
        if (!upload.ok) throw new Error(uploaded.error || 'Could not upload the photo.');
        photoUrl = uploaded.imageUrl;
      }
      const response = await shopFetch('/api/club/shop/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...customerForm, photoUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create the customer.');
      setCustomerForm({ firstName: '', surname: '', email: '', phone: '', taxCode: '' });
      setPhotoFile(null);
      setCreating(false);
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the customer.');
    }
  }

  return (
    <ShopFrame>
        <ShopHeader title="Clients" subtitle="Manage your customers and review their order history.">
            <button
              type="button"
              onClick={() => setCreating((value) => !value)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-700"
            >
              New customer
            </button>
            <button
              type="button"
              onClick={() => void loadOrders()}
              disabled={loading}
              aria-label="Refresh clients"
              title="Refresh clients"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-300 bg-white text-purple-700 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
        </ShopHeader>

        {creating && (
          <form
            className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void createCustomer();
            }}
          >
            <input required placeholder="Name" value={customerForm.firstName} onChange={(event) => setCustomerForm({ ...customerForm, firstName: event.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <input placeholder="Surname" value={customerForm.surname} onChange={(event) => setCustomerForm({ ...customerForm, surname: event.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <input type="email" required placeholder="Email" value={customerForm.email} onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <input placeholder="Phone" value={customerForm.phone} onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <input placeholder="Tax code" value={customerForm.taxCode} onChange={(event) => setCustomerForm({ ...customerForm, taxCode: event.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <input type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} className="text-sm" />
            <button type="submit" className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white sm:col-span-2">Save customer</button>
          </form>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Could not load clients</p>
              <p className="mt-1">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Summary cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total clients"
            value={loading ? '—' : String(clients.length)}
            description="Unique customer emails"
            icon={<Users size={20} />}
            iconClass="bg-violet-50 text-violet-600"
          />

          <SummaryCard
            title="Completed orders"
            value={loading ? '—' : String(completedOrders)}
            description="Successfully completed"
            icon={<ShoppingBag size={20} />}
            iconClass="bg-emerald-50 text-emerald-600"
          />

          <SummaryCard
            title="Total revenue"
            value={loading ? '—' : currency.format(totalRevenue)}
            description="From completed orders"
            icon={<Euro size={20} />}
            iconClass="bg-blue-50 text-blue-600"
          />

          <SummaryCard
            title="Average spent"
            value={loading ? '—' : currency.format(averageSpent)}
            description="Revenue per registered client"
            icon={<ArrowUpRight size={20} />}
            iconClass="bg-orange-50 text-orange-600"
          />
        </section>

        {/* Client list */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Customer directory
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {loading
                  ? 'Loading customer records...'
                  : `${filteredClients.length} ${
                      filteredClients.length === 1 ? 'customer' : 'customers'
                    } found`}
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or email..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 border-b border-gray-100 px-5 py-3 sm:px-6">
            {(
              [
                ['all', 'All clients'],
                ['active', 'With completed orders'],
                ['no-orders', 'No orders'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  filter === value
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="text-center">
                <RefreshCw
                  size={25}
                  className="mx-auto animate-spin text-gray-400"
                />
                <p className="mt-3 text-sm text-gray-500">
                  Loading clients...
                </p>
              </div>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                <Users size={26} />
              </div>

              <h3 className="mt-4 font-semibold text-gray-900">
                {search ? 'No matching customers' : 'No customers yet'}
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
                {search
                  ? 'Try a different name or email address.'
                  : 'Customers will appear here automatically after they place an order in your public shop.'}
              </p>

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="mt-4 text-sm font-semibold text-violet-700 hover:text-violet-800"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/70 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-4 py-4">Orders</th>
                      <th className="px-4 py-4">Total spent</th>
                      <th className="px-4 py-4">Last order</th>
                      <th className="px-6 py-4 text-right">Details</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {filteredClients.map((client) => (
                      <tr
                        key={client.email}
                        className="transition hover:bg-gray-50/80"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <ClientAvatar name={client.name} photoUrl={client.photoUrl} />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-gray-900">
                                {client.name}
                              </p>
                              <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-gray-500">
                                <Mail size={13} className="shrink-0" />
                                {client.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="font-semibold text-gray-900">
                            {client.orderCount}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {client.completedOrderCount} completed
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <span className="font-semibold text-gray-900">
                            {currency.format(client.totalSpent)}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-600">
                          {formatDate(client.lastOrderDate)}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openClient(client)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                          >
                            View
                            <ChevronRight size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y divide-gray-100 md:hidden">
                {filteredClients.map((client) => (
                  <button
                    key={client.email}
                    type="button"
                    onClick={() => openClient(client)}
                    className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-gray-50"
                  >
                    <ClientAvatar name={client.name} photoUrl={client.photoUrl} />

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900">
                        {client.name}
                      </p>
                      <p className="mt-1 truncate text-sm text-gray-500">
                        {client.email}
                      </p>
                      <p className="mt-2 text-xs text-gray-500">
                        {client.orderCount} orders ·{' '}
                        {currency.format(client.totalSpent)} spent
                      </p>
                    </div>

                    <ChevronRight
                      size={18}
                      className="shrink-0 text-gray-400"
                    />
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-3 text-xs text-gray-500 sm:px-6">
            Customer records are derived from your existing order data.
          </div>
        </section>

      {/* Customer details drawer */}
      {selectedClient && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-gray-900/40 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedClient(null);
            }
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-details-title"
            className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Customer profile
                </p>
                <h2
                  id="client-details-title"
                  className="mt-1 text-xl font-bold text-gray-900"
                >
                  Client details
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                aria-label="Close customer details"
                className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-6 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-xl font-bold text-violet-700">
                  {getInitials(selectedClient.name)}
                </div>

                <div className="min-w-0">
                  <h3 className="break-words text-lg font-bold text-gray-900">
                    {selectedClient.name}
                  </h3>
                  <p className="mt-1 break-all text-sm text-gray-500">
                    {selectedClient.email}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DetailStat
                  label="Total orders"
                  value={String(selectedClient.orderCount)}
                />
                <DetailStat
                  label="Total spent"
                  value={currency.format(selectedClient.totalSpent)}
                />
                <DetailStat
                  label="Completed"
                  value={String(selectedClient.completedOrderCount)}
                />
                <DetailStat
                  label="Last order"
                  value={formatDate(selectedClient.lastOrderDate)}
                />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">Order history</h3>
                  <span className="text-sm text-gray-500">
                    {selectedClient.orders.length} orders
                  </span>
                </div>

                <div className="space-y-3">
                  {[...selectedClient.orders]
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                    )
                    .map((order) => (
                      <div
                        key={order.id}
                        className="rounded-xl border border-gray-200 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {order.orderNumber}
                            </p>
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                              <CalendarDays size={13} />
                              {formatDate(order.createdAt)}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                              order.status,
                            )}`}
                          >
                            {order.status}
                          </span>
                        </div>

                        <div className="my-3 space-y-2 border-y border-gray-100 py-3">
                          {order.items.map((item, index) => (
                            <div
                              key={`${order.id}-${item.productId}-${index}`}
                              className="flex items-start justify-between gap-3 text-sm"
                            >
                              <span className="flex min-w-0 items-start gap-2 text-gray-600">
                                <Package
                                  size={15}
                                  className="mt-0.5 shrink-0 text-gray-400"
                                />
                                <span>
                                  {item.name}
                                  <span className="text-gray-400">
                                    {' '}
                                    × {item.quantity}
                                  </span>
                                </span>
                              </span>

                              <span className="shrink-0 font-medium text-gray-900">
                                {currency.format(
                                  Number(item.price) * Number(item.quantity),
                                )}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">
                            Order total
                          </span>
                          <span className="font-bold text-gray-900">
                            {currency.format(Number(order.subtotal) || 0)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 p-5">
              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Close details
              </button>
            </div>
          </aside>
        </div>
      )}
    </ShopFrame>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
  iconClass,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-3 text-2xl font-bold tracking-tight text-gray-900">
            {value}
          </p>
        </div>

        <div className={`rounded-xl p-3 ${iconClass}`}>{icon}</div>
      </div>

      <p className="mt-3 text-xs text-gray-500">{description}</p>
    </div>
  );
}

function ClientAvatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
    );
  }
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-bold text-violet-700">
      {getInitials(name)}
    </div>
  );
}

function DetailStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-2 break-words text-lg font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}
