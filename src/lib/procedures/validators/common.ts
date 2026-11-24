import { z } from 'zod';

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

/** Shared payment payload — same for all procedure types. */
export const addProcedurePaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentDate: z.string().min(1),
  notes: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  operatorId: z.string().optional().nullable(),
  operatorPassword: z.string().optional().nullable(),
  payMode: z.string().optional().nullable(),
  paymentType: z.enum(['D', 'B']).optional().nullable(),
  taxDoc: z.boolean().optional(),
  debtTotal: z.number().optional().nullable(),
  debtExpire: z.string().optional().nullable(),
  payWith: z.number().optional().nullable(),
  createReceipt: z.boolean().optional(),
  receiptDocumentType: z.string().optional().nullable(),
  receiptNumber: z.string().optional().nullable(),
  receiptAnnotations: z.string().optional().nullable(),
  serviceName: z.string().optional().nullable(),
  taxDocument: taxDocumentSchema,
});

export type AddProcedurePaymentPayload = z.infer<typeof addProcedurePaymentSchema>;
