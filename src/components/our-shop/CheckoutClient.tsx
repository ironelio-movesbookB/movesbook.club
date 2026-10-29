'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CartNotice } from '@/components/our-shop/CartNotice';
import { shopFetch } from '@/lib/shop/browser';
import { cartAddBlockReason } from '@/lib/shop/cartRules';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  RefreshCw,
  ShoppingBag,
  Trash2,
} from 'lucide-react';

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  imageUrl: string;
  isVisible: boolean;
  allowMultipleUnits?: boolean;
  allowNonMembers?: boolean;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type SavedCartItem = {
  productId: string;
  quantity: number;
};

type UserType = 'affiliated' | 'non-affiliated';

type CustomerDetails = {
  taxCode: string;
  surname: string;
  name: string;
  dateOfBirth: string;
  email: string;
  telephone: string;
  residenceAddress: string;
  city: string;
  province: string;
  cap: string;
};

type ShopData = {
  club: {
    id: string;
    slug: string;
    name: string;
    description: string;
  };
  shopActive: boolean;
  viewer?: { isMember: boolean };
  products: Product[];
};

const euro = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
});

const emptyDetails: CustomerDetails = {
  taxCode: '',
  surname: '',
  name: '',
  dateOfBirth: '',
  email: '',
  telephone: '',
  residenceAddress: '',
  city: '',
  province: '',
  cap: '',
};

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-purple-400 focus:ring-4 focus:ring-purple-50';

const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-700';

function isSavedCartItem(item: unknown): item is SavedCartItem {
  if (!item || typeof item !== 'object') return false;

  const candidate = item as Record<string, unknown>;

  return (
    typeof candidate.productId === 'string' &&
    Number.isInteger(candidate.quantity) &&
    (candidate.quantity as number) > 0
  );
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(
      'The server returned an invalid response. Please try again.',
    );
  }
}

function getErrorMessage(data: unknown, fallback: string): string {
  if (
    data &&
    typeof data === 'object' &&
    'error' in data &&
    typeof data.error === 'string'
  ) {
    return data.error;
  }

  return fallback;
}

export default function CheckoutClient({ slug }: { slug: string }) {
  const router = useRouter();
  const cartStorageKey = `shop-cart:${slug}`;

  const [shop, setShop] = useState<ShopData | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [cartNotice, setCartNotice] = useState('');
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Preserve the purchased items after the active cart is cleared.
  const [confirmedItems, setConfirmedItems] = useState<CartItem[]>([]);
  const [confirmedTotal, setConfirmedTotal] = useState(0);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [details, setDetails] = useState<CustomerDetails>(emptyDetails);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [onsiteSelected, setOnsiteSelected] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function initialise() {
      setLoading(true);
      setError('');

      try {
        const response = await shopFetch(
          `/api/public/shop/${encodeURIComponent(slug)}`,
        );

        const data: unknown = await readJsonResponse(response);

        if (!response.ok) {
          throw new Error(
            getErrorMessage(data, 'Could not load the shop.'),
          );
        }

        if (
          !data ||
          typeof data !== 'object' ||
          !('club' in data) ||
          !('products' in data) ||
          !('shopActive' in data) ||
          !Array.isArray(data.products)
        ) {
          throw new Error('The shop returned invalid data.');
        }

        const shopData = data as ShopData;
        let savedItems: SavedCartItem[] = [];

        try {
          const raw = sessionStorage.getItem(cartStorageKey);
          const parsed: unknown = raw ? JSON.parse(raw) : [];

          if (Array.isArray(parsed)) {
            savedItems = parsed.filter(isSavedCartItem);
          }
        } catch {
          savedItems = [];
        }

        const limitedNotices: string[] = [];
        const restoredCart: CartItem[] = savedItems.flatMap((saved) => {
          const product = shopData.products.find(
            (item) => item.id === saved.productId && item.isVisible,
          );

          if (
            !product ||
            !Number.isFinite(product.price) ||
            product.price < 0 ||
            product.quantity <= 0
          ) {
            return [];
          }

          const member = Boolean(shopData.viewer?.isMember);
          if (product.allowNonMembers === false && !member) {
            limitedNotices.push(`${product.name} is available to members only.`);
            return [];
          }

          let quantity = Math.min(saved.quantity, product.quantity);
          if (product.allowMultipleUnits === false && quantity > 1) {
            quantity = 1;
            limitedNotices.push(`${product.name} can only be added once.`);
          }

          return [{ product, quantity }];
        });

        if (cancelled) return;

        setShop(shopData);
        setCart(restoredCart);
        if (limitedNotices[0]) setCartNotice(limitedNotices[0]);

        try {
          sessionStorage.setItem(
            cartStorageKey,
            JSON.stringify(
              restoredCart.map(({ product, quantity }) => ({
                productId: product.id,
                quantity,
              })),
            ),
          );
        } catch {
          // Checkout remains usable if session storage is unavailable.
        }

        if (!shopData.shopActive) {
          setError(
            'This shop is currently closed and is not accepting orders.',
          );
        } else if (restoredCart.length === 0) {
          setError(
            'Your cart is empty. Return to the shop and add a product.',
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load checkout.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialise();

    return () => {
      cancelled = true;
    };
  }, [slug, cartStorageKey]);

  const totalItems = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart],
  );

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (total, item) => total + item.product.price * item.quantity,
        0,
      ),
    [cart],
  );

  function persistCart(items: CartItem[]) {
    try {
      sessionStorage.setItem(
        cartStorageKey,
        JSON.stringify(
          items.map(({ product, quantity }) => ({
            productId: product.id,
            quantity,
          })),
        ),
      );
    } catch {
      // Cart state remains usable even if session storage fails.
    }
  }

  function updateDetail(key: keyof CustomerDetails, value: string) {
    setDetails((current) => ({ ...current, [key]: value }));
    setError('');
  }

  function removeItem(productId: string) {
    setCart((current) => {
      const updated = current.filter(
        (item) => item.product.id !== productId,
      );

      persistCart(updated);
      return updated;
    });

    setError('');
  }

  function returnToShop() {
    // Reset the previous confirmation.
    setOrderNumber('');
    setConfirmedItems([]);
    setConfirmedTotal(0);

    // Reset checkout state.
    setStep(1);
    setError('');
    setUserType(null);
    setDetails(emptyDetails);
    setPrivacyAccepted(false);
    setOnsiteSelected(false);
    setCart([]);
    setSubmitting(false);

    router.push(`/our-shop/shop/${encodeURIComponent(slug)}`);
  }

  function continueFromCustomerDetails() {
    setError('');

    if (!shop?.shopActive) {
      setError('This shop is currently closed.');
      return;
    }

    if (cart.length === 0) {
      setError('Your cart is empty. Return to the shop and add a product.');
      return;
    }

    if (!userType) {
      setError('Choose whether you are affiliated with the company.');
      return;
    }

    if (!details.taxCode.trim()) {
      setError('Enter your tax code.');
      return;
    }

    if (userType === 'non-affiliated') {
      if (
        !details.surname.trim() ||
        !details.name.trim() ||
        !details.email.trim() ||
        !details.residenceAddress.trim() ||
        !details.city.trim() ||
        !details.province.trim() ||
        !details.cap.trim()
      ) {
        setError('Complete all required personal and address fields.');
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim())) {
        setError('Enter a valid email address.');
        return;
      }

      if (!privacyAccepted) {
        setError('Accept the privacy policy to continue.');
        return;
      }
    }

    setStep(2);
  }

  async function confirmOrder() {
    if (submitting) return;

    setSubmitting(true);
    setError('');

    try {
      if (!shop?.shopActive) {
        throw new Error('This shop is currently closed.');
      }

      if (cart.length === 0) {
        throw new Error(
          'Your cart is empty. Please add some products first.',
        );
      }

      if (!userType) {
        throw new Error('Please select your user type.');
      }

      if (userType === 'non-affiliated' && !privacyAccepted) {
        throw new Error(
          'Please accept the privacy policy before continuing.',
        );
      }

      if (!onsiteSelected) {
        throw new Error('Please select a payment method.');
      }

      const response = await fetch(
        `/api/public/shop/${encodeURIComponent(slug)}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clubSlug: slug,
          userType,
          customerDetails: details,
          privacyPolicyAccepted:
            userType === 'non-affiliated' ? privacyAccepted : false,
          paymentMethod: 'onsite',
          items: cart.map(({ product, quantity }) => ({
            productId: product.id,
            quantity,
          })),
        }),
      });

      const data: unknown = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, 'Could not place your order.'),
        );
      }

      if (
        !data ||
        typeof data !== 'object' ||
        !('orderNumber' in data) ||
        !data.orderNumber
      ) {
        throw new Error(
          'Your order may have been created, but no order number was returned. Please contact the shop before submitting again.',
        );
      }

      const confirmedOrderNumber = String(data.orderNumber);

      // Save confirmation data before clearing the cart.
      const itemsToConfirm = cart.map((item) => ({
        product: item.product,
        quantity: item.quantity,
      }));

      const total = itemsToConfirm.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0,
      );

      try {
        sessionStorage.removeItem(cartStorageKey);
      } catch (storageError) {
        console.error('Could not clear the saved cart:', storageError);
      }

      setConfirmedItems(itemsToConfirm);
      setConfirmedTotal(total);
      setOrderNumber(confirmedOrderNumber);
      setCart([]);
      setError('');

      // The render below checks orderNumber and displays the success page.
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while placing your order.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb]">
        <RefreshCw className="animate-spin text-purple-600" size={32} />
      </main>
    );
  }

  // IMPORTANT: Return the success page before rendering the checkout steps.
  if (orderNumber) {
    return (
      <main className="min-h-screen bg-white px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <div className="border-b border-gray-200 pb-8">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-gray-500">
              Order confirmation
            </p>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-red-600 sm:text-4xl">
              Thank you for your purchase!
            </h1>

            <p className="mt-3 text-lg font-semibold text-gray-900">
              Your order has been completed
            </p>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              Below is a summary of the order requested from{' '}
              {shop?.club.name ?? 'the shop'}.
            </p>
          </div>

          <section className="border-b border-gray-200 py-7">
            <h2 className="text-lg font-semibold text-gray-900">
              After-sales info
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              Please keep your order number for reference if you have any
              questions about your purchase.
            </p>
          </section>

          <section className="border-b border-gray-200 py-7">
            <h2 className="text-lg font-semibold text-gray-900">
              Products purchased
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Order number:{' '}
              <span className="font-semibold text-gray-900">
                {orderNumber}
              </span>
            </p>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left">
                <thead>
                  <tr className="border-y border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-3 pr-4 font-medium">Product name</th>
                    <th className="px-3 py-3 text-center font-medium">
                      Amount
                    </th>
                    <th className="py-3 pl-3 text-right font-medium">
                      Price
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {confirmedItems.map(({ product, quantity }) => (
                    <tr key={product.id}>
                      <td className="py-4 pr-4 text-sm font-medium text-gray-900">
                        {product.name}
                      </td>

                      <td className="px-3 py-4 text-center text-sm text-gray-600">
                        {quantity}
                      </td>

                      <td className="py-4 pl-3 text-right text-sm text-gray-900">
                        {euro.format(product.price * quantity)}
                      </td>
                    </tr>
                  ))}

                  {confirmedItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-4 text-sm text-gray-500"
                      >
                        No product details are available for this order.
                      </td>
                    </tr>
                  )}
                </tbody>

                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td
                      colSpan={2}
                      className="py-4 text-sm font-semibold text-gray-900"
                    >
                      Total
                    </td>
                    <td className="py-4 text-right text-base font-bold text-gray-900">
                      {euro.format(confirmedTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="border-b border-gray-200 py-7">
            <h2 className="text-lg font-semibold text-gray-900">
              Payment method selected
            </h2>

            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-gray-200 px-4 py-4">
              <span className="text-sm text-gray-700">Payment on site</span>

              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                Unpaid
              </span>
            </div>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              Online payment has not been taken. Payment is due at the shop
              when you collect your order.
            </p>
          </section>

          <section className="py-7">
            <h2 className="text-lg font-semibold text-gray-900">
              Ordering information
            </h2>

            <div className="mt-4 rounded-lg border border-gray-200 p-5">
              <div className="space-y-4">
                {Object.entries(details).map(([key, value]) => {
                  const labels: Record<string, string> = {
                    taxCode: 'Tax code',
                    surname: 'Surname',
                    name: 'Name',
                    dateOfBirth: 'Date of birth',
                    email: 'Email',
                    telephone: 'Telephone',
                    residenceAddress: 'Residence address',
                    city: 'City',
                    province: 'Province',
                    cap: 'CAP / postal code',
                  };

                  return (
                    <div
                      key={key}
                      className="grid grid-cols-1 gap-1 sm:grid-cols-[160px_1fr] sm:gap-4"
                    >
                      <p className="text-sm text-gray-500">
                        {labels[key] ?? key}
                      </p>

                      <p className="break-words text-sm font-medium text-gray-900">
                        {value || '—'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="border-t border-gray-200 pt-7">
            <button
              type="button"
              onClick={returnToShop}
              className="inline-flex w-full items-center justify-center rounded-lg bg-black px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-800 sm:w-auto"
            >
              Return to the shop
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Normal checkout page.
  return (
    <main className="min-h-screen bg-[#f7f7fb] px-4 py-8 text-gray-900 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() => router.push(`/our-shop/shop/${encodeURIComponent(slug)}`)}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-purple-700"
        >
          <ArrowLeft size={17} />
          Back to shop
        </button>

        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-600">
            {shop?.club.name ?? 'Shop'}
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {step === 1
              ? 'Order summary'
              : step === 2
                ? 'Payment'
                : 'Complete the order'}
          </h1>

          <p className="mt-3 text-sm text-gray-500">Step {step} of 3</p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[1, 2, 3].map((number) => (
              <div
                key={number}
                className={`h-1.5 rounded-full ${
                  number <= step ? 'bg-purple-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-lg font-bold">Products</h2>

              {cart.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">
                  Your cart is empty.
                </p>
              ) : (
                <div className="mt-5 divide-y divide-gray-100">
                  {cart.map(({ product, quantity }) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{product.name}</p>

                        <p className="mt-1 text-sm text-gray-500">
                          Quantity: {quantity} ×{' '}
                          {euro.format(product.price)}
                        </p>

                        <button
                          type="button"
                          onClick={() => removeItem(product.id)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={13} />
                          Remove from cart
                        </button>
                      </div>

                      <p className="shrink-0 text-sm font-bold">
                        {euro.format(product.price * quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-5">
                <span className="text-sm font-semibold text-gray-600">
                  Cart total · {totalItems}{' '}
                  {totalItems === 1 ? 'item' : 'items'}
                </span>

                <span className="rounded-lg bg-emerald-50 px-3 py-2 text-lg font-bold text-emerald-700 ring-1 ring-emerald-100">
                  {euro.format(subtotal)}
                </span>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-lg font-bold">Type of user</h2>

              <p className="mt-1 text-sm text-gray-500">
                Choose the option that describes you.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      value: 'affiliated',
                      title: 'Affiliated with the company',
                      description:
                        'If you are already affiliated with the company (athlete, parent, coach or management), you just need to enter your tax code to continue.',
                    },
                    {
                      value: 'non-affiliated',
                      title: 'Non-affiliated user',
                      description:
                        'If you are not affiliated with the company, enter your details and proceed with the order.',
                    },
                  ] as const
                ).map((option) => {
                  const selected = userType === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        if (option.value === 'non-affiliated') {
                          const blocked = cart.find(
                            (item) => item.product.allowNonMembers === false,
                          );
                          if (blocked) {
                            setCartNotice(
                              cartAddBlockReason(blocked.product, 1, 0, false) ??
                                `${blocked.product.name} is available to members only.`,
                            );
                            return;
                          }
                        }
                        setUserType(option.value);
                        setError('');
                      }}
                      className={`relative flex min-h-48 flex-col rounded-2xl border p-5 pb-16 text-left transition ${
                        selected
                          ? 'border-purple-700 bg-purple-700 text-white'
                          : 'border-gray-200 bg-white text-gray-900 hover:border-purple-300'
                      }`}
                    >
                      <span className="block pr-2 text-base font-bold leading-6">
                        {option.title}
                      </span>

                      <span
                        className={`mt-3 block text-sm leading-6 ${
                          selected ? 'text-purple-100' : 'text-gray-500'
                        }`}
                      >
                        {option.description}
                      </span>

                      <span
                        aria-hidden="true"
                        className={`absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
                          selected
                            ? 'border-white bg-white text-purple-700'
                            : 'border-gray-300 bg-white text-transparent'
                        }`}
                      >
                        <Check size={21} strokeWidth={2.5} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {userType && (
              <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
                <h2 className="text-lg font-bold">Personal information</h2>

                {userType === 'affiliated' ? (
                  <>
                    <p className="mt-1 text-sm text-gray-500">
                      Enter your tax code to continue.
                    </p>

                    <div className="mt-5">
                      <label className={labelClass} htmlFor="affiliated-tax">
                        Tax code *
                      </label>

                      <input
                        id="affiliated-tax"
                        className={inputClass}
                        value={details.taxCode}
                        onChange={(event) =>
                          updateDetail('taxCode', event.target.value)
                        }
                        maxLength={100}
                        autoComplete="off"
                        required
                      />
                    </div>
                  </>
                ) : (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass} htmlFor="surname">
                        Surname *
                      </label>

                      <input
                        id="surname"
                        className={inputClass}
                        value={details.surname}
                        onChange={(event) =>
                          updateDetail('surname', event.target.value)
                        }
                        autoComplete="family-name"
                        maxLength={120}
                        required
                      />
                    </div>

                    <div>
                      <label className={labelClass} htmlFor="customer-name">
                        Name *
                      </label>

                      <input
                        id="customer-name"
                        className={inputClass}
                        value={details.name}
                        onChange={(event) =>
                          updateDetail('name', event.target.value)
                        }
                        autoComplete="given-name"
                        maxLength={120}
                        required
                      />
                    </div>

                    <div>
                      <label className={labelClass} htmlFor="tax-code">
                        Tax ID code *
                      </label>

                      <input
                        id="tax-code"
                        className={inputClass}
                        value={details.taxCode}
                        onChange={(event) =>
                          updateDetail('taxCode', event.target.value)
                        }
                        maxLength={100}
                        required
                      />
                    </div>

                    <div>
                      <label className={labelClass} htmlFor="date-of-birth">
                        Date of birth
                      </label>

                      <input
                        id="date-of-birth"
                        type="date"
                        className={inputClass}
                        value={details.dateOfBirth}
                        onChange={(event) =>
                          updateDetail('dateOfBirth', event.target.value)
                        }
                      />
                    </div>

                    <div>
                      <label className={labelClass} htmlFor="email">
                        Email *
                      </label>

                      <input
                        id="email"
                        type="email"
                        className={inputClass}
                        value={details.email}
                        onChange={(event) =>
                          updateDetail('email', event.target.value)
                        }
                        autoComplete="email"
                        maxLength={254}
                        required
                      />
                    </div>

                    <div>
                      <label className={labelClass} htmlFor="telephone">
                        Telephone
                      </label>

                      <input
                        id="telephone"
                        type="tel"
                        className={inputClass}
                        value={details.telephone}
                        onChange={(event) =>
                          updateDetail('telephone', event.target.value)
                        }
                        autoComplete="tel"
                        maxLength={40}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelClass} htmlFor="address">
                        Residence address *
                      </label>

                      <input
                        id="address"
                        className={inputClass}
                        value={details.residenceAddress}
                        onChange={(event) =>
                          updateDetail(
                            'residenceAddress',
                            event.target.value,
                          )
                        }
                        autoComplete="street-address"
                        maxLength={250}
                        required
                      />
                    </div>

                    <div>
                      <label className={labelClass} htmlFor="city">
                        City *
                      </label>

                      <input
                        id="city"
                        className={inputClass}
                        value={details.city}
                        onChange={(event) =>
                          updateDetail('city', event.target.value)
                        }
                        autoComplete="address-level2"
                        maxLength={120}
                        required
                      />
                    </div>

                    <div>
                      <label className={labelClass} htmlFor="province">
                        Province *
                      </label>

                      <input
                        id="province"
                        className={inputClass}
                        value={details.province}
                        onChange={(event) =>
                          updateDetail('province', event.target.value)
                        }
                        maxLength={120}
                        required
                      />
                    </div>

                    <div>
                      <label className={labelClass} htmlFor="cap">
                        CAP / postal code *
                      </label>

                      <input
                        id="cap"
                        className={inputClass}
                        value={details.cap}
                        onChange={(event) =>
                          updateDetail('cap', event.target.value)
                        }
                        autoComplete="postal-code"
                        maxLength={20}
                        required
                      />
                    </div>

                    <label className="flex items-start gap-3 text-sm text-gray-600 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={privacyAccepted}
                        onChange={(event) =>
                          setPrivacyAccepted(event.target.checked)
                        }
                        className="mt-1 h-4 w-4 accent-purple-600"
                      />

                      <span>
                        I declare that I have read the{' '}
                        <a
                          href="/privacy"
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-purple-700 underline"
                        >
                          privacy policy
                        </a>
                        .
                      </span>
                    </label>
                  </div>
                )}
              </section>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={continueFromCustomerDetails}
                disabled={
                  !shop?.shopActive || !userType || cart.length === 0
                }
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue to payment
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-bold">Payment method</h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Choose how you will pay for this order. Online payment is not
              connected yet, so this version supports payment at the shop.
            </p>

            <div className="mt-6 rounded-2xl border border-purple-300 bg-purple-50 p-5">
              <div className="flex items-start gap-3">
                <ShoppingBag className="mt-0.5 text-purple-700" size={22} />

                <div>
                  <h3 className="font-bold text-gray-900">
                    Collect and pay on site
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    Place your order now and arrange payment with the company
                    when you collect it. No online payment will be taken.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-5">
              <span className="text-sm font-semibold text-gray-600">
                Order total
              </span>

              <span className="rounded-lg bg-emerald-50 px-3 py-2 text-lg font-bold text-emerald-700 ring-1 ring-emerald-100">
                {euro.format(subtotal)}
              </span>
            </div>

            <div className="mt-6 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setStep(1);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <button
                type="button"
                disabled={cart.length === 0 || !shop?.shopActive}
                onClick={() => {
                  setOnsiteSelected(true);
                  setError('');
                  setStep(3);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-bold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
                <ArrowRight size={16} />
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-bold">Complete the order</h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Check your total and confirm that you will collect and pay on
              site.
            </p>

            <div className="mt-6 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-4">
              <span className="text-sm font-semibold text-gray-600">
                Total due at collection
              </span>

              <span className="text-xl font-bold text-gray-900">
                {euro.format(subtotal)}
              </span>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4">
              <input
                type="checkbox"
                checked={onsiteSelected}
                onChange={(event) =>
                  setOnsiteSelected(event.target.checked)
                }
                className="mt-1 h-4 w-4 accent-purple-600"
              />

              <span>
                <span className="block font-semibold text-gray-900">
                  Collect and pay on site
                </span>

                <span className="mt-1 block text-sm leading-6 text-gray-500">
                  By selecting this method, you will place the order and can
                  arrange payment with the company at a later time.
                </span>
              </span>
            </label>

            <div className="mt-6 flex justify-between gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setError('');
                  setStep(2);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <button
                type="button"
                onClick={() => void confirmOrder()}
                disabled={
                  submitting ||
                  !onsiteSelected ||
                  cart.length === 0 ||
                  !shop?.shopActive
                }
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-bold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <RefreshCw size={17} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={17} />
                )}

                {submitting ? 'Submitting order...' : 'Confirm order'}
              </button>
            </div>
          </section>
        )}

        <p className="mt-6 text-center text-xs leading-5 text-gray-400">
          Your order total is recalculated from the products stored by the shop.
          No online payment is taken in this version.
        </p>
      </div>
      <CartNotice message={cartNotice} onClose={() => setCartNotice('')} />
    </main>
  );
}