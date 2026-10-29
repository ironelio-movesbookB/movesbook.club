
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { shopFetch } from '@/lib/shop/browser';
import { ShopHeader } from '@/components/our-shop/pageChrome';
import {
  ArrowLeft,
  Save,
  Search,
  Trash2,
  FileText,
  Receipt,
  User,
} from 'lucide-react';

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-100';

const sectionTitleClass = 'text-base font-semibold text-gray-800';

type Product = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

type CatalogProduct = {
  id: string;
  name: string;
  price: number;
};

function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function formatPrice(price: number) {
  return `€${price.toFixed(2)}`;
}

export default function OrderEditor({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [orderProducts, setOrderProducts] = useState<Product[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('pending');
  const [savedStatus, setSavedStatus] = useState('pending');
  const [paid, setPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('pickup');
  const [discount, setDiscount] = useState('0.00');
  const [orderDate, setOrderDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const linesLocked = savedStatus === 'completed' || savedStatus === 'cancelled';

  useEffect(() => {
    shopFetch('/api/club/shop/products')
      .then(async (response) => {
        const data = await response.json();
        if (Array.isArray(data)) setCatalog(data);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!orderId) return;
    shopFetch('/api/club/shop/orders')
      .then(async (response) => {
        const data = await response.json();
        const order = (data.orders ?? []).find((item: { id: string }) => item.id === orderId);
        if (!order) {
          setError('This order could not be found.');
          return;
        }
        setOrderProducts(
          order.items.map((item: { productId: string; name: string; price: number; quantity: number }) => ({
            id: item.productId || item.name,
            name: item.name,
            unitPrice: item.price,
            quantity: item.quantity,
          })),
        );
        setOrderStatus(order.status);
        setSavedStatus(order.status);
        setPaid(Boolean(order.paid));
        setPaymentMethod(order.paymentMethod || 'pickup');
        setDiscount(String(order.discount ?? 0));
        setOrderDate(order.orderDate || '');
        setCustomerName(order.customerName || '');
        setReceiptNumber(order.receiptNumber || '');
        setInvoiceNumber(order.invoiceNumber || '');
        const party = order.customer;
        const fallback = String(order.customerName || '').trim().split(/\s+/);
        setFirstName(party?.firstName || fallback[0] || '');
        setSurname(party?.surname || fallback.slice(1).join(' '));
        setTaxCode(party?.taxCode || '');
        setDateOfBirth(party?.dateOfBirth || '');
        setEmail(party?.email || order.customerEmail || '');
        setPhone(party?.phone || '');
        setAddress(party?.address || '');
        setCity(party?.city || '');
        setProvince(party?.province || '');
        setPostalCode(party?.postalCode || '');
      })
      .catch(() => setError('Could not load the order.'));
  }, [orderId]);

  async function saveOrder() {
    setError('');
    setMessage('');
    const response = await shopFetch('/api/club/shop/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        status: orderStatus,
        paid,
        discount: Number(discount) || 0,
        paymentMethod,
        items: orderProducts.map((product) => ({
          productId: product.id,
          quantity: product.quantity,
        })),
        customer: {
          firstName,
          surname,
          email,
          phone,
          taxCode,
          address,
          city,
          province,
          postalCode,
          dateOfBirth,
        },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || 'Could not save the order.');
      return;
    }
    router.push('/our-shop/orders');
  }

  async function issue(kind: 'receipt' | 'invoice') {
    setError('');
    const response = await shopFetch(`/api/club/shop/orders/${encodeURIComponent(orderId)}/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || 'Could not create the document.');
      return;
    }
    if (kind === 'invoice') setInvoiceNumber(data.documentNumber);
    else setReceiptNumber(data.documentNumber);
    setMessage(`${kind === 'invoice' ? 'Invoice' : 'Receipt'} ${data.documentNumber} created.`);
  }

  async function cancelOrder() {
    if (!window.confirm('Cancel this order?')) return;
    setOrderStatus('cancelled');
    const response = await shopFetch('/api/club/shop/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status: 'cancelled', paid }),
    });
    if (response.ok) router.push('/our-shop/orders');
  }

  const subtotal = orderProducts.reduce(
    (total, product) => total + product.unitPrice * product.quantity,
    0,
  );

  const discountAmount = Math.max(0, Number(discount) || 0);
  const totalPrice = Math.max(0, subtotal - discountAmount);

  const updateQuantity = (id: string, quantity: number) => {
    setOrderProducts((current) =>
      current.map((product) =>
        product.id === id
          ? {
              ...product,
              quantity: Math.max(
                1,
                Number.isFinite(quantity) ? Math.floor(quantity) : 1,
              ),
            }
          : product,
      ),
    );
  };

  const removeProduct = (id: string) => {
    setOrderProducts((current) =>
      current.filter((product) => product.id !== id),
    );
  };

  const matchingProducts = catalog
    .filter((product) => product.name.toLowerCase().includes(productSearch.trim().toLowerCase()))
    .slice(0, 6);

  function addProduct(product: CatalogProduct) {
    setOrderProducts((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [
        ...current,
        { id: product.id, name: product.name, unitPrice: product.price, quantity: 1 },
      ];
    });
    setProductSearch('');
  }

  return (
    <main className="space-y-4 md:space-y-6">
      <ShopHeader title={customerName || 'Order'} subtitle={`Shop / Orders / ${orderId ? 'Edit order' : 'Order'}`}>
            <button
              type="button"
              onClick={() => void cancelOrder()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              Cancel order
            </button>

            <button
              type="button"
              onClick={() => void saveOrder()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white transition hover:bg-purple-700"
            >
              <Save size={17} />
              Save
            </button>
      </ShopHeader>

      <Link
        href="/our-shop/orders"
        className="inline-flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700"
      >
        <ArrowLeft size={16} />
        Return to the list
      </Link>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {message && <p className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

      {/* Products */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="pt-1">
          <h2 className={sectionTitleClass}>Products</h2>
        </div>

        <div className="min-w-0 lg:col-span-2">
          <div className="space-y-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
            <Field label="Select product">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={productSearch}
                  disabled={linesLocked}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Search products..."
                  className={`${inputClass} pl-10`}
                />
              </div>
              {!linesLocked && productSearch.trim() && (
                <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
                  {matchingProducts.length === 0 && (
                    <p className="px-3 py-2 text-sm text-gray-500">No matching product.</p>
                  )}
                  {matchingProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addProduct(product)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-purple-50"
                    >
                      <span>{product.name}</span>
                      <span className="text-gray-500">{formatPrice(product.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </Field>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-800">
                  Product list
                </h3>
                <span className="text-xs text-gray-500">
                  {orderProducts.length}{' '}
                  {orderProducts.length === 1 ? 'product' : 'products'}
                </span>
              </div>

              <div className="space-y-3">
                {orderProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex min-w-0 items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:gap-4"
                  >
                    <div className="w-[76px] shrink-0 sm:w-24">
                      <label
                        htmlFor={`quantity-${product.id}`}
                        className="mb-1 block text-xs text-gray-500"
                      >
                        Quantity
                      </label>
                      <input
                        id={`quantity-${product.id}`}
                        type="number"
                        min={1}
                        step={1}
                        value={product.quantity}
                        disabled={linesLocked}
                        onChange={(event) => {
                          const value = event.target.valueAsNumber;
                          if (Number.isFinite(value)) {
                            updateQuantity(product.id, value);
                          }
                        }}
                        onBlur={(event) => {
                          if (
                            !event.target.value ||
                            Number(event.target.value) < 1
                          ) {
                            updateQuantity(product.id, 1);
                          }
                        }}
                        className={`${inputClass} px-2 py-2.5 text-center`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">
                        {product.name}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatPrice(product.unitPrice)} per unit
                      </p>
                    </div>

                    <div className="w-[90px] shrink-0 text-right sm:w-28">
                      <p className="text-xs text-gray-500">Line total</p>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-gray-900">
                        {formatPrice(product.unitPrice * product.quantity)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeProduct(product.id)}
                      disabled={linesLocked}
                      aria-label={`Remove ${product.name}`}
                      title={`Remove ${product.name}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                {orderProducts.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center">
                    <p className="text-sm font-medium text-gray-700">
                      No products added
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Select a product to add it to this order.
                    </p>
                  </div>
                )}
              </div>

              {/* Total price */}
              <div className="mt-5 flex justify-end border-t border-gray-200 pt-4">
                <div className="text-right">
                  <p className="text-sm text-gray-500">Subtotal</p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-gray-800">
                    {formatPrice(subtotal)}
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    Discount: {formatPrice(discountAmount)}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">Total price</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                    {formatPrice(totalPrice)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Order Information */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="pt-1">
          <h2 className={sectionTitleClass}>Order Information</h2>
        </div>

        <div className="min-w-0 lg:col-span-2">
          <div className="space-y-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
            {/* Status and discount */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <Field label="Order status" required>
                  <select
                    value={orderStatus}
                    onChange={(event) => setOrderStatus(event.target.value)}
                    className={inputClass}
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </Field>

                {orderStatus === 'completed' && (
                  <p className="mt-2 text-xs leading-5 text-red-600">
                    If set as completed, only the email, payment status and
                    payment method can be changed.
                  </p>
                )}
              </div>

              <Field label="Possible discount (€)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  disabled={linesLocked}
                  onChange={(event) => setDiscount(event.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </Field>
            </div>

            {/* Order date */}
            <Field label="Order date" required>
              <input
                type="date"
                value={orderDate}
                readOnly
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </section>

      {/* Payment Information */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="pt-1">
          <h2 className={sectionTitleClass}>Payment Information</h2>
        </div>

        <div className="min-w-0 lg:col-span-2">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
            {/* Receipt and invoice information */}
            <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-purple-600 shadow-sm">
                  <FileText size={20} />
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Receipt and invoice
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-gray-600">
                    Once the order status is set to Completed in Actions, it
                    will be possible to manage the generation of the related
                    receipt or invoice.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 border-t border-purple-100 pt-4">
                <button
                  type="button"
                  disabled={orderStatus !== 'completed'}
                  onClick={() => void issue('receipt')}
                  className="inline-flex items-center gap-2 rounded-lg border border-purple-200 bg-white px-3.5 py-2 text-sm font-medium text-purple-700 transition hover:bg-purple-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white"
                >
                  <Receipt size={16} />
                  {receiptNumber ? `Receipt ${receiptNumber}` : 'Generate receipt'}
                </button>

                <button
                  type="button"
                  disabled={orderStatus !== 'completed'}
                  onClick={() => void issue('invoice')}
                  className="inline-flex items-center gap-2 rounded-lg border border-purple-200 bg-white px-3.5 py-2 text-sm font-medium text-purple-700 transition hover:bg-purple-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white"
                >
                  <FileText size={16} />
                  {invoiceNumber ? `Invoice ${invoiceNumber}` : 'Generate invoice'}
                </button>
              </div>
            </div>

            {/* Payment status and method */}
            <div className="mt-6 grid grid-cols-1 gap-5 border-t border-gray-100 pt-6 sm:grid-cols-2">
              <div>
                <span className="mb-2 block text-sm font-medium text-gray-700">
                  Payment status
                </span>

                <label className="flex min-h-[46px] cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3.5 py-3 transition hover:border-purple-300">
                  <input
                    type="checkbox"
                    checked={paid}
                    onChange={(event) => setPaid(event.target.checked)}
                    className="h-5 w-5 accent-purple-600"
                  />
                  <span className="text-sm font-medium text-gray-800">
                    Paid
                  </span>
                </label>
              </div>

              <Field label="Payment method" required>
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Select payment method</option>
                  <option value="pickup">Collect and pay on site</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank-transfer">Bank transfer</option>
                  <option value="online">Online payment</option>
                  <option value="other">Other</option>
                </select>
              </Field>
            </div>
          </div>
        </div>
      </section>

      {/* Ordering Party */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="pt-1">
          <h2 className={sectionTitleClass}>Ordering Party</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Personal and contact information for the person placing the order.
          </p>
        </div>

        <div className="min-w-0 lg:col-span-2">
          <div className="space-y-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
            {/* Personal information */}
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <User size={18} className="text-purple-600" />
              <h3 className="text-sm font-semibold text-gray-800">
                Personal information
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Surname">
                <input
                  type="text"
                  value={surname}
                  disabled={linesLocked}
                  onChange={(event) => setSurname(event.target.value)}
                  placeholder="Enter surname"
                  className={inputClass}
                />
              </Field>

              <Field label="Name">
                <input
                  type="text"
                  value={firstName}
                  disabled={linesLocked}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="Enter name"
                  className={inputClass}
                />
              </Field>

              <Field label="Tax ID code">
                <input
                  type="text"
                  value={taxCode}
                  disabled={linesLocked}
                  onChange={(event) => setTaxCode(event.target.value)}
                  placeholder="Enter tax ID code"
                  className={inputClass}
                />
              </Field>

              <Field label="Date of birth">
                <input
                  type="date"
                  value={dateOfBirth}
                  disabled={linesLocked}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            {/* Contact information */}
            <div className="border-b border-gray-100 pb-3 pt-2">
              <h3 className="text-sm font-semibold text-gray-800">
                Contact information
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter email address"
                  className={inputClass}
                />
              </Field>

              <Field label="Telephone">
                <input
                  type="tel"
                  value={phone}
                  disabled={linesLocked}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Enter telephone number"
                  className={inputClass}
                />
              </Field>
            </div>

            {/* Residence information */}
            <div className="border-b border-gray-100 pb-3 pt-2">
              <h3 className="text-sm font-semibold text-gray-800">
                Residence
              </h3>
            </div>

            <Field label="Street / Avenue / Square">
              <input
                type="text"
                value={address}
                disabled={linesLocked}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Enter street, avenue or square"
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="City">
                <input
                  type="text"
                  value={city}
                  disabled={linesLocked}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Enter city"
                  className={inputClass}
                />
              </Field>

              <Field label="Province">
                <input
                  type="text"
                  value={province}
                  disabled={linesLocked}
                  onChange={(event) => setProvince(event.target.value)}
                  placeholder="Enter province"
                  className={inputClass}
                />
              </Field>

              <Field label="CAP / Postal code">
                <input
                  type="text"
                  value={postalCode}
                  disabled={linesLocked}
                  onChange={(event) => setPostalCode(event.target.value)}
                  placeholder="Enter postal code"
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom actions */}
      <div className="mt-7 flex flex-col-reverse justify-end gap-3 sm:flex-row">
        <Link
          href="/our-shop/orders"
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Cancel
        </Link>

        <button
          type="button"
          onClick={() => void saveOrder()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
        >
          <Save size={17} />
          Save changes
        </button>
      </div>
    </main>
  );
}
