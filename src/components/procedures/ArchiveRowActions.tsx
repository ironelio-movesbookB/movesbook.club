'use client';

import { useCallback, useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import AdminPasswordConfirmModal from '@/components/club/AdminPasswordConfirmModal';

/**
 * Every archive row edit/delete must be re-authenticated with the operator's own
 * password, so the gate holds the pending action until the modal verifies.
 */
export function usePasswordGate() {
  const [isOpen, setIsOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const request = useCallback((action: () => void) => {
    pending.current = action;
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    pending.current = null;
    setIsOpen(false);
  }, []);

  const confirm = useCallback(() => {
    const action = pending.current;
    pending.current = null;
    setIsOpen(false);
    action?.();
  }, []);

  const modal = (
    <AdminPasswordConfirmModal isOpen={isOpen} onClose={close} onVerified={confirm} />
  );

  return { request, modal };
}

export function EditRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="text-blue-600 hover:text-blue-800"
      title="Edit"
      aria-label="Edit"
    >
      <Pencil className="w-4 h-4" />
    </button>
  );
}

export function DeleteRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="text-red-500 hover:text-red-700"
      title="Delete"
      aria-label="Delete"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
