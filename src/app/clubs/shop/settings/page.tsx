'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Settings as SettingsIcon,
  Store,
  Bell,
  CreditCard,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Check,
} from 'lucide-react';
import { ShopFrame, ShopHeader } from '@/components/our-shop/pageChrome';
import { shopFetch } from '@/lib/shop/browser';
import ProcedurePagination from '@/components/procedures/ProcedurePagination';

type ShopSettings = {
  clubId: string;
  shopName: string;
  shopDescription: string;
  shopActive: boolean;
  orderEmailsEnabled: boolean;
  headerMode: 'logo' | 'banner';
  onsitePaymentEnabled: boolean;
  bankTransferEnabled: boolean;
  bankTransferDetails: string;
  onlinePaymentEnabled: boolean;
  onlinePaymentReady?: boolean;
  shopAlert: string;
  afterSalesInfo: string;
  publicPath?: string;
  updatedAt: string;
};

const EDITABLE_KEYS = [
  'shopName',
  'shopDescription',
  'shopActive',
  'orderEmailsEnabled',
  'headerMode',
  'onsitePaymentEnabled',
  'bankTransferEnabled',
  'bankTransferDetails',
  'onlinePaymentEnabled',
  'shopAlert',
  'afterSalesInfo',
] as const;

const defaults: Omit<ShopSettings, 'updatedAt'> = {
  clubId: '',
  shopName: '',
  shopDescription: '',
  shopActive: true,
  orderEmailsEnabled: true,
  headerMode: 'logo',
  onsitePaymentEnabled: true,
  bankTransferEnabled: false,
  bankTransferDetails: '',
  onlinePaymentEnabled: false,
  shopAlert: '',
  afterSalesInfo: '',
  publicPath: '',
};

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-100';

const sectionTitleClass = 'text-base font-semibold text-gray-800';

export default function SettingsPage() {
  const [settings, setSettings] = useState<ShopSettings>({
    ...defaults,
    updatedAt: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedSettings, setSavedSettings] =
    useState<ShopSettings | null>(null);
  const [origin, setOrigin] = useState('');
  const [label, setLabel] = useState<'settings' | 'products'>('settings');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await shopFetch('/api/club/shop/settings');

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not load settings.');
      }

      setSettings(data as ShopSettings);
      setSavedSettings(data as ShopSettings);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load settings.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
    setOrigin(window.location.origin);
  }, [loadSettings]);

  const hasChanges = savedSettings
    ? EDITABLE_KEYS.some((key) => settings[key] !== savedSettings[key])
    : false;

  function updateSetting<K extends keyof ShopSettings>(
    key: K,
    value: ShopSettings[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));

    setSuccess('');
    setError('');
  }

  async function saveSettings() {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await shopFetch('/api/club/shop/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          Object.fromEntries(EDITABLE_KEYS.map((key) => [key, settings[key]])),
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not save settings.');
      }

      setSettings(data as ShopSettings);
      setSavedSettings(data as ShopSettings);
      setSuccess('Your settings have been saved successfully.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save settings.',
      );
    } finally {
      setSaving(false);
    }
  }

  function resetSettings() {
    if (!savedSettings) return;
    setSettings(savedSettings);
    setSuccess('');
    setError('');
  }

  return (
    <ShopFrame>
        <ShopHeader title="Settings" subtitle="Settings related to the sellings">
              <button
                type="button"
                onClick={resetSettings}
                disabled={loading || saving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-purple-300 bg-white px-4 text-sm font-semibold text-purple-700 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw size={16} />
                Reset
              </button>

              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={
                  loading ||
                  saving ||
                  !hasChanges ||
                  !settings.shopName.trim()
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {saving ? 'Saving...' : 'Save'}
              </button>
        </ShopHeader>

        {/* API feedback */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Something went wrong</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle2 size={17} />
            {success}
          </div>
        )}

        {label === 'settings' && settings.publicPath && (
          <div className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${origin}${settings.publicPath}`)}`}
              alt="QR code for the purchase page"
              width={140}
              height={140}
              className="h-[140px] w-[140px] rounded-lg border border-gray-100"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">Purchase page</p>
              <a className="mt-1 block break-all text-sm font-semibold text-purple-700" href={settings.publicPath}>
                {origin}{settings.publicPath}
              </a>
              <p className="mt-2 text-sm text-gray-500">
                Share this link or QR code. Customers open the club or team shop, choose products, and collect and pay on site.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={label === 'settings'}
            onClick={() => setLabel('settings')}
            className={`h-10 rounded-lg px-4 text-sm font-semibold ${
              label === 'settings'
                ? 'bg-purple-700 text-white'
                : 'border border-purple-300 bg-white text-purple-800 hover:bg-purple-50'
            }`}
          >
            Settings
          </button>
          <button
            type="button"
            aria-pressed={label === 'products'}
            onClick={() => setLabel('products')}
            className={`h-10 rounded-lg px-4 text-sm font-semibold ${
              label === 'products'
                ? 'bg-purple-700 text-white'
                : 'border border-purple-300 bg-white text-purple-800 hover:bg-purple-50'
            }`}
          >
            Products available in the shop
          </button>
        </div>

        {label === 'products' ? (
          <AvailableProducts />
        ) : loading ? (
          <div className="rounded-xl border border-gray-100 bg-white px-6 py-12 text-center text-sm text-gray-500 shadow-sm">
            <RefreshCw
              className="mx-auto mb-3 animate-spin text-gray-400"
              size={22}
            />
            Loading shop settings...
          </div>
        ) : (
          <>
            {/* Shop identity */}
            <SettingsSection title="Shop">
              <div className="space-y-5">
                <Field label="Official club or team name">
                  <input
                    value={settings.shopName}
                    onChange={(event) => updateSetting('shopName', event.target.value)}
                    placeholder="Name shown at the top of the purchase page"
                    className={inputClass}
                  />
                </Field>
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700">Top of the shop page</p>
                  <div className="flex flex-wrap gap-5">
                    {(
                      [
                        ['logo', 'Logo'],
                        ['banner', 'Banner'],
                      ] as const
                    ).map(([mode, label]) => (
                      <label key={mode} className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                        <input
                          type="radio"
                          name="shopHeaderMode"
                          checked={settings.headerMode === mode}
                          onChange={() => updateSetting('headerMode', mode)}
                          className="h-4 w-4 accent-purple-600"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-gray-400">
                    Logo shows the club or team logo above the name. Banner puts the club or team banner behind the
                    name, as on the sponsor kit page. Both come from the club or team profile; without a banner the
                    logo is shown.
                  </p>
                </div>
                <SettingsCheckbox
                  checked={settings.shopActive}
                  onChange={(value) => updateSetting('shopActive', value)}
                  label="Shop is open for purchases"
                  description="When this is off, customers can see the page but cannot place an order."
                />
                <SettingsCheckbox
                  checked={settings.orderEmailsEnabled}
                  onChange={(value) => updateSetting('orderEmailsEnabled', value)}
                  label="Keep an order-notification preference"
                  description="Saved with the shop. Orders themselves stay pending and unpaid until staff collect payment."
                />
              </div>
            </SettingsSection>

            {/* Payment methods */}
            <SettingsSection title="Payment methods">
              <div className="space-y-6">
                <SettingsCheckbox
                  checked={settings.onlinePaymentEnabled}
                  onChange={(value) => updateSetting('onlinePaymentEnabled', value)}
                  label="Enable order completion with online payment"
                  description="Customers pay by card or PayPal on the club or team account set in Payment methods for members. The selling is marked paid when the payment arrives."
                />
                {settings.onlinePaymentEnabled && settings.onlinePaymentReady === false && (
                  <p className="-mt-3 text-xs leading-5 text-amber-700">
                    No card or PayPal account is connected yet, so customers will not see this option. Connect one
                    in Payment methods for members.
                  </p>
                )}

                <div className="border-t border-gray-100 pt-5">
                  <SettingsCheckbox
                    checked={settings.bankTransferEnabled}
                    onChange={(value) => updateSetting('bankTransferEnabled', value)}
                    label="Enable order completion with bank transfer"
                    description="Customers place the order and pay by bank transfer, then send their payment receipt. The selling stays unpaid until staff register the payment."
                  />
                  {settings.bankTransferEnabled && (
                    <div className="mt-4">
                      <Field label="Bank details shown to the customer">
                        <textarea
                          value={settings.bankTransferDetails}
                          onChange={(event) => updateSetting('bankTransferDetails', event.target.value)}
                          rows={3}
                          placeholder="Account holder, IBAN, bank, and where to send the receipt"
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100 pt-5">
                  <SettingsCheckbox
                    checked={settings.onsitePaymentEnabled}
                    onChange={(value) => updateSetting('onsitePaymentEnabled', value)}
                    label="Collect and pay on site"
                    description="Customers collect the order and pay at the club or team. The order stays unpaid until staff register the payment."
                  />
                </div>
              </div>
            </SettingsSection>

            {/* Customizations */}
            <SettingsSection title="Customizations">
              <div className="space-y-7">
                <div>
                  <h3 className="text-sm font-medium text-gray-800">
                    Edit introductory text
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-gray-400">
                    If text is inserted, it will be displayed at the top of
                    the page, under the main title.
                  </p>

                  <textarea
                    value={settings.shopDescription}
                    onChange={(event) => updateSetting('shopDescription', event.target.value)}
                    rows={4}
                    placeholder="Introduce your shop to customers..."
                    className={`${inputClass} mt-4`}
                  />
                </div>

                <div className="border-t border-gray-100 pt-6">
                  <h3 className="text-sm font-medium text-gray-800">
                    Add an alert
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-gray-400">
                    Display an important notice throughout the shop, such as
                    closure notices or collection information.
                  </p>

                  <textarea
                    value={settings.shopAlert}
                    onChange={(event) => updateSetting('shopAlert', event.target.value)}
                    rows={3}
                    placeholder="Enter an important notice for customers..."
                    className={`${inputClass} mt-4`}
                  />
                </div>

                <div className="border-t border-gray-100 pt-6">
                  <h3 className="text-sm font-medium text-gray-800">
                    Add after-sales information
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-gray-400">
                    Display delivery, collection, return, or other information
                    on the customer's order summary page.
                  </p>

                  <textarea
                    value={settings.afterSalesInfo}
                    onChange={(event) => updateSetting('afterSalesInfo', event.target.value)}
                    rows={3}
                    placeholder="Enter after-sales information..."
                    className={`${inputClass} mt-4`}
                  />
                </div>
              </div>
            </SettingsSection>

            {/* Save status */}
            <div className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {hasChanges ? 'Unsaved changes' : 'All changes saved'}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  {settings.updatedAt
                    ? `Last saved: ${new Date(settings.updatedAt).toLocaleString()}`
                    : 'Save the official name, the purchase page, and which products customers can buy.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={
                  saving || !hasChanges || !settings.shopName.trim()
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {saving ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </>
        )}
    </ShopFrame>
  );
}

/* Reference layout: section title left, content card right */
function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
      <div className="pt-1">
        <h2 className={sectionTitleClass}>{title}</h2>
      </div>

      <div className="min-w-0 lg:col-span-2">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
          {children}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function AvailableProducts() {
  const [products, setProducts] = useState<{ id: string; name: string; price: number; quantity: number; hideFromShop?: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    shopFetch('/api/club/shop/products')
      .then(async (response) => {
        const data = await response.json();
        if (Array.isArray(data)) setProducts(data.filter((product) => !product.hideFromShop && product.quantity > 0));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const pageCount = Math.max(1, Math.ceil(products.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visible = products.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={sectionTitleClass}>Products available in the shop</h2>
          <p className="mt-1 text-sm text-gray-500">
            Visible products that still have stock. Open a name to edit it.
          </p>
        </div>
        {products.length > 0 ? (
          <ProcedurePagination
            page={safePage}
            pageSize={pageSize}
            total={products.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        ) : null}
      </div>
      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Loading products...</p>
      ) : products.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No visible products with stock yet. Add them from Products.</p>
      ) : (
        <ul className="mt-5 divide-y divide-gray-100">
          {visible.map((product) => (
            <li key={product.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <a className="font-medium text-purple-700" href={`/clubs/shop/products/${product.id}`}>
                {product.name}
              </a>
              <span className="shrink-0 text-gray-500">€{Number(product.price).toFixed(2)} · {product.quantity} in stock</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* Existing settings are interactive; reference-only settings are display-only */
function SettingsCheckbox({
  checked,
  onChange,
  label,
  description,
  visualOnly = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  visualOnly?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-sm font-medium leading-5 text-gray-800">
          {label}
        </p>

        {description && (
          <p className="mb-3 text-xs leading-5 text-gray-400">
            {description}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={label}
            aria-disabled={visualOnly}
            disabled={visualOnly}
            onClick={() => {
              if (!visualOnly) onChange(!checked);
            }}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
              checked
                ? 'border-purple-600 bg-purple-600 text-white shadow-sm'
                : 'border-gray-300 bg-white text-transparent'
            } ${
              visualOnly
                ? 'cursor-not-allowed opacity-60'
                : 'hover:border-purple-400'
            }`}
          >
            {checked && <Check size={16} strokeWidth={3} />}
          </button>

          <span
            className={`text-[10px] font-bold tracking-wider ${
              checked ? 'text-purple-700' : 'text-gray-400'
            }`}
          >
            {checked ? 'ACTIVE' : 'INACTIVE'}
          </span>

          {visualOnly && (
            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              UI preview
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
