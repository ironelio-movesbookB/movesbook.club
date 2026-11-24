'use client';
import Image from 'next/image';

import Link from 'next/link';
import ClubArchivePage from '@/components/club/archives/ClubArchivePage';
import type { Column } from '@/types/clubTable';
import { getProcedureDefinition } from '@/lib/procedures/registry';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';

const def = getProcedureDefinition(PROCEDURE_TYPE_CODES.PRODUCT_SALE)!;

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
  { key: 'insertDate', header: 'Date' },
  { key: 'name', header: 'Member' },
  { key: 'typology', header: 'Typology' },
  { key: 'casual', header: 'Sector / Order' },
  { key: 'value', header: 'Value' },
  { key: 'status', header: 'Status' },
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
