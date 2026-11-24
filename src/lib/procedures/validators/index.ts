import type { ZodError } from 'zod';
import { PROCEDURE_TYPE_CODES, type AddProcedurePaymentInput, type CreateProcedureRecordInput, type ProcedureTypeCode } from '../types';
import { addProcedurePaymentSchema } from './common';
import {
  createExpenseRecordSchema,
  mapExpenseCreateToInput,
} from './expense';
import {
  createMemberDebtRecordSchema,
  mapMemberDebtCreateToInput,
} from './memberDebt';
import {
  createProductSaleRecordSchema,
  mapProductSaleCreateToInput,
} from './productSale';
import {
  createServiceSaleRecordSchema,
  mapServiceSaleCreateToInput,
} from './serviceSale';
import {
  createMembershipRecordSchema,
  mapMembershipCreateToInput,
} from './membership';
import {
  createCourseSubscriptionRecordSchema,
  mapCourseSubscriptionCreateToInput,
} from './courseSubscription';

import {
  createMemberCreditRecordSchema,
  mapMemberCreditCreateToInput,
} from './memberCredit';

const KNOWN_PROCEDURE_TYPES = new Set<string>(Object.values(PROCEDURE_TYPE_CODES));

export function isKnownProcedureType(type: string): type is ProcedureTypeCode {
  return KNOWN_PROCEDURE_TYPES.has(type);
}

type FlattenedValidationError = ReturnType<ZodError['flatten']>;

type ParseSuccess<T> = { ok: true; data: T };
type ParseFailure = { ok: false; status: 400; error: string; details?: FlattenedValidationError };

export type ParseCreateRecordResult = ParseSuccess<CreateProcedureRecordInput> | ParseFailure;
export type ParseAddPaymentResult = ParseSuccess<AddProcedurePaymentInput> | ParseFailure;

export function parseCreateRecord(type: string, body: unknown): ParseCreateRecordResult {
  if (!isKnownProcedureType(type)) {
    return { ok: false, status: 400, error: `Unknown procedure type: ${type}` };
  }

  switch (type) {
    case PROCEDURE_TYPE_CODES.SERVICE_SALE: {
      const parsed = createServiceSaleRecordSchema.safeParse(body);
      if (!parsed.success) {
        return {
          ok: false,
          status: 400,
          error: 'Validation failed',
          details: parsed.error.flatten(),
        };
      }
      return { ok: true, data: mapServiceSaleCreateToInput(parsed.data) };
    }
    case PROCEDURE_TYPE_CODES.EXPENSE: {
      const parsed = createExpenseRecordSchema.safeParse(body);
      if (!parsed.success) {
        return {
          ok: false,
          status: 400,
          error: 'Validation failed',
          details: parsed.error.flatten(),
        };
      }
      return { ok: true, data: mapExpenseCreateToInput(parsed.data) };
    }
    case PROCEDURE_TYPE_CODES.PRODUCT_SALE: {
      const parsed = createProductSaleRecordSchema.safeParse(body);
      if (!parsed.success) {
        return {
          ok: false,
          status: 400,
          error: 'Validation failed',
          details: parsed.error.flatten(),
        };
      }
      return { ok: true, data: mapProductSaleCreateToInput(parsed.data) };
    }
    case PROCEDURE_TYPE_CODES.MEMBER_DEBT: {
      const parsed = createMemberDebtRecordSchema.safeParse(body);
      if (!parsed.success) {
        return {
          ok: false,
          status: 400,
          error: 'Validation failed',
          details: parsed.error.flatten(),
        };
      }
      return { ok: true, data: mapMemberDebtCreateToInput(parsed.data) };
    }
    case PROCEDURE_TYPE_CODES.MEMBERSHIP: {
      const parsed = createMembershipRecordSchema.safeParse(body);
      if (!parsed.success) {
        return {
          ok: false,
          status: 400,
          error: 'Validation failed',
          details: parsed.error.flatten(),
        };
      }
      return { ok: true, data: mapMembershipCreateToInput(parsed.data) };
    }
    case PROCEDURE_TYPE_CODES.COURSE_SUBSCRIPTION: {
      const parsed = createCourseSubscriptionRecordSchema.safeParse(body);
      if (!parsed.success) {
        return {
          ok: false,
          status: 400,
          error: 'Validation failed',
          details: parsed.error.flatten(),
        };
      }
      return { ok: true, data: mapCourseSubscriptionCreateToInput(parsed.data) };
    }
    case PROCEDURE_TYPE_CODES.MEMBER_CREDIT: {
      const parsed = createMemberCreditRecordSchema.safeParse(body);
      if (!parsed.success) {
        return {
          ok: false,
          status: 400,
          error: 'Validation failed',
          details: parsed.error.flatten(),
        };
      }
      return { ok: true, data: mapMemberCreditCreateToInput(parsed.data) };
    }
    default: {
      const _exhaustive: never = type;
      return { ok: false, status: 400, error: `No create validator for procedure type: ${_exhaustive}` };
    }
  }
}

function normalizePaymentBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const record = body as Record<string, unknown>;
  return {
    ...record,
    amount: record.amount ?? record.amountPaid,
  };
}

export function parseAddPayment(type: string, body: unknown): ParseAddPaymentResult {
  if (!isKnownProcedureType(type)) {
    return { ok: false, status: 400, error: `Unknown procedure type: ${type}` };
  }

  const parsed = addProcedurePaymentSchema.safeParse(normalizePaymentBody(body));
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: 'Validation failed',
      details: parsed.error.flatten(),
    };
  }

  const data = parsed.data;
  const mapped: AddProcedurePaymentInput = {
    amount: data.amount,
    paymentDate: data.paymentDate,
    notes: data.description?.trim() || data.notes?.trim() || null,
    operatorId: data.operatorId,
    operatorPassword: data.operatorPassword,
    payMode: data.payMode,
    paymentType: data.paymentType,
    taxDoc: data.taxDoc,
    debtTotal: data.debtTotal,
    debtExpire: data.debtExpire,
    payWith: data.payWith,
    createReceipt: data.createReceipt ?? data.taxDoc,
    receiptDocumentType: data.receiptDocumentType ?? data.taxDocument?.documentType ?? 'Invoice',
    receiptNumber: data.receiptNumber ?? data.taxDocument?.documentNumber,
    receiptAnnotations: data.receiptAnnotations ?? data.taxDocument?.causal ?? null,
    serviceName: data.serviceName,
    taxDocument: data.taxDocument,
  };

  return { ok: true, data: mapped };
}
