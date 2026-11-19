'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { shopFetch } from '@/lib/shop/browser';
import ProductCountPopup from '@/components/club/products/ProductCountPopup';

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
  customer?: { photoUrl?: string | null } | null;
  items: OrderItem[];
  subtotal: number;
  total?: number;
  paidAmount?: number;
  restAmount?: number;
  productCount?: number;
  firstProduct?: string;
  performedBy?: 'Operator' | 'Member' | string;
  sector?: string;
  operatorName?: string;
  procedureRecordId?: string | null;
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
  return Number.isNaN(date.getTime()) ? 'Unknown date' : dateFormatter.format(date);
}

function MemberAvatar({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
      />
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold uppercase text-purple-700">
      {(name || '?').trim().charAt(0) || '?'}
    </span>
  );
}

function getPaymentStatus(order: Order): PaymentStatus {
  if (typeof order.paid === 'boolean') return order.paid ? 'paid' : 'unpaid';
  if (order.paymentStatus === 'paid' || order.paymentStatus === 'unpaid') return order.paymentStatus;
  return 'unpaid';
}

function getStatusLabel(status: OrderStatus) {
  if (status === 'completed') return 'Completed';
  if (status === 'cancelled') return 'Cancelled';
  return 'Pending';
}

function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams?.get('productId') || '';
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadOrders = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const response = await shopFetch('/api/club/shop/orders');
      const data: unknown = await response.json();
      if (!response.ok) {
        const apiError =
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'Could not load orders.';
        throw new Error(apiError);
      }
      if (!data || typeof data !== 'object' || !('orders' in data) || !Array.isArray(data.orders)) {
        throw new Error('The orders API returned an unexpected response.');
      }
      setOrders(data.orders as Order[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load orders.');
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
        if (productId && !order.items.some((item) => item.productId === productId)) return false;
        if (statusFilter !== 'all' && order.status !== statusFilter) return false;
        if (paymentFilter !== 'all' && getPaymentStatus(order) !== paymentFilter) return false;
        if (!query) return true;
        return [
          order.orderNumber,
          order.clubName ?? '',
          order.clubSlug,
          order.customerName ?? '',
          order.sector ?? '',
          order.performedBy ?? '',
          order.firstProduct ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, search, paymentFilter, statusFilter, productId]);

  async function changeStatus(order: Order, status: OrderStatus) {
    if (order.status === status) return;
    if (
      status === 'cancelled' &&
      !window.confirm(`Delete selling #${order.orderNumber}? This does not issue a refund.`)
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
        body: JSON.stringify({ orderId: order.id, status }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const apiError =
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'Could not update the order.';
        throw new Error(apiError);
      }
      const updatedOrder =
        data && typeof data === 'object' && 'order' in data && data.order && typeof data.order === 'object'
          ? (data.order as Order)
          : (data as Order);
      setOrders((current) => current.map((item) => (item.id === order.id ? updatedOrder : item)));
      setMessage(`Order ${order.orderNumber} updated to ${getStatusLabel(status).toLowerCase()}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update order.');
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function purchaseHref(order: Order) {
    const id = order.procedureRecordId || order.id;
    const club = order.clubId ? `&clubId=${encodeURIComponent(order.clubId)}` : '';
    return `/clubs/payment_detail/${encodeURIComponent(id)}?type=product_sale${club}`;
  }

  return (
    <div className="space-y-4 text-slate-900 md:space-y-6">
      <header className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {productId ? 'Archive of sellings · selected product' : 'Orders'}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {productId
              ? 'Only sellings that include the selected product'
              : 'Sellings performed by the operator or by the member online'}
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
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => router.push('/clubs/shop/sell')}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white transition hover:bg-purple-700"
          >
            <Plus size={18} />
            <span>Panel of sellings</span>
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex h-12 items-center rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100">
          <Search size={17} className="shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by # order or member"
            aria-label="Search orders"
            className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="relative">
          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}
            aria-label="Filter by payment status"
            className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm text-slate-700 shadow-sm outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
          >
            <option value="all">Paid / unpaid</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            aria-label="Filter by order status"
            className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm text-slate-700 shadow-sm outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
          >
            <option value="all">All order status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss error" className="shrink-0 font-semibold">
            <X size={17} />
          </button>
        </div>
      )}

      {message && (
        <div role="status" className="flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')} aria-label="Dismiss message" className="shrink-0 font-semibold">
            <X size={17} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          <RefreshCw size={24} className="mx-auto mb-3 animate-spin text-purple-600" />
          Loading orders…
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-purple-500">
            <ShoppingBag size={23} />
          </div>
          <h2 className="mt-3 font-semibold text-slate-800">No orders found</h2>
          <p className="mt-2 text-sm text-slate-500">Try another search or change your filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Performed by</th>
                <th className="px-3 py-3 font-semibold">Sector</th>
                <th className="px-3 py-3 font-semibold">Member</th>
                <th className="px-3 py-3 font-semibold">No. of products</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">1th product purchased</th>
                <th className="px-3 py-3 font-semibold">Total cost</th>
                <th className="px-3 py-3 font-semibold">Paid</th>
                <th className="px-3 py-3 font-semibold">Rest</th>
                <th className="px-3 py-3 font-semibold">Operator</th>
                <th className="px-3 py-3 font-semibold">Options</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map((order) => {
                const busy = updatingOrderId === order.id;
                const productCount =
                  order.productCount ?? order.items.reduce((sum, item) => sum + item.quantity, 0);
                const firstProduct = order.firstProduct || order.items[0]?.name || '-';
                const total = order.total ?? order.subtotal ?? 0;
                const paidAmount = order.paidAmount ?? (getPaymentStatus(order) === 'paid' ? total : 0);
                const restAmount = order.restAmount ?? Math.max(0, total - paidAmount);
                return (
                  <tr
                    key={order.id}
                    className={
                      order.status === 'cancelled'
                        ? 'bg-slate-100 opacity-60 grayscale'
                        : 'hover:bg-slate-50'
                    }
                  >
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">{formatDate(order.createdAt)}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-800">
                      {order.performedBy || 'Operator'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">{order.sector || 'Shop'}</td>
                    <td className="max-w-[200px] px-3 py-3 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <MemberAvatar src={order.customer?.photoUrl} name={order.customerName} />
                        <span className="truncate">{order.customerName || '-'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <ProductCountPopup
                        count={productCount}
                        lines={order.items.map((item) => ({ name: item.name, quantity: item.quantity }))}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          order.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : order.status === 'cancelled'
                              ? 'bg-slate-200 text-slate-600'
                              : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-3 text-slate-700">{firstProduct}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900">
                      {currency.format(Number(total) || 0)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                      {currency.format(Number(paidAmount) || 0)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                      {currency.format(Number(restAmount) || 0)}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-3 text-slate-700">
                      {order.operatorName || '-'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          title="Edit"
                          onClick={() => router.push(`/clubs/shop/orders/${encodeURIComponent(order.id)}`)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          title="Open purchase"
                          onClick={() => router.push(purchaseHref(order))}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-50"
                        >
                          <Wallet size={14} />
                          Open purchase
                        </button>
                        <button
                          type="button"
                          disabled={busy || order.status !== 'pending'}
                          title="Delete"
                          onClick={() => void changeStatus(order, 'cancelled')}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="pb-2 text-xs text-slate-400">
        Showing {filteredOrders.length} of {orders.length} orders
      </div>
    </div>
  );
}

export default function ShopOrdersRoute() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Loading orders…</div>}>
      <OrdersPage />
    </Suspense>
  );
}
