'use client';
import { Suspense, useState } from 'react';

import Link from 'next/link';
import { Package } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import ClubArchivePage from '@/components/club/archives/ClubArchivePage';
import type { Column, Member } from '@/types/clubTable';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';
import { getProcedureDefinition } from '@/lib/procedures/registry';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';
import { shopFetch } from '@/lib/shop/browser';

const def = getProcedureDefinition(PROCEDURE_TYPE_CODES.PRODUCT_SALE)!;

function money(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(amount);
}

function MemberPicture({ name, src }: { name: string; src: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-100 text-sm font-semibold text-teal-800">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        name.trim().charAt(0).toUpperCase() || '?'
      )}
    </span>
  );
}

function ProductImage({ src }: { src: string }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <Package size={16} className="text-gray-400" />
      )}
    </span>
  );
}

function RestAmount({ value }: { value: unknown }) {
  const amount = Number(value);
  const settled = !Number.isFinite(amount) || amount <= 0;
  return <span className={`font-semibold ${settled ? 'text-green-900' : 'text-red-600'}`}>{money(value)}</span>;
}

function saleRowClass(row: Member) {
  if (row.status === 'Cancelled') return '!bg-gray-100 text-gray-500';
  if (row.status === 'Pending') return '!bg-blue-50 text-blue-800';
  return 'text-black';
}

function ValuePaid({ value, paid }: { value: unknown; paid: unknown }) {
  const discounted = Number(paid) < Number(value);
  return (
    <div className="text-xs leading-5">
      <div>Value <span className="font-semibold">{money(value)}</span></div>
      <div>
        Cost paid <span className="font-semibold">{money(paid)}</span>
        {discounted && <span className="ml-1 text-orange-600">(discount applied)</span>}
      </div>
    </div>
  );
}

function procedureIdOf(row: Member) {
  if (row.procedureRecordId) return String(row.procedureRecordId);
  const id = String(row.id ?? '');
  return id.startsWith('proc-') ? id.slice(5) : '';
}

function SaleOptions({ row, onDeleted }: { row: Member; onDeleted: () => void }) {
  const router = useRouter();
  const recordId = procedureIdOf(row);
  if (!recordId) return <span>-</span>;

  async function handleDelete() {
    if (!window.confirm('Delete selling? This does not issue a refund.')) return;
    const response = await shopFetch('/api/club/shop/orders', {
      method: 'PATCH',
      body: JSON.stringify({ orderId: recordId, status: 'cancelled' }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      window.alert(typeof data.error === 'string' ? data.error : 'Could not delete this selling.');
      return;
    }
    onDeleted();
  }

  return (
    <div className="flex flex-wrap gap-2 text-xs font-semibold">
      <button type="button" className="text-purple-700" onClick={() => router.push(`/clubs/shop/orders/${encodeURIComponent(recordId)}`)}>
        Edit
      </button>
      <button
        type="button"
        className="text-teal-800"
        onClick={() => router.push(`/clubs/payment_detail/${encodeURIComponent(recordId)}?type=product_sale`)}
      >
        Open purchase
      </button>
      <button type="button" className="text-red-600" onClick={() => void handleDelete()}>
        Delete
      </button>
    </div>
  );
}

function ProductSaleListPageInner() {
  const searchParams = useSearchParams();
  const productId = searchParams?.get('productId') || '';
  const productName = searchParams?.get('productName')?.trim() || 'selected product';
  const [refreshKey, setRefreshKey] = useState(0);
  const [photoMode, setPhotoMode] = useState<'with' | 'without'>('with');
  const columns: Column[] = [
    { key: 'category', header: 'No.' },
    {
      key: 'description',
      header: 'Image',
      sortable: false,
      render: (value) => <ProductImage src={typeof value === 'string' ? value : ''} />,
    },
    { key: 'course', header: 'Product' },
    { key: 'insertDate', header: 'Date selling' },
    {
      key: 'name',
      header: 'Member',
      render: (value, row) => (
        <span className="inline-flex items-center gap-2">
          {photoMode === 'with' ? (
            <MemberPicture
              name={String(value ?? '')}
              src={resolvePublicImageUrl(typeof row.image === 'string' ? row.image : null)}
            />
          ) : null}
          <span>{String(value ?? '-')}</span>
        </span>
      ),
    },
    { key: 'typology', header: 'Typology' },
    { key: 'casual', header: 'Sector' },
    {
      key: 'value',
      header: 'Value / Cost paid',
      render: (value, row) => <ValuePaid value={value} paid={row.paid} />,
    },
    { key: 'rest', header: 'Rest', render: (value) => <RestAmount value={value} /> },
    { key: 'status', header: 'Status' },
    { key: 'operator', header: 'Operator' },
    { key: 'service', header: 'Receipt' },
    {
      key: 'options',
      header: 'Options',
      sortable: false,
      render: (_value, row) => (
        <SaleOptions row={row} onDeleted={() => setRefreshKey((value) => value + 1)} />
      ),
    },
  ];

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {productId ? (
          <Link
            href={def.routes.records}
            className="px-4 py-2 rounded border border-teal-700 text-sm font-semibold text-teal-800 hover:bg-teal-50"
          >
            All sellings
          </Link>
        ) : null}
        <Link
          href={def.routes.form}
          className="px-4 py-2 bg-teal-700 text-white rounded text-sm hover:bg-teal-800"
        >
          {def.archiveTitles.newRecordButton}
        </Link>
      </div>
      <ClubArchivePage
        title={productId ? `${def.archiveTitles.records} · ${productName}` : def.archiveTitles.records}
        archiveType="product-sale-lines"
        columns={columns}
        refreshKey={refreshKey}
        getRowClassName={saleRowClass}
        photoMode={photoMode}
        onPhotoModeChange={setPhotoMode}
        footerHint={
          productId
            ? `Only sellings that include ${productName}.`
            : 'One row per product sold. Products bought in the same selling share the same No. and Receipt.'
        }
        emptyMessage={
          productId
            ? `No sellings found for ${productName}. This product has not been sold yet.`
            : 'No records found.'
        }
      />
    </div>
  );
}

export default function ProductSaleListPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading archive of sellings...</div>}>
      <ProductSaleListPageInner />
    </Suspense>
  );
}
