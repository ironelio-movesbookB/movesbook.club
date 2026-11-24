import { z } from 'zod';
import type { CreateProcedureRecordInput } from '../types';

const taxDocumentSchema = z
  .object({
    documentType: z.string().optional().nullable(),
    heading: z.string().optional().nullable(),
    documentDate: z.string().optional().nullable(),
    documentNumber: z.string().optional().nullable(),
    causal: z.string().optional().nullable(),
    total: z.number().optional().nullable(),
    residualTotal: z.number().optional().nullable(),
    methodPayment: z.string().optional().nullable(),
    vatPercentage: z.number().optional().nullable(),
    vatAmount: z.number().optional().nullable(),
    net: z.number().optional().nullable(),
    memberDisplayName: z.string().optional().nullable(),
    originalMemberName: z.string().optional().nullable(),
    memberAlias: z.string().optional().nullable(),
    memberNameEditable: z.boolean().optional().nullable(),
    formCausal: z.string().optional().nullable(),
    counterKey: z.string().optional().nullable(),
  })
  .optional()
  .nullable();

export const createProductSaleRecordSchema = z.object({
  memberId: z.string().min(1),
  totalAmount: z.number().nonnegative(),
  initialPayment: z.number().nonnegative().optional(),
  recordDate: z.string().min(1),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  causal: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  productName: z.string().optional().nullable(),
  sectorName: z.string().optional().nullable(),
  operatorId: z.string().optional().nullable(),
  operatorPassword: z.string().optional().nullable(),
  payMode: z.string().optional().nullable(),
  paymentType: z.enum(['D', 'B']).optional().nullable(),
  taxDoc: z.boolean().optional(),
  discount: z.number().nonnegative().optional().nullable(),
  discountApplied: z.boolean().optional(),
  movementTime: z.string().optional().nullable(),
  paymentDate: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  createReceipt: z.boolean().optional(),
  receiptDocumentType: z.string().optional().nullable(),
  receiptNumber: z.string().optional().nullable(),
  receiptAnnotations: z.string().optional().nullable(),
  taxDocument: taxDocumentSchema,
});

export type CreateProductSaleRecordPayload = z.infer<typeof createProductSaleRecordSchema>;

export function mapProductSaleCreateToInput(
  data: CreateProductSaleRecordPayload
): CreateProcedureRecordInput {
  const notes = data.causal?.trim() || data.notes?.trim() || null;
  const paymentDate = data.paymentDate ?? data.recordDate;
  const productName = data.productName?.trim() || 'Product';

  return {
    memberId: data.memberId,
    totalAmount: data.totalAmount,
    initialPayment: data.initialPayment,
    recordDate: data.recordDate,
    dueDate: data.dueDate ?? paymentDate,
    notes,
    metadata: {
      productId: data.productId ?? null,
      productName,
      sectorName: data.sectorName ?? null,
      discount: data.discount ?? 0,
      discountApplied: data.discountApplied ?? false,
      movementTime: data.movementTime ?? null,
      paymentType: data.paymentType ?? 'D',
      taxDoc: data.taxDoc ?? false,
      companyId: data.companyId ?? null,
      companyName: data.companyName ?? null,
      causal: notes,
    },
    operatorId: data.operatorId,
    operatorPassword: data.operatorPassword,
    payMode: data.payMode,
    paymentType: data.paymentType ?? 'D',
    taxDoc: data.taxDoc,
    discount: data.discount,
    discountApplied: data.discountApplied,
    movementTime: data.movementTime,
    paymentDate,
    createReceipt: data.createReceipt,
    receiptDocumentType: data.receiptDocumentType ?? data.taxDocument?.documentType ?? 'Invoice',
    receiptNumber: data.receiptNumber ?? data.taxDocument?.documentNumber,
    receiptAnnotations: data.receiptAnnotations ?? data.taxDocument?.causal ?? null,
    serviceName: productName,
    taxDocument: data.taxDocument,
  };
}
