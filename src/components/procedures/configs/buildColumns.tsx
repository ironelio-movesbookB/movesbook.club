import React from 'react';
import type { Column } from '@/types/clubTable';
import { formatDate, formatEuro } from '@/lib/club/servicePurchasesClient';
import type { ProcedureDefinition } from '@/lib/procedures/registry';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';

function MemberImageCell({ src, name }: { src?: string; name?: string }) {
  const url = resolvePublicImageUrl(src);
  if (!url) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center border border-gray-300 bg-gray-100 text-[8px] font-bold leading-tight text-gray-500">
        NO
        <br />
        IMG
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name || 'Member'}
      className="h-8 w-8 rounded-full border border-gray-300 object-cover"
    />
  );
}

/** Build archive table columns from a procedure registry entry. */
export function buildProcedureColumns(def: ProcedureDefinition) {
  const primaryKey = 'service' as const;
  const secondaryKey = 'course' as const;

  const primaryCol: Column = {
    key: primaryKey,
    header: def.columnHeaders.primary,
  };
  const secondaryCol: Column | null = def.columnHeaders.secondary
    ? { key: secondaryKey, header: def.columnHeaders.secondary }
    : null;

  const recordColumns: Column[] = [
    { key: 'number', header: 'N' },
    { key: 'name', header: 'Full Name' },
    { key: 'typology', header: 'Typology' },
    primaryCol,
    ...(secondaryCol ? [secondaryCol] : []),
    { key: 'insertDate', header: 'Date', render: (v) => formatDate(v) },
    { key: 'expirationDate', header: 'Expiration Date', render: (v) => formatDate(v) },
    { key: 'value', header: 'Cost', render: (v) => formatEuro(v) },
    { key: 'paid', header: 'Paid', render: (v) => formatEuro(v) },
    { key: 'rest', header: 'Rest', render: (v) => formatEuro(v) },
    { key: 'dateEnd', header: 'Last payment', render: (v) => formatDate(v) },
    { key: 'casual', header: 'Notes' },
    { key: 'operator', header: 'Operator' },
    { key: 'edit', header: 'Edit', sortable: false },
    { key: 'delete', header: 'Delete', sortable: false },
  ];

  const deadlineColumns: Column[] = [
    {
      key: 'image',
      header: 'Image',
      sortable: false,
      render: (_v, row) => <MemberImageCell src={row.image} name={row.name} />,
    },
    { key: 'name', header: 'Full Name' },
    { key: 'typology', header: 'Typology' },
    primaryCol,
    ...(secondaryCol ? [secondaryCol] : []),
    { key: 'insertDate', header: 'Date', render: (v) => formatDate(v) },
    { key: 'expirationDate', header: 'Expiration Date', render: (v) => formatDate(v) },
    { key: 'value', header: 'Debt', render: (v) => formatEuro(v) },
    { key: 'paid', header: 'Paid', render: (v) => formatEuro(v) },
    { key: 'rest', header: 'Rest', render: (v) => formatEuro(v) },
    { key: 'dateEnd', header: 'Last payment', render: (v) => formatDate(v) },
    { key: 'casual', header: 'Description' },
    { key: 'operator', header: 'Operator' },
    { key: 'edit', header: 'Edit', sortable: false },
    { key: 'delete', header: 'Delete', sortable: false },
  ];

  const paymentColumns: Column[] = [
    { key: 'name', header: 'Full Name' },
    { key: 'typology', header: 'Typology' },
    primaryCol,
    { key: 'insertDate', header: 'Date', render: (v) => formatDate(v) },
    {
      key: 'paid',
      header: def.metadataKeys.direction === 'OUT' ? 'Value OUT' : 'Payment IN',
      render: (v) => formatEuro(v),
    },
    {
      key: 'originalDebt',
      header: 'OF..',
      render: (_, row) =>
        `${Number(row.residualDebt ?? 0).toFixed(2)} / ${Number(row.originalDebt ?? 0).toFixed(2)}`,
    },
    { key: 'rest', header: 'Rest', render: (v) => formatEuro(v) },
    { key: 'casual', header: 'Notes' },
    { key: 'operator', header: 'Operator' },
    { key: 'edit', header: 'Edit', sortable: false },
    { key: 'delete', header: 'Delete', sortable: false },
  ];

  const receiptColumns: Column[] = [
    { key: 'name', header: 'Full Name' },
    { key: 'typology', header: 'Typology' },
    primaryCol,
    { key: 'insertDate', header: 'Date', render: (v) => formatDate(v) },
    { key: 'category', header: 'Document' },
    { key: 'contract', header: 'No. of document' },
    { key: 'value', header: 'Cost', render: (v) => formatEuro(v) },
    {
      key: 'paid',
      header: def.metadataKeys.direction === 'OUT' ? 'Value OUT' : 'Payment IN',
      render: (v) => formatEuro(v),
    },
    { key: 'casual', header: 'Annotations' },
    { key: 'operator', header: 'Operator' },
    { key: 'edit', header: 'Edit', sortable: false },
    { key: 'delete', header: 'Delete', sortable: false },
  ];

  return { recordColumns, deadlineColumns, paymentColumns, receiptColumns, primaryKey, secondaryKey };
}
