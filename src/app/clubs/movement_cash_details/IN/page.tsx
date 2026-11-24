'use client';

import { useState } from 'react';
import CashMovementsArchive from '@/components/club/archives/CashMovementsArchive';
import EditCashMovementModal from '@/components/club/archives/EditCashMovementModal';
import { deleteCashMovement } from '@/lib/club/cashMovementClient';
import type { Column, Member } from '@/types/clubTable';

const columns: Column[] = [
  { key: 'name', header: 'Full Name' },
  { key: 'typology', header: 'Typology' },
  { key: 'service', header: 'Service / Product' },
  { key: 'insertDate', header: 'Date' },
  { key: 'paid', header: 'Amount IN' },
  { key: 'payMod', header: 'Pay mode' },
  { key: 'operator', header: 'Operator' },
  { key: 'casual', header: 'Notes' },
  { key: 'edit', header: 'Edit' },
  { key: 'delete', header: 'Delete' },
];

export default function MovementCashInPage() {
  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function reload() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="p-4" key={refreshKey}>
      <CashMovementsArchive
        title="Cash In"
        direction="IN"
        columns={columns}
        footerHint="Check a payment row, then use Details deadline or Payments record selected. Edit and Delete ask for your password."
        onEditItem={setEditTarget}
        onDeleteItem={async (item) => {
          if (!item.id) return;
          await deleteCashMovement(item.id);
          reload();
        }}
      />

      <EditCashMovementModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={reload}
        item={{
          id: editTarget?.id ?? '',
          insertDate: editTarget?.insertDate ? String(editTarget.insertDate) : null,
          casual: editTarget?.casual ?? '',
          operator: editTarget?.operator ?? '',
        }}
      />
    </div>
  );
}
