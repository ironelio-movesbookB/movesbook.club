import React from 'react';
import type { Member, Column } from '@/types/clubTable';

export type { Member, Column };

export type ProcedureTab = {
  id: string;
  label: string;
  href?: string;
  /** When set, renders as a button (e.g. Pay deadlines selected). */
  onClick?: () => void;
  disabled?: boolean;
};

export type ProcedureArchiveShellProps = {
  title: string;
  activeTab: string;
  tabs: ProcedureTab[];
  headerAction?: React.ReactNode;
  /** Extra content on the right of the tabs row (e.g. Display also paid). */
  tabsTrailing?: React.ReactNode;
  /** Renders instead of the `tabs` list when the tab row needs custom buttons/handlers. */
  tabActions?: React.ReactNode;
  error?: string;
  footerHint?: string;
  children: React.ReactNode;
  pagination?: React.ReactNode;
  /** Optional member info to display in the header. */
  member?: {
    name: string;
    image?: string | null;
  };
};

export type PaymentFormValues = {
  amountPaid: number;
  paymentDate: string;
  notes: string;
  createReceipt: boolean;
  receiptNumber: string;
};

export type PaymentFormProps = {
  maxAmount: number;
  disabled?: boolean;
  saving?: boolean;
  error?: string;
  success?: string;
  onSubmit: (values: PaymentFormValues) => Promise<void>;
  onCancel?: () => void;
  cancelLabel?: string;
};
