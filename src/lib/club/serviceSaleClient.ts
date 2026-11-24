'use client';

import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import type {
  ProcedurePaymentDto,
  ProcedureReceiptDto,
  ProcedureRecordDto,
} from '@/lib/procedures/types';

export const SERVICE_SALE_TYPE = 'service_sale';
/** Typology label shown in Archive of Services tabs (Historical / Deadlines / Payments / Receipts). */
export const SERVICES_TYPOLOGY = 'SERVICES';
export const BASE = `/api/club/procedures/${SERVICE_SALE_TYPE}`;

export type ServiceSalePurchase = {
  id: string;
  userId: string;
  memberName: string;
  memberImage: string | null;
  typology: string;
  sectorName: string;
  serviceName: string;
  recordDate: string | null;
  paydate: string | null;
  expireDate: string | null;
  /** ISO timestamp for same-day chronological ordering (oldest first). */
  createdAt: string | null;
  value: number;
  pay: number;
  rest: number;
  notes: string;
  operatorId: string | null;
  operatorName: string;
  lastPaymentDate: string | null;
  /** Tax doc label from metadata when present (Simple Receipt / Tax Receipt / Invoice). */
  docType?: string;
};

export type ServiceSalePayment = {
  id: string;
  spId: string;
  memberName: string;
  typology: string;
  serviceName: string;
  paymentDate: string | null;
  paid: number;
  balance: number;
  originalDebt: number;
  residualDebt: number;
  description: string;
  operatorId: string | null;
  operatorName: string;
};

export type ServiceSaleReceipt = {
  id: string;
  spId: string;
  memberName: string;
  typology: string;
  serviceName: string;
  receiptDate: string | null;
  documentType: string;
  documentNumber: string;
  cost: number;
  paymentIn: number;
  residualDebt: number;
  annotations: string;
  operatorName: string;
  isDuplicate?: boolean;
};

export type ServiceSaleFormOptions = {
  sectors: { id: string; name: string }[];
  services: { id: string; name: string; sectorId: string; cost: number; imageUrl: string | null }[];
  members: { id: string; name: string }[];
  operators: { id: string; name: string }[];
  currentOperatorId: string | null;
};

function metaString(metadata: Record<string, unknown> | null | undefined, key: string): string {
  const value = metadata?.[key];
  return value != null ? String(value).trim() : '';
}

export function mapRecord(record: ProcedureRecordDto): ServiceSalePurchase {
  const meta = record.metadata;
  const taxDocRaw = meta?.taxDoc ?? meta?.tax_doc;
  const taxDocument =
    meta?.taxDocument && typeof meta.taxDocument === 'object'
      ? (meta.taxDocument as Record<string, unknown>)
      : null;
  const docFromTaxDocument = taxDocument ? metaString(taxDocument, 'documentType') : '';
  const docTypeMap: Record<string, string> = {
    '1': 'Simple Receipt',
    '2': 'Tax Receipt',
    '3': 'Invoice',
  };
  const docType =
    docFromTaxDocument ||
    (taxDocRaw != null && taxDocRaw !== false
      ? docTypeMap[String(taxDocRaw)] || (taxDocRaw === true ? 'Invoice' : String(taxDocRaw))
      : '');

  const notes =
    (record.notes && record.notes.trim()) ||
    metaString(meta, 'causal') ||
    metaString(meta, 'annotation') ||
    '';

  return {
    id: record.id,
    userId: record.memberId,
    memberName: record.memberName,
    memberImage: record.memberImage ?? null,
    typology: SERVICES_TYPOLOGY,
    sectorName: metaString(meta, 'sectorName') || '-',
    serviceName: metaString(meta, 'serviceName') || '-',
    recordDate: record.recordDate,
    // Legacy `paydate` doubles as a generic movement date for callers that predate `expireDate`.
    paydate: record.dueDate ?? record.recordDate,
    // Never fall back to the record date: an absent expiration must stay visibly absent.
    expireDate: record.dueDate,
    createdAt: record.createdAt ?? null,
    value: record.totalAmount,
    pay: record.paidAmount,
    rest: record.balanceAmount,
    notes,
    operatorId: record.operatorId,
    operatorName: record.operatorName,
    lastPaymentDate: record.lastPaymentDate,
    docType: docType || undefined,
  };
}

export function mapPayment(payment: ProcedurePaymentDto): ServiceSalePayment {
  return {
    id: payment.id,
    spId: payment.procedureRecordId,
    memberName: payment.memberName,
    // Archive of Services → Payments must never surface other procedure typologies.
    typology: SERVICES_TYPOLOGY,
    serviceName: payment.serviceName ?? '-',
    paymentDate: payment.paymentDate,
    paid: payment.amount,
    balance: payment.balanceAfter ?? 0,
    originalDebt: payment.originalDebt,
    residualDebt: payment.residualDebt,
    description: payment.notes ?? '',
    operatorId: payment.operatorId,
    operatorName: payment.operatorName,
  };
}

export function mapReceipt(receipt: ProcedureReceiptDto): ServiceSaleReceipt {
  return {
    id: receipt.id,
    spId: receipt.procedureRecordId,
    memberName: receipt.memberName,
    // Archive of Services → Receipts must never surface other procedure typologies.
    typology: SERVICES_TYPOLOGY,
    serviceName: receipt.serviceName ?? '-',
    receiptDate: receipt.receiptDate,
    documentType: receipt.documentType ?? 'Invoice',
    documentNumber: receipt.documentNumber ?? '',
    cost: receipt.amount,
    paymentIn: receipt.paymentAmount,
    residualDebt: receipt.residualDebt ?? Math.max(0, receipt.amount - receipt.paymentAmount),
    annotations: receipt.annotations ?? '',
    operatorName: receipt.operatorName,
    isDuplicate: receipt.isDuplicate,
  };
}

/** Drop anything that is not explicitly SERVICES (defense in depth). */
function onlyServicesTypology<T extends { typology: string }>(items: T[]): T[] {
  return items.filter((item) => item.typology === SERVICES_TYPOLOGY);
}

export type ListParams = {
  page?: number;
  pageSize?: number;
  recordId?: string;
  /** Scope list to these procedure record ids (from payment form selection). */
  recordIds?: string[];
  /** Scope list to a single member (e.g. "all deadlines of this member" toggle). */
  memberId?: string;
  /** When fetching deadlines, also include Rest = 0 rows. */
  includePaid?: boolean;
  search?: string;
  fromDate?: string;
  toDate?: string;
  orderBy?: 'recent' | 'old';
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  clubId?: string;
};

type Paginated<T> = PaginatedResult<T>;

export const DEFAULT_LIST_PAGE_SIZE = 25;

function buildQuery(params?: ListParams & { view?: string }): string {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? DEFAULT_LIST_PAGE_SIZE;
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (params?.view) qs.set('view', params.view);
  if (params?.recordId) qs.set('recordId', params.recordId);
  if (params?.recordIds && params.recordIds.length > 0) {
    qs.set('ids', params.recordIds.join(','));
  }
  if (params?.memberId) qs.set('memberId', params.memberId);
  if (params?.includePaid) qs.set('includePaid', '1');
  if (params?.search) qs.set('search', params.search);
  if (params?.fromDate) qs.set('fromDate', params.fromDate);
  if (params?.toDate) qs.set('toDate', params.toDate);
  if (params?.orderBy) qs.set('orderBy', params.orderBy);
  return qs.toString();
}

export async function fetchFormOptions(): Promise<ServiceSaleFormOptions> {
  return clubApiFetch<ServiceSaleFormOptions>(`${BASE}/form-options`);
}

export async function fetchServiceCost(serviceId: string): Promise<number | null> {
  const options = await fetchFormOptions();
  const service = options.services.find((s) => s.id === serviceId);
  return service?.cost ?? null;
}

export async function fetchPurchases(
  params?: ListParams
): Promise<PaginatedResult<ServiceSalePurchase>> {
  const res = await clubApiFetch<Paginated<ProcedureRecordDto>>(
    `${BASE}/records?${buildQuery(params)}`
  );
  const items = onlyServicesTypology(res.items.map(mapRecord));
  return {
    items,
    total: res.total,
    page: res.page,
    pageSize: res.pageSize,
    clubId: res.clubId,
  };
}

export async function fetchDeadlines(
  params?: ListParams
): Promise<PaginatedResult<ServiceSalePurchase>> {
  const res = await clubApiFetch<Paginated<ProcedureRecordDto>>(
    `${BASE}/records?${buildQuery({ ...params, view: 'deadlines' })}`
  );
  const items = onlyServicesTypology(res.items.map(mapRecord));
  return {
    items,
    total: res.total,
    page: res.page,
    pageSize: res.pageSize,
  };
}

export async function fetchPurchase(id: string): Promise<{ purchase: ServiceSalePurchase }> {
  const res = await clubApiFetch<{ record: ProcedureRecordDto }>(`${BASE}/records/${id}`);
  return { purchase: mapRecord(res.record) };
}

export async function fetchMemberDiscount(memberId: string): Promise<number> {
  const data = await clubApiFetch<{ discount: number }>(
    `${BASE}/member-discount?memberId=${encodeURIComponent(memberId)}`
  );
  return data.discount ?? 0;
}

export type CreatePurchaseInput = {
  userId: string;
  sectorId: string;
  serviceId: string;
  sectorName?: string;
  serviceName?: string;
  value: number;
  pay?: number;
  recordDate: string;
  movementTime?: string;
  /** When the service stops being valid. Independent from the payment date. */
  expireDate: string;
  /** Defaults to `recordDate`: the initial payment happens at the movement, not at the expiration. */
  paymentDate?: string;
  causal?: string;
  notes?: string;
  payMode?: string;
  operatorId?: string;
  operatorPassword?: string;
  discount?: number;
  discountApplied?: boolean;
  taxDoc?: boolean;
  taxDocument?: Record<string, unknown>;
  companyId?: string;
  companyName?: string;
  createReceipt?: boolean;
  receiptDocumentType?: string;
  receiptNumber?: string;
  receiptAnnotations?: string;
};

export async function createPurchase(input: CreatePurchaseInput): Promise<{ purchaseId: string }> {
  const pay = input.pay ?? 0;
  const result = await clubApiFetch<{ recordId: string }>(`${BASE}/records`, {
    method: 'POST',
    body: JSON.stringify({
      memberId: input.userId,
      totalAmount: input.value,
      initialPayment: pay,
      recordDate: input.recordDate,
      paymentDate: input.paymentDate ?? input.recordDate,
      dueDate: input.expireDate,
      causal: input.causal ?? input.notes ?? null,
      notes: input.causal ?? input.notes ?? null,
      sectorId: input.sectorId || null,
      serviceId: input.serviceId || null,
      sectorName: input.sectorName ?? null,
      serviceName: input.serviceName ?? null,
      payMode: input.payMode ?? null,
      operatorId: input.operatorId ?? null,
      operatorPassword: input.operatorPassword ?? null,
      discount: input.discount ?? 0,
      discountApplied: input.discountApplied ?? false,
      movementTime: input.movementTime ?? null,
      taxDoc: input.taxDoc ?? false,
      taxDocument: input.taxDocument ?? null,
      companyId: input.companyId ?? null,
      companyName: input.companyName ?? null,
      createReceipt: input.createReceipt && pay > 0,
      receiptDocumentType: input.receiptDocumentType ?? 'Invoice',
      receiptNumber: input.receiptNumber,
      receiptAnnotations: input.receiptAnnotations ?? input.causal ?? input.notes,
    }),
  });
  return { purchaseId: result.recordId };
}


export async function deletePurchase(id: string): Promise<void> {
  await clubApiFetch(`${BASE}/records?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function deleteDeadline(id: string): Promise<void> {
  await deletePurchase(id);
}

export async function updatePurchase(
  id: string,
  input: {
    recordDate?: string;
    dueDate?: string | null;
    notes?: string;
    operatorId?: string;
    totalAmount?: number;
  }
): Promise<void> {
  await clubApiFetch(`${BASE}/records/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export type AddPaymentInput = {
  amountPaid: number;
  paymentDate: string;
  description?: string;
  notes?: string;
  payMode?: string;
  paymentType?: 'D' | 'B';
  taxDoc?: boolean;
  operatorId?: string;
  operatorPassword?: string;
  debtTotal?: number;
  debtExpire?: string;
  payWith?: number;
  taxDocument?: Record<string, unknown>;
  createReceipt?: boolean;
  receiptDocumentType?: string;
  receiptNumber?: string;
  receiptAnnotations?: string;
};

export async function addPayment(recordId: string, input: AddPaymentInput): Promise<void> {
  await clubApiFetch(`${BASE}/records/${recordId}`, {
    method: 'POST',
    body: JSON.stringify({
      amount: input.amountPaid,
      paymentDate: input.paymentDate,
      description: input.description ?? input.notes ?? null,
      notes: input.description ?? input.notes ?? null,
      payMode: input.payMode ?? null,
      paymentType: input.paymentType ?? null,
      taxDoc: input.taxDoc ?? false,
      operatorId: input.operatorId ?? null,
      operatorPassword: input.operatorPassword ?? null,
      debtTotal: input.debtTotal ?? null,
      debtExpire: input.debtExpire ?? null,
      payWith: input.payWith ?? null,
      taxDocument: input.taxDocument ?? null,
      createReceipt: input.createReceipt ?? input.taxDoc ?? false,
      receiptDocumentType: input.receiptDocumentType ?? 'Invoice',
      receiptNumber: input.receiptNumber,
      receiptAnnotations: input.receiptAnnotations ?? input.description ?? input.notes,
    }),
  });
}

export async function fetchPayments(
  params?: ListParams
): Promise<PaginatedResult<ServiceSalePayment>> {
  const res = await clubApiFetch<Paginated<ProcedurePaymentDto>>(
    `${BASE}/payments?${buildQuery(params)}`
  );
  const items = onlyServicesTypology(res.items.map(mapPayment));
  return {
    items,
    total: res.total,
    page: res.page,
    pageSize: res.pageSize,
  };
}

export async function fetchPaymentsForRecord(
  recordId: string,
  params?: ListParams
): Promise<PaginatedResult<ServiceSalePayment>> {
  return fetchPayments({ ...params, recordId });
}

export async function updatePayment(
  id: string,
  input: { paymentDate?: string; notes?: string; operatorId?: string }
): Promise<void> {
  await clubApiFetch(`${BASE}/payments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deletePayment(id: string): Promise<void> {
  await clubApiFetch(`${BASE}/payments/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function fetchReceipts(
  params?: ListParams
): Promise<PaginatedResult<ServiceSaleReceipt>> {
  const res = await clubApiFetch<Paginated<ProcedureReceiptDto>>(
    `${BASE}/receipts?${buildQuery(params)}`
  );
  const items = onlyServicesTypology(res.items.map(mapReceipt));
  return {
    items,
    total: res.total,
    page: res.page,
    pageSize: res.pageSize,
  };
}

export async function updateReceipt(
  id: string,
  input: { documentType?: string; documentNumber?: string; annotations?: string; confirmDuplicate?: boolean }
): Promise<void> {
  await clubApiFetch(`${BASE}/receipts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteReceipt(id: string): Promise<void> {
  await clubApiFetch(`${BASE}/receipts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
