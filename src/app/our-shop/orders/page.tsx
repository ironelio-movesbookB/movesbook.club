'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Clock3,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { shopFetch } from '@/lib/shop/browser';

type OrderStatus = 'pending' | 'completed' | 'cancelled';
type PaymentStatus = 'paid' | 'unpaid';
type StatusFilter = 'all' | OrderStatus;
type PaymentFilter = 'all' | PaymentStatus;

type OrderItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
};

type Order = {
  id: string;
  orderNumber: string;
  clubId: string;
  clubSlug: string;
  clubName?: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: string;
  paid?: boolean;
  createdAt: string;
};

const currency = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
});

const dateFormatter = new Intl.DateTimeFormat('en-IE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Unknown date'
    : dateFormatter.format(date);
}

function getPaymentStatus(order: Order): PaymentStatus {
  if (typeof order.paid === 'boolean') {
    return order.paid ? 'paid' : 'unpaid';
  }

  if (order.paymentStatus === 'paid') {
    return 'paid';
  }

  if (order.paymentStatus === 'unpaid') {
    return 'unpaid';
  }

  // On-site payment orders remain unpaid until the API records payment.
  return 'unpaid';
}

function getStatusLabel(status: OrderStatus) {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Pending';
  }
}

function getStatusStyles(status: OrderStatus) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700';
    case 'cancelled':
      return 'bg-red-50 text-red-700';
    default:
      return 'bg-amber-50 text-amber-700';
  }
}

export default function OrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] =
    useState<PaymentFilter>('all');
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const loadOrders = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const response = await shopFetch('/api/club/shop/orders');

      const data: unknown = await response.json();

      if (!response.ok) {
        const apiError =
          data &&
          typeof data === 'object' &&
          'error' in data &&
          typeof data.error === 'string'
            ? data.error
            : 'Could not load orders.';

        throw new Error(apiError);
      }

      if (
        !data ||
        typeof data !== 'object' ||
        !('orders' in data) ||
        !Array.isArray(data.orders)
      ) {
        throw new Error('The orders API returned an unexpected response.');
      }

      setOrders(data.orders as Order[]);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not load orders.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...orders]
      .filter((order) => {
        if (
          statusFilter !== 'all' &&
          order.status !== statusFilter
        ) {
          return false;
        }

        if (
          paymentFilter !== 'all' &&
          getPaymentStatus(order) !== paymentFilter
        ) {
          return false;
        }

        if (!query) return true;

        return [
          order.orderNumber,
          order.clubName ?? '',
          order.clubSlug,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      );
  }, [orders, search, paymentFilter, statusFilter]);

  async function changeStatus(order: Order, status: OrderStatus) {
    if (order.status === status) return;

    if (
      status === 'cancelled' &&
      !window.confirm(
        `Cancel order ${order.orderNumber}? This does not issue a refund.`,
      )
    ) {
      return;
    }

    setUpdatingOrderId(order.id);
    setError('');
    setMessage('');

    try {
      const response = await shopFetch('/api/club/shop/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          status,
        }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        const apiError =
          data &&
          typeof data === 'object' &&
          'error' in data &&
          typeof data.error === 'string'
            ? data.error
            : 'Could not update the order.';

        throw new Error(apiError);
      }

      const updatedOrder =
        data &&
        typeof data === 'object' &&
        'order' in data &&
        data.order &&
        typeof data.order === 'object'
          ? (data.order as Order)
          : (data as Order);

      setOrders((current) =>
        current.map((item) =>
          item.id === order.id ? updatedOrder : item,
        ),
      );

      setSelectedOrder((current) =>
        current?.id === order.id ? updatedOrder : current,
      );

      setMessage(
        `Order ${order.orderNumber} updated to ${getStatusLabel(status).toLowerCase()}.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not update order.',
      );
    } finally {
      setUpdatingOrderId(null);
    }
  }

  return (
    <div className="space-y-4 text-slate-900 md:space-y-6">
        {/* Page heading card */}
        <header className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Order list
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Shop order summary
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void loadOrders(true)}
              disabled={refreshing || loading}
              aria-label="Refresh orders"
              title="Refresh orders"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-300 bg-white text-purple-700 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={18}
                className={refreshing ? 'animate-spin' : ''}
              />
            </button>

            <button
              type="button"
              onClick={() => router.push('/our-shop/orders/new')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white transition hover:bg-purple-700"
            >
              <Plus size={18} />
              <span>Create order</span>
            </button>
          </div>
        </header>

        {/* Compact filters: no labels or extra headings */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex h-12 items-center rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100">
            <Search size={17} className="shrink-0 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by # order"
              aria-label="Search by order number"
              className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="relative">
            <select
              value={paymentFilter}
              onChange={(event) =>
                setPaymentFilter(event.target.value as PaymentFilter)
              }
              aria-label="Filter by payment status"
              className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm text-slate-700 shadow-sm outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
            >
              <option value="all">Paid / unpaid</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              aria-label="Filter by order status"
              className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm text-slate-700 shadow-sm outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
            >
              <option value="all">All order status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              aria-label="Dismiss error"
              className="shrink-0 font-semibold"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {message && (
          <div
            role="status"
            className="flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            <span>{message}</span>
            <button
              type="button"
              onClick={() => setMessage('')}
              aria-label="Dismiss message"
              className="shrink-0 font-semibold"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Orders list: every order is its own card, without a table header */}
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            <RefreshCw
              size={24}
              className="mx-auto mb-3 animate-spin text-purple-600"
            />
            Loading orders…
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <ShoppingBagIcon />
            <h2 className="mt-3 font-semibold text-slate-800">
              No orders found
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Try another order number or change your filters.
            </p>
          </div>
        ) : (
          <section className="space-y-3">
            {filteredOrders.map((order) => {
              const paymentStatus = getPaymentStatus(order);
              const busy = updatingOrderId === order.id;

              return (
                <article
                  key={order.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 sm:p-5"
                >
                  <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[minmax(180px,1.35fr)_minmax(120px,0.8fr)_minmax(110px,0.7fr)_100px_minmax(130px,0.9fr)_auto] md:gap-5">
                    {/* Club and order number */}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {order.clubName || order.clubSlug || 'Shop'}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        #{order.orderNumber}
                      </p>
                    </div>

                    {/* Date */}
                    <div>
                      <p className="text-xs text-slate-400 md:hidden">
                        Order date
                      </p>
                      <p className="mt-1 text-sm text-slate-600 md:mt-0">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>

                    {/* Price */}
                    <div>
                      <p className="text-xs text-slate-400 md:hidden">
                        Total
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-900 md:mt-0">
                        {currency.format(Number(order.subtotal || 0))}
                      </p>
                    </div>

                    {/* Paid / unpaid icon */}
                    <div className="flex items-center gap-2">
                      <span
                        title={paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                        aria-label={
                          paymentStatus === 'paid' ? 'Paid' : 'Unpaid'
                        }
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          paymentStatus === 'paid'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {paymentStatus === 'paid' ? (
                          <Check size={17} strokeWidth={2.5} />
                        ) : (
                          <X size={17} strokeWidth={2.5} />
                        )}
                      </span>
                      <span className="text-xs text-slate-500 md:hidden">
                        {paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>

                    {/* Order status */}
                    <div>
                      <p className="text-xs text-slate-400 md:hidden">
                        Order status
                      </p>
                      <select
                        aria-label={`Status for order ${order.orderNumber}`}
                        value={order.status}
                        disabled={busy}
                        onChange={(event) =>
                          void changeStatus(
                            order,
                            event.target.value as OrderStatus,
                          )
                        }
                        className={`mt-1 w-full rounded-lg border-0 px-3 py-2 text-xs font-semibold outline-none ring-1 ring-inset ring-transparent focus:ring-purple-300 disabled:opacity-50 md:mt-0 ${getStatusStyles(order.status)}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    {/* Details */}
                    <div className="flex justify-start md:justify-end">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="inline-flex h-10 items-center justify-center rounded-lg border border-purple-300 bg-white px-4 text-sm font-semibold text-purple-700 transition hover:bg-purple-50"
                      >
                        Details
                        <span className="ml-2">...</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <div className="pb-2 text-xs text-slate-400">
          Showing {filteredOrders.length} of {orders.length} orders
        </div>

      {/* Order details modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          onClick={() => setSelectedOrder(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-details-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
              <div>
                <h2
                  id="order-details-title"
                  className="text-xl font-bold text-slate-900"
                >
                  Order details
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedOrder.clubName || selectedOrder.clubSlug} · #
                  {selectedOrder.orderNumber}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close order details"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-400">Customer</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedOrder.customerName || '—'}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Email</p>
                  <p className="mt-1 break-all text-sm font-medium text-slate-700">
                    {selectedOrder.customerEmail || '—'}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Order date</p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {formatDate(selectedOrder.createdAt)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Payment</p>
                  <p className="mt-1 text-sm font-medium capitalize text-slate-700">
                    {getPaymentStatus(selectedOrder)}
                    {selectedOrder.paymentMethod
                      ? ` · ${selectedOrder.paymentMethod}`
                      : ''}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">
                  Products ordered
                </h3>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[400px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Product</th>
                        <th className="px-4 py-3 text-right font-semibold">
                          Price
                        </th>
                        <th className="px-4 py-3 text-right font-semibold">
                          Qty
                        </th>
                        <th className="px-4 py-3 text-right font-semibold">
                          Total
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.items.map((item, index) => (
                        <tr key={`${item.productId}-${index}`}>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {item.name}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {currency.format(item.price)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">
                            {currency.format(item.price * item.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    <tfoot className="border-t border-slate-200 bg-white">
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-3 text-right font-bold"
                        >
                          Order total
                        </td>
                        <td className="px-4 py-3 text-right font-bold">
                          {currency.format(
                            Number(selectedOrder.subtotal || 0),
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <div>
                  <p className="text-xs text-slate-400">Order status</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {getStatusLabel(selectedOrder.status)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/our-shop/orders/${encodeURIComponent(selectedOrder.id)}`)
                    }
                    className="rounded-xl border border-purple-300 bg-white px-5 py-2.5 text-sm font-semibold text-purple-700 hover:bg-purple-50"
                  >
                    Edit order
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ShoppingBagIcon() {
  return (
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-purple-500">
      <ShoppingBag size={23} />
    </div>
  );
}