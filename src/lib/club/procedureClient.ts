'use client';

import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import {
  getProcedureDefinition,
  getProcedureTypology,
  type ProcedureDefinition,
} from '@/lib/procedures/registry';
import type {
  ProcedurePaymentDto,
  ProcedureReceiptDto,
  ProcedureRecordDto,
  ProcedureTypeCode,
} from '@/lib/procedures/types';

export type ProcedureRecordView = {
  id: string;
  userId: string;
  memberName: string;
  memberImage: string | null;
  typology: string;
  procedureType: string;
  primaryLabel: string;
  secondaryLabel: string;
  recordDate: string;
  paydate: string | null;
  expireDate: string | null;
  createdAt: string;
  value: number;
  pay: number;
  rest: number;
  notes: string;
  operatorId: string | null;
  operatorName: string;
  lastPaymentDate: string | null;
};

export type ProcedurePaymentView = {
  id: string;
  recordId: string;
  memberName: string;
  typology: string;
  primaryLabel: string;
  paymentDate: string | null;
  paid: number;
  balance: number;
  originalDebt: number;
  residualDebt: number;
  description: string;
  operatorId: string | null;
  operatorName: string;
  payMode: string | null;
};

export type ProcedureReceiptView = {
  id: string;
  recordId: string;
  memberName: string;
  typology: string;
  primaryLabel: string;
  receiptDate: string | null;
  documentType: string;
  documentNumber: string;
  cost: number;
  paymentIn: number;
  annotations: string;
  operatorName: string;
};

export type ListParams = {
  page?: number;
  pageSize?: number;
  recordId?: string;
  memberId?: string;
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

function metaString(metadata: Record<string, unknown> | null | undefined, key: string): string {
  const value = metadata?.[key];
  return value != null ? String(value).trim() : '';
}

function apiBase(code: ProcedureTypeCode): string {
  return `/api/club/procedures/${code}`;
}

function mapRecord(def: ProcedureDefinition, record: ProcedureRecordDto): ProcedureRecordView {
  const metadata = record.metadata;
  return {
    id: record.id,
    userId: record.memberId,
    memberName: record.memberName,
    memberImage: record.memberImage ?? null,
    typology: getProcedureTypology(def.code),
    procedureType: record.procedureTypeCode,
    primaryLabel: metaString(metadata, def.metadataKeys.primary) || '-',
    secondaryLabel: def.metadataKeys.secondary
      ? metaString(metadata, def.metadataKeys.secondary) || '-'
      : '',
    recordDate: record.recordDate,
    // Keep legacy `paydate` field aligned with deadline expiry for existing code paths.
    paydate: record.dueDate ?? record.recordDate,
    // Never fall back to the record date: an absent expiration must stay visibly absent.
    expireDate: record.dueDate,
    createdAt: record.createdAt,
    value: record.totalAmount,
    pay: record.paidAmount,
    rest: record.balanceAmount,
    notes: record.notes ?? '',
    operatorId: record.operatorId,
    operatorName: record.operatorName,
    lastPaymentDate: record.lastPaymentDate,
  };
}

function mapPayment(def: ProcedureDefinition, payment: ProcedurePaymentDto): ProcedurePaymentView {
  return {
    id: payment.id,
    recordId: payment.procedureRecordId,
    memberName: payment.memberName,
    typology: payment.typology,
    primaryLabel: payment.serviceName ?? '-',
    paymentDate: payment.paymentDate,
    paid: payment.amount,
    balance: payment.balanceAfter ?? 0,
    description: payment.notes ?? '',
    operatorId: payment.operatorId,
    operatorName: payment.operatorName,
    originalDebt: payment.originalDebt,
    residualDebt: payment.residualDebt,
    payMode: payment.payMode,
  };
}

function mapReceipt(def: ProcedureDefinition, receipt: ProcedureReceiptDto): ProcedureReceiptView {
  return {
    id: receipt.id,
    recordId: receipt.procedureRecordId,
    memberName: receipt.memberName,
    typology: receipt.typology,
    primaryLabel: receipt.serviceName ?? '-',
    receiptDate: receipt.receiptDate,
    documentType: receipt.documentType ?? 'Invoice',
    documentNumber: receipt.documentNumber ?? '',
    cost: receipt.amount,
    paymentIn: receipt.paymentAmount,
    annotations: receipt.annotations ?? '',
    operatorName: receipt.operatorName,
  };
}

function buildQuery(params?: ListParams & { view?: string }): string {
  const def = params?.pageSize;
  const page = params?.page ?? 1;
  const pageSize = def ?? 25;
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (params?.view) qs.set('view', params.view);
  if (params?.recordId) qs.set('recordId', params.recordId);
  if (params?.memberId) qs.set('memberId', params.memberId);
  if (params?.includePaid) qs.set('includePaid', 'true');
  if (params?.search) qs.set('search', params.search);
  if (params?.fromDate) qs.set('fromDate', params.fromDate);
  if (params?.toDate) qs.set('toDate', params.toDate);
  if (params?.orderBy) qs.set('orderBy', params.orderBy);
  return qs.toString();
}

export function createProcedureClient(code: ProcedureTypeCode) {
  const def = getProcedureDefinition(code);
  if (!def) throw new Error(`Unknown procedure type: ${code}`);

  const base = apiBase(code);
  const pageSize = def.pageSize;

  return {
    code,
    definition: def,
    pageSize,

    async fetchFormOptions<T>(): Promise<T> {
      return clubApiFetch<T>(`${base}/form-options`);
    },

    async fetchRecords(params?: ListParams): Promise<PaginatedResult<ProcedureRecordView>> {
      const res = await clubApiFetch<PaginatedResult<ProcedureRecordDto>>(
        `${base}/records?${buildQuery({ ...params, pageSize: params?.pageSize ?? pageSize })}`
      );
      return {
        items: res.items.map((r) => mapRecord(def, r)),
        total: res.total,
        page: res.page,
        pageSize: res.pageSize,
        clubId: res.clubId,
      };
    },
    //------------------------------------------------------------------------------------------------

    async fetchDeadlines(params?: ListParams): Promise<PaginatedResult<ProcedureRecordView>> {
      const res = await clubApiFetch<PaginatedResult<ProcedureRecordDto>>(
        `${base}/records?${buildQuery({ ...params, pageSize: params?.pageSize ?? pageSize, view: 'deadlines' })}`
      );
      return {
        items: res.items.map((r) => mapRecord(def, r)),
        total: res.total,
        page: res.page,
        pageSize: res.pageSize,
      };
    },

    async fetchRecord(id: string): Promise<{ record: ProcedureRecordView }> {
      const res = await clubApiFetch<{ record: ProcedureRecordDto }>(`${base}/records/${id}`);
      return { record: mapRecord(def, res.record) };
    },

    async updateRecord(
      id: string,
      input: {
        recordDate?: string;
        dueDate?: string | null;
        notes?: string;
        operatorId?: string;
        totalAmount?: number;
      }
    ): Promise<void> {
      await clubApiFetch(`${base}/records/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },

    async createRecord(body: Record<string, unknown>): Promise<{ recordId: string }> {
      const result = await clubApiFetch<{ recordId: string }>(`${base}/records`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return { recordId: result.recordId };
    },

    async deleteRecord(id: string): Promise<void> {
      await clubApiFetch(`${base}/records?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async addPayment(
      recordId: string,
      input: {
        amountPaid: number;
        paymentDate: string;
        notes?: string;
        description?: string;
        payMode?: string;
        paymentType?: string;
        taxDoc?: boolean;
        operatorId?: string;
        operatorPassword?: string;
        debtTotal?: number;
        debtExpire?: string;
        payWith?: number;
        createReceipt?: boolean;
        receiptDocumentType?: string;
        receiptNumber?: string;
        receiptAnnotations?: string;
        serviceName?: string;
        taxDocument?: Record<string, unknown>;
      }
    ): Promise<void> {
      await clubApiFetch(`${base}/records/${recordId}`, {
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
          serviceName: input.serviceName,
        }),
      });
    },

    async fetchPayments(params?: ListParams): Promise<PaginatedResult<ProcedurePaymentView>> {
      const res = await clubApiFetch<PaginatedResult<ProcedurePaymentDto>>(
        `${base}/payments?${buildQuery({ ...params, pageSize: params?.pageSize ?? pageSize })}`
      );
      return {
        items: res.items.map((p) => mapPayment(def, p)),
        total: res.total,
        page: res.page,
        pageSize: res.pageSize,
      };
    },

    async updatePayment(
      id: string,
      input: { paymentDate?: string; notes?: string; operatorId?: string }
    ): Promise<void> {
      await clubApiFetch(`${base}/payments/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },

    async deletePayment(id: string): Promise<void> {
      await clubApiFetch(`${base}/payments/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async fetchReceipts(params?: ListParams): Promise<PaginatedResult<ProcedureReceiptView>> {
      const res = await clubApiFetch<PaginatedResult<ProcedureReceiptDto>>(
        `${base}/receipts?${buildQuery({ ...params, pageSize: params?.pageSize ?? pageSize })}`
      );
      return {
        items: res.items.map((r) => mapReceipt(def, r)),
        total: res.total,
        page: res.page,
        pageSize: res.pageSize,
      };
    },

    async updateReceipt(
      id: string,
      input: {
        documentType?: string;
        documentNumber?: string;
        annotations?: string;
        /** Re-send with `true` after the API rejects a duplicate document type + number. */
        confirmDuplicate?: boolean;
      }
    ): Promise<void> {
      await clubApiFetch(`${base}/receipts/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },

    async deleteReceipt(id: string): Promise<void> {
      await clubApiFetch(`${base}/receipts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  };
}
