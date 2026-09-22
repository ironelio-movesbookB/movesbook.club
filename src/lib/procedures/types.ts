import type { Decimal } from '@prisma/client/runtime/library';

export const PROCEDURE_TYPE_CODES = {
  SERVICE_SALE: 'service_sale',
  EXPENSE: 'expense',
  PRODUCT_SALE: 'product_sale',
  MEMBER_DEBT: 'member_debt',
  MEMBERSHIP: 'membership',
  COURSE_SUBSCRIPTION: 'course_subscription',
  MEMBER_CREDIT: 'member_credit',
} as const;

export type ProcedureTypeCode =
  (typeof PROCEDURE_TYPE_CODES)[keyof typeof PROCEDURE_TYPE_CODES];

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type ClubAuthContext = {
  userId: string;
  club: { id: string; name: string };
  /**
   * Archive of Users is shared by Club and Team.
   * When `team`, `club.id` is the selected team id (same shape for list helpers).
   */
  workspaceKind?: 'club' | 'team';
};

export type ProcedureRecordDto = {
  id: string;
  procedureTypeCode: string;
  clubId: string;
  memberId: string;
  memberName: string;
  /** Profile image path from users_new.image (may be relative). */
  memberImage: string | null;
  operatorId: string | null;
  operatorName: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  /** Creation/business date of the record. This stays editable only where PHP allowed it. */
  recordDate: string;
  /** Expiration date of the deadline. */
  dueDate: string | null;
  /** ISO timestamp — used to order same-day deadlines (oldest first). */
  createdAt: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  lastPaymentDate: string | null;
};

export type ProcedurePaymentDto = {
  id: string;
  procedureRecordId: string;
  memberId: string;
  memberName: string;
  amount: number;
  paymentDate: string;
  operatorId: string | null;
  operatorName: string;
  payMode: string | null;
  notes: string | null;
  serviceName: string | null;
  typology: string;
  balanceAfter: number | null;
  originalDebt: number;
  residualDebt: number;
};

export type ProcedureReceiptDto = {
  id: string;
  procedureRecordId: string;
  procedurePaymentId: string | null;
  memberId: string;
  memberName: string;
  documentType: string | null;
  documentNumber: string | null;
  amount: number;
  paymentAmount: number;
  /** Remaining balance on the parent purchase after this receipt's payment. */
  residualDebt?: number;
  serviceName: string | null;
  receiptDate: string;
  annotations: string | null;
  typology: string;
  operatorName: string;
  /** True when another receipt in the club shares the same document type + number. */
  isDuplicate?: boolean;
};

export type TaxDocumentInput = {
  documentType?: string | null;
  heading?: string | null;
  documentDate?: string | null;
  documentNumber?: string | null;
  causal?: string | null;
  total?: number | null;
  residualTotal?: number | null;
  methodPayment?: string | null;
  vatPercentage?: number | null;
  vatAmount?: number | null;
  net?: number | null;
  memberDisplayName?: string | null;
  originalMemberName?: string | null;
  memberAlias?: string | null;
  memberNameEditable?: boolean | null;
  formCausal?: string | null;
  counterKey?: string | null;
};

export type CreateProcedureRecordInput = {
  memberId: string;
  totalAmount: number;
  initialPayment?: number;
  recordDate: string;
  dueDate?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  operatorId?: string | null;
  operatorPassword?: string | null;
  payMode?: string | null;
  paymentType?: string | null;
  taxDoc?: boolean;
  discount?: number | null;
  discountApplied?: boolean;
  movementTime?: string | null;
  paymentDate?: string | null;
  createReceipt?: boolean;
  receiptDocumentType?: string | null;
  receiptNumber?: string | null;
  receiptAnnotations?: string | null;
  serviceName?: string | null;
  taxDocument?: TaxDocumentInput | null;
};

export type AddProcedurePaymentInput = {
  amount: number;
  paymentDate: string;
  notes?: string | null;
  operatorId?: string | null;
  operatorPassword?: string | null;
  payMode?: string | null;
  paymentType?: string | null;
  taxDoc?: boolean;
  debtTotal?: number | null;
  debtExpire?: string | null;
  payWith?: number | null;
  createReceipt?: boolean;
  receiptDocumentType?: string | null;
  receiptNumber?: string | null;
  receiptAnnotations?: string | null;
  serviceName?: string | null;
  taxDocument?: TaxDocumentInput | null;
};

export type ListQuery = {
  page?: number;
  pageSize?: number;
  memberId?: string;
  recordId?: string;
  /** Filter to these procedure record ids (payment-form scoped archives). */
  recordIds?: string[];
  search?: string;
  fromDate?: string;
  toDate?: string;
  orderBy?: 'recent' | 'old';
};

export function decimalToNumber(value: Decimal | number | string): number {
  return Number(value);
}
