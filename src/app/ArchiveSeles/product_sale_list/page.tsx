'use client';
import { Suspense, useState } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import ClubArchivePage from '@/components/club/archives/ClubArchivePage';
import type { Column, Member } from '@/types/clubTable';
import { getProcedureDefinition } from '@/lib/procedures/registry';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';
import { shopFetch } from '@/lib/shop/browser';

const def = getProcedureDefinition(PROCEDURE_TYPE_CODES.PRODUCT_SALE)!;

function money(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(amount);
}

function ProductCount({ row }: { row: Member }) {
  const [open, setOpen] = useState(false);
  const count = Number(row.number) || 0;
  const lines = row.purchaseLines ?? [];
  if (!count && lines.length === 0) return <span>-</span>;
  return (
    <>
      <button type="button" className="font-semibold text-teal-800 underline" onClick={() => setOpen(true)}>
        {count || lines.reduce((sum, line) => sum + line.quantity, 0)}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Products purchased</h3>
              <button type="button" className="text-sm text-gray-500" onClick={() => setOpen(false)}>Close</button>
            </div>
            <ul className="space-y-2 text-sm text-gray-800">
              {lines.map((line, index) => (
                <li key={`${line.name}-${index}`} className="flex justify-between gap-3">
                  <span>{line.name}</span>
                  <span>× {line.quantity}</span>
                </li>
              ))}
              {lines.length === 0 && <li>No product lines were stored for this selling.</li>}
            </ul>
          </div>
        </div>
      )}
    </>
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
  const columns: Column[] = [
    { key: 'category', header: 'No.' },
    { key: 'insertDate', header: 'Date' },
    { key: 'description', header: 'Performed by' },
    { key: 'casual', header: 'Sector' },
    { key: 'name', header: 'Member' },
    {
      key: 'number',
      header: 'No. of products',
      render: (_value, row) => <ProductCount row={row} />,
    },
    { key: 'course', header: '1th product purchased' },
    { key: 'value', header: 'Total cost', render: (value) => money(value) },
    { key: 'paid', header: 'Paid', render: (value) => money(value) },
    { key: 'rest', header: 'Rest', render: (value) => money(value) },
    { key: 'operator', header: 'Operator' },
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
      <div className="flex justify-end">
        <Link
          href={def.routes.form}
          className="px-4 py-2 bg-teal-700 text-white rounded text-sm hover:bg-teal-800"
        >
          {def.archiveTitles.newRecordButton}
        </Link>
      </div>
      <ClubArchivePage
        title={productId ? `${def.archiveTitles.records} · ${productName}` : def.archiveTitles.records}
        archiveType="product-sales-unified"
        columns={columns}
        refreshKey={refreshKey}
        footerHint={
          productId
            ? `Only sellings that include ${productName}.`
            : 'Sellings performed by the operator or by the member online.'
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
