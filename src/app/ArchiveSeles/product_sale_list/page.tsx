'use client';
import Image from 'next/image';
import { useState } from 'react';

import Link from 'next/link';
import ClubArchivePage from '@/components/club/archives/ClubArchivePage';
import type { Column, Member } from '@/types/clubTable';
import { getProcedureDefinition } from '@/lib/procedures/registry';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';

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

const columns: Column[] = [
  {
    key: 'image',
    header: 'Image',
    render: (value) =>
      value ? (
        <Image src={String(value)} alt="" width={40} height={40} className="w-10 h-10 rounded-full mx-auto object-cover" unoptimized />
      ) : (
        <span>-</span>
      ),
  },
  { key: 'name', header: 'Member' },
  { key: 'insertDate', header: 'Date purchase' },
  { key: 'typology', header: 'Typology' },
  { key: 'casual', header: 'Sector' },
  {
    key: 'number',
    header: 'N° of products',
    render: (_value, row) => <ProductCount row={row} />,
  },
  { key: 'value', header: 'Total cost', render: (value) => money(value) },
  { key: 'paid', header: 'Paid', render: (value) => money(value) },
  { key: 'rest', header: 'Rest', render: (value) => money(value) },
  { key: 'category', header: 'N° of selling' },
  { key: 'service', header: 'N° of invoice' },
  { key: 'operator', header: 'Operator' },
];

export default function ProductSaleListPage() {
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
        title={def.archiveTitles.records}
        archiveType="product-sales-unified"
        columns={columns}
        footerHint="Legacy archive_seles rows plus new product_sale procedure records."
      />
    </div>
  );
}
