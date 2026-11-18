
'use client';

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { shopFetch } from '@/lib/shop/browser';
import { ShopFrame, ShopHeader } from '@/components/our-shop/pageChrome';
import { useSuperAdminPassword } from '@/components/admin/SuperAdminPasswordModal';
import { SHOP_SECTORS, shopProductListPath, shopSector } from '@/lib/shop/sectors';
import {
  ArrowLeft,
  ChevronDown,
  ImagePlus,
  MoreHorizontal,
  Save,
  Trash2,
  X,
} from 'lucide-react';

type Product = {
  id: string;
  clubId: string;
  name: string;
  description: string;
  price: number;
  vatRate: number;
  quantity: number;
  imageUrl: string;
  isVisible: boolean;
  hideFromShop?: boolean;
  allowMultipleUnits?: boolean;
  allowNonMembers?: boolean;
  sector?: string;
  createdAt?: string;
  updatedAt?: string;
};

type Props = {
  productId?: string;
};

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-100';

const sectionTitleClass = 'text-base font-semibold text-gray-800';

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
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

/**
 * Configuration checkbox.
 * The label appears above the checkbox.
 * The status appears to the right of the checkbox.
 */
function ConfigCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 min-h-10 text-sm font-medium leading-5 text-gray-800">
        {label}
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-100 ${
            checked
              ? 'border-purple-600 bg-purple-600'
              : 'border-gray-300 bg-white hover:border-purple-400'
          }`}
        >
          {checked && (
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className="h-5 w-5 text-white"
              aria-hidden="true"
            >
              <path
                d="M4.5 10.5L8 14L15.5 6.5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        <span
          className={`text-xs font-bold tracking-wider transition-colors ${
            checked ? 'text-purple-600' : 'text-gray-400'
          }`}
        >
          {checked ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </div>
    </div>
  );
}

function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {children}
    </div>
  );
}

export default function ProductForm({ productId }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(productId);
  const { requestPassword, passwordModal } = useSuperAdminPassword();

  const [name, setName] = useState('');
  const [sector, setSector] = useState('Shop');
  const [savedSector, setSavedSector] = useState('Shop');

  useEffect(() => {
    if (productId) return;
    const requested = new URLSearchParams(window.location.search).get('sector');
    if (requested) setSector(shopSector(requested));
  }, [productId]);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0.00');
  const [vatRate, setVatRate] = useState('21');
  const [quantity, setQuantity] = useState('0');
  const [imageUrl, setImageUrl] = useState('');
  const [isVisible, setIsVisible] = useState(true);

  // Configuration checkbox states
  const [hideFromShop, setHideFromShop] = useState(false);
  const [allowMultipleUnits, setAllowMultipleUnits] = useState(false);
  const [allowNonMembers, setAllowNonMembers] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProduct() {
      try {
        setLoading(true);
        setError('');

        const response = await shopFetch('/api/club/shop/products');

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Could not load products.');
        }

        const products: Product[] = Array.isArray(data)
          ? data
          : Array.isArray(data.products)
            ? data.products
            : [];

        const product = products.find((item) => item.id === productId);

        if (!product) {
          throw new Error('This product could not be found.');
        }

        if (cancelled) return;

        setName(product.name ?? '');
        setSector(product.sector || 'Shop');
        setSavedSector(product.sector || 'Shop');
        setDescription(product.description ?? '');
        setPrice(String(product.price ?? 0));
        setVatRate(String(product.vatRate ?? 21));
        setQuantity(String(product.quantity ?? 0));
        setImageUrl(product.imageUrl ?? '');
        setPreviewUrl(product.imageUrl ?? '');
        setIsVisible(product.isVisible ?? true);
        setHideFromShop(Boolean(product.hideFromShop) || !(product.isVisible ?? true));
        setAllowMultipleUnits(Boolean(product.allowMultipleUnits));
        setAllowNonMembers(product.allowNonMembers !== false);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load product.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProduct();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    if (!selectedFile) return;

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  function handleImageChange(file?: File) {
    setError('');

    if (!file) return;

    const validTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];

    if (!validTypes.includes(file.type)) {
      setError('Choose a JPG, PNG, WEBP or GIF image.');

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('The image must be no larger than 5 MB.');

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      return;
    }

    setSelectedFile(file);
  }

  function removeImage() {
    setSelectedFile(null);
    setImageUrl('');
    setPreviewUrl('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function hardwarePasswordIfNeeded() {
    if (shopSector(sector) !== 'Hardware' && shopSector(savedSector) !== 'Hardware') {
      return '';
    }
    const password = await requestPassword({
      title: 'List of hardware purchasable',
      message: 'Enter the Super Admin password to insert, edit, or delete hardware products.',
    });
    return password;
  }

  async function uploadImage(): Promise<string> {
    if (!selectedFile) return imageUrl;

    const formData = new FormData();
    formData.append('file', selectedFile);

    const response = await shopFetch('/api/club/shop/uploads', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || typeof data.imageUrl !== 'string') {
      throw new Error(data.error || 'Could not upload the image.');
    }

    return data.imageUrl;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const parsedPrice = Number(price);
    const parsedVat = Number(vatRate);
    const parsedQuantity = Number(quantity);

    if (!name.trim()) {
      setError('Enter a product name.');
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError('Enter a valid non-negative price.');
      return;
    }

    if (!Number.isFinite(parsedVat) || parsedVat < 0 || parsedVat > 100) {
      setError('Enter a VAT rate between 0 and 100.');
      return;
    }

    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity < 0) {
      setError('Stock must be a non-negative whole number.');
      return;
    }

    try {
      const hardwarePassword = await hardwarePasswordIfNeeded();
      if (hardwarePassword === null) return;

      setSaving(true);

      const uploadedImageUrl = await uploadImage();

      const payload = {
        ...(productId ? { id: productId } : {}),
        name: name.trim(),
        description: description.trim(),
        price: parsedPrice,
        vatRate: parsedVat,
        quantity: parsedQuantity,
        imageUrl: uploadedImageUrl,
        isVisible: !hideFromShop,
        hideFromShop,
        allowMultipleUnits,
        allowNonMembers,
        sector,
        ...(hardwarePassword ? { superAdminPassword: hardwarePassword } : {}),
      };

      const response = await shopFetch('/api/club/shop/products', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Could not save the product.');
      }

      router.push(shopProductListPath(sector));
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save the product.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct() {
    if (!productId) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this product? This action cannot be undone.',
    );

    if (!confirmed) return;

    try {
      const hardwarePassword = await hardwarePasswordIfNeeded();
      if (hardwarePassword === null) return;

      setSaving(true);
      setError('');

      const response = await shopFetch(
        `/api/club/shop/products?id=${encodeURIComponent(productId)}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(hardwarePassword ? { superAdminPassword: hardwarePassword } : {}),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Could not delete the product.');
      }

      router.push(shopProductListPath(sector));
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not delete the product.',
      );
    } finally {
      setSaving(false);
      setActionsOpen(false);
    }
  }

  async function duplicateProduct() {
    if (!productId) return;
    try {
      const hardwarePassword = await hardwarePasswordIfNeeded();
      if (hardwarePassword === null) return;

      setSaving(true);
      setError('');
      const response = await shopFetch(
        `/api/club/shop/products/${encodeURIComponent(productId)}/duplicate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(hardwarePassword ? { superAdminPassword: hardwarePassword } : {}),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not duplicate the product.');
      router.push(`/clubs/shop/products/${encodeURIComponent(data.id)}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not duplicate the product.');
    } finally {
      setSaving(false);
      setActionsOpen(false);
    }
  }

  if (loading) {
    return (
      <ShopFrame>
        Loading product...
      </ShopFrame>
    );
  }

  return (
    <>
      {passwordModal}
    <form
      onSubmit={handleSubmit}
      className="space-y-4 md:space-y-6"
    >
      <ShopHeader
        title={isEditing ? name || 'Edit product' : 'New product'}
        subtitle={`Shop / Products / ${isEditing ? 'Edit product' : 'New product'}`}
      >
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={17} />
              {saving ? 'Saving...' : 'Save'}
            </button>

            <div className="relative">
              <button
                type="button"
                aria-expanded={actionsOpen}
                onClick={() => setActionsOpen((value) => !value)}
                className="inline-flex items-center gap-2 rounded-lg border border-purple-300 bg-white px-4 py-2.5 text-sm font-medium text-purple-700 transition hover:bg-purple-50"
              >
                <MoreHorizontal size={18} />
                Actions
                <ChevronDown size={14} />
              </button>

              {actionsOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close actions menu"
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setActionsOpen(false)}
                  />

                  <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      disabled={!isEditing || saving}
                      onClick={() => void duplicateProduct()}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      disabled={!isEditing || saving}
                      onClick={() => void deleteProduct()}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={16} />
                      Delete product
                    </button>
                  </div>
                </>
              )}
            </div>
      </ShopHeader>

      <Link
        href={shopProductListPath(sector)}
        className="inline-flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700"
      >
        <ArrowLeft size={16} />
        Return to the list
      </Link>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      {/* Main data */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="pt-1">
          <h2 className={sectionTitleClass}>Main data</h2>
        </div>

        <div className="min-w-0 lg:col-span-2">
          <div className="space-y-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
              <div className="sm:col-span-3">
                <Field label="Sector" required>
                  <select className={inputClass} value={sector} onChange={(event) => setSector(event.target.value)}>
                    {SHOP_SECTORS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Name" required>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Sponsor T-shirt"
                    maxLength={200}
                    required
                    className={inputClass}
                  />
                </Field>
              </div>

              <div>
                <Field label="Gross price (€)" required>
                  <input
                    type="number"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    min="0"
                    step="0.01"
                    required
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="VAT rate" required>
                <select
                  value={vatRate}
                  onChange={(event) => setVatRate(event.target.value)}
                  className={inputClass}
                >
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="9">9%</option>
                  <option value="10">10%</option>
                  <option value="12">12%</option>
                  <option value="20">20%</option>
                  <option value="21">21%</option>
                  <option value="22">22%</option>
                  <option value="23">23%</option>
                  <option value="25">25%</option>
                </select>
              </Field>

              <Field label="Quantity in stock" required>
                <input
                  type="number"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  min="0"
                  step="1"
                  required
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the product and its features..."
                rows={5}
                maxLength={3000}
                className={`${inputClass} min-h-32 resize-y`}
              />
            </Field>

            <Field label="Product image">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(event) =>
                  handleImageChange(event.target.files?.[0])
                }
                className="hidden"
              />

              {!previewUrl ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center transition hover:border-purple-400 hover:bg-purple-50/40"
                >
                  <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-purple-600 shadow-sm">
                    <ImagePlus size={23} />
                  </span>

                  <span className="text-sm font-medium text-gray-700">
                    Choose an image
                  </span>

                  <span className="mt-1 text-xs text-gray-400">
                    JPG, PNG, WEBP or GIF · Maximum 5 MB
                  </span>
                </button>
              ) : (
                <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center">
                  <div className="flex h-36 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white sm:w-40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt={name ? `${name} product preview` : 'Product preview'}
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="break-all text-sm font-medium text-gray-800">
                      {selectedFile?.name || 'Current product image'}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      This image will be shown with the product when it is
                      visible in the online shop.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-lg border border-purple-200 bg-white px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-50"
                      >
                        Change image
                      </button>

                      <button
                        type="button"
                        onClick={removeImage}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600"
                      >
                        <X size={14} />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </Field>
          </div>
        </div>
      </section>

      {/* Configuration */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="pt-1">
          <h2 className={sectionTitleClass}>Configuration</h2>
        </div>

        <div className="min-w-0 lg:col-span-2">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
            {/* First row: two checkboxes */}
            <div className="grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2">
              <ConfigCheckbox
                label="Hide from the online shop"
                checked={hideFromShop}
                onChange={(checked) => {
                  setHideFromShop(checked);
                  setIsVisible(!checked);
                }}
              />

              <ConfigCheckbox
                label="Possibility to purchase multiple units together"
                checked={allowMultipleUnits}
                onChange={setAllowMultipleUnits}
              />
            </div>

            {/* Second row: one checkbox */}
            <div className="mt-7 border-t border-gray-100 pt-6">
              <ConfigCheckbox
                label="Also available for purchase by non-members"
                checked={allowNonMembers}
                onChange={setAllowNonMembers}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Bottom actions */}
      <div className="mt-7 flex flex-col-reverse justify-end gap-3 sm:flex-row">
        <Link
          href="/clubs/shop/products/shop"
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </Link>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={17} />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
    </>
  );
}
