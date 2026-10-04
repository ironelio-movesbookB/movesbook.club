import { Prisma, ProcedureRecordStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { findExistingTable } from '@/lib/club/legacyTableLookup';
import { getProcedureDefinition, getProcedureTypology } from './registry';
import { paginated, parsePagination } from './pagination';
import { verifyOperatorPassword } from './operatorAuth';
import { applyCardCreditPayment } from './insertCreditService';
import {
  ensureDefaultInstallment,
  applyPaymentToInstallments,
  reversePaymentOnInstallments,
} from './installmentService';
import { PROCEDURE_TYPE_CODES } from './types';
import { updateTaxDocumentCounter } from '@/lib/club/otherSettingsReader';
import {
  forgetMemberSettingsDeadlines,
  forgetMemberSettingsFirstPaid,
  MEMBER_SETTINGS_INSTALLMENT_LABELS,
  MEMBER_SETTINGS_RECORD_SOURCE,
} from '@/lib/club/memberSettingsDeadlineLinks';
import type {
  AddProcedurePaymentInput,
  ClubAuthContext,
  CreateProcedureRecordInput,
  ListQuery,
  ProcedurePaymentDto,
  ProcedureReceiptDto,
  ProcedureRecordDto,
} from './types';
import { decimalToNumber } from './types';

function formatUserName(user: {
  firstName: string | null;
  surname: string | null;
  name: string;
  username: string;
}): string {
  return [user.firstName, user.surname].filter(Boolean).join(' ').trim() || user.name || user.username;
}

function toDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

async function memberIdsMatchingSearch(search: string): Promise<string[]> {
  const q = search.trim();
  if (!q) return [];
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { firstName: { contains: q } },
        { surname: { contains: q } },
        { username: { contains: q } },
      ],
    },
    select: { id: true },
    take: 300,
  });
  return users.map((u) => u.id);
}

async function recordListFilterExtras(query: ListQuery): Promise<{
  whereExtras: Prisma.ProcedureRecordWhereInput;
  orderBy: Prisma.ProcedureRecordOrderByWithRelationInput;
}> {
  const whereExtras: Prisma.ProcedureRecordWhereInput = {};
  if (query.fromDate || query.toDate) {
    whereExtras.recordDate = {
      ...(query.fromDate ? { gte: toDateOnly(query.fromDate) } : {}),
      ...(query.toDate ? { lte: toDateOnly(query.toDate) } : {}),
    };
  }
  const search = query.search?.trim();
  if (search) {
    const memberIds = await memberIdsMatchingSearch(search);
    whereExtras.OR = [
      { notes: { contains: search } },
      ...(memberIds.length > 0 ? [{ memberId: { in: memberIds } }] : []),
    ];
  }
  const orderBy: Prisma.ProcedureRecordOrderByWithRelationInput =
    query.orderBy === 'old'
      ? { recordDate: 'asc' }
      : { recordDate: 'desc' };
  return { whereExtras, orderBy };
}


function buildPaymentCreateData(data: {
  procedureRecordId: string;
  amount: number;
  balanceAfter: number;
  paymentDate: Date;
  operatorId: string;
  payMode: string | null;
  notes: string | null;
}): Prisma.ProcedurePaymentUncheckedCreateInput {
  return data as Prisma.ProcedurePaymentUncheckedCreateInput;
}

function readBalanceAfter(payment: unknown): number | null {
  const value = (payment as { balanceAfter?: Prisma.Decimal | null }).balanceAfter;
  return value != null ? decimalToNumber(value) : null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function metaString(metadata: Record<string, unknown> | null | undefined, key: string): string {
  const value = metadata?.[key];
  return value != null ? String(value).trim() : '';
}

function receiptMemberName(
  memberId: string,
  metadata: Record<string, unknown> | null | undefined,
  nameById: Map<string, string>
): string {
  const taxDocument = metadata?.taxDocument;
  if (taxDocument && typeof taxDocument === 'object' && !Array.isArray(taxDocument)) {
    const displayName = metaString(taxDocument as Record<string, unknown>, 'memberDisplayName');
    if (displayName) return displayName;
  }
  return nameById.get(memberId) ?? memberId;
}

async function loadUserNames(ids: string[]): Promise<Map<string, string>> {
  const profiles = await loadUserProfiles(ids);
  return new Map(Array.from(profiles.entries()).map(([id, p]) => [id, p.name]));
}

async function loadUserProfiles(
  ids: string[]
): Promise<Map<string, { name: string; image: string | null }>> {
  const unique = Array.from(new Set(ids.filter(Boolean) as string[]));
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, firstName: true, surname: true, name: true, username: true, image: true },
  });
  return new Map(
    users.map((u) => [
      u.id,
      {
        name: formatUserName(u),
        image: u.image?.trim() || null,
      },
    ])
  );
}

async function getLegacyUserId(userId: string): Promise<string | null> {
  const fromId = userId.match(/^legacy_(\d+)(?:_|$)/);
  if (fromId?.[1]) return fromId[1];

  const mappingTable = await findExistingTable(['legacy_id_mappings']);
  if (!mappingTable) return null;

  const rows = await prisma.$queryRawUnsafe<{ legacy_id: number | string }[]>(
    `SELECT legacy_id
     FROM \`${mappingTable}\`
     WHERE new_id = ?
       AND legacy_table = 'users'
     ORDER BY legacy_id DESC
     LIMIT 1`,
    userId
  );

  return rows[0]?.legacy_id != null ? String(rows[0].legacy_id) : null;
}

async function getOtherSetting(clubId: string, key: string, userId?: string): Promise<string> {
  const TABLE_NAME = 'club_reader_other_settings';
  const JSON_TABLE_NAME = 'club_other_settings';

  try {
    const tableName = await findExistingTable([TABLE_NAME]);
    if (tableName && userId) {
      const legacyUserId = await getLegacyUserId(userId);
      const userIds = Array.from(new Set([userId, legacyUserId].filter(Boolean) as string[]));
      const userPlaceholders = userIds.map(() => '?').join(',');

      const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT \`${key}\` AS val
         FROM \`${tableName}\`
         WHERE club_user_id IN (${userPlaceholders})
           AND club_id = ?
         ORDER BY id DESC LIMIT 1`,
        ...userIds, clubId
      );
      const val = rows?.[0]?.val != null ? String(rows[0].val) : '';
      if (val) return val;
    }
  } catch {
    /* table may not exist */
  }
  try {
    const jsonTable = await findExistingTable([JSON_TABLE_NAME]);
    if (jsonTable) {
      const rows = await prisma.$queryRawUnsafe<{ settings_json: string }[]>(
        `SELECT settings_json FROM \`${jsonTable}\` ORDER BY id DESC LIMIT 1`
      );
      if (rows?.[0]?.settings_json) {
        const json = JSON.parse(rows[0].settings_json);
        const mapping: Record<string, string> = {
          operator_pass_status: 'operatorPassStatus',
          form_pay_deadline_status: 'formPayDeadlineStatus',
        };
        const jsKey = mapping[key];
        if (jsKey && json[jsKey] != null) return String(json[jsKey]);
      }
    }
  } catch {
    /* fall through */
  }
  return '';
}

function isPasswordEnabledSetting(value: string): boolean {
  const normalised = value.trim().toLowerCase();
  return normalised === 'yes' || normalised === 'y' || normalised === '1' || normalised === 't' || normalised === 'true';
}

async function assertOperatorPassword(
  procedureTypeCode: string,
  operatorId: string | null | undefined,
  password: string | null | undefined,
  clubId?: string,
  userId?: string
): Promise<void> {
  const requiresPassword =
    procedureTypeCode === PROCEDURE_TYPE_CODES.SERVICE_SALE ||
    procedureTypeCode === PROCEDURE_TYPE_CODES.PRODUCT_SALE ||
    procedureTypeCode === PROCEDURE_TYPE_CODES.EXPENSE;
  if (!requiresPassword) return;
  if (clubId) {
    const setting = await getOtherSetting(clubId, 'operator_pass_status', userId);
    if (!setting || !isPasswordEnabledSetting(setting)) return;
  }
  const trimmed = password?.trim();
  if (!trimmed) throw new Error('Operator password is required');
  if (!operatorId) throw new Error('Operator is required');
  const ok = await verifyOperatorPassword(operatorId, trimmed);
  if (!ok) throw new Error('Operator password is incorrect');
}

function mergeMetadata(
  existing: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>
): Record<string, unknown> {
  return { ...(existing ?? {}), ...patch };
}

export class ProcedureService {
  async getProcedureTypeByCode(code: string) {
    const existing = await prisma.procedureType.findFirst({ where: { code, isActive: true } });
    if (existing) return existing;

    const def = getProcedureDefinition(code);
    if (!def) return null;

    return prisma.procedureType.upsert({
      where: { code },
      update: { name: def.name, description: def.form.subtitle, isActive: true },
      create: { code, name: def.name, description: def.form.subtitle, isActive: true },
    });
  }

  async createRecord(
    ctx: ClubAuthContext,
    procedureTypeCode: string,
    input: CreateProcedureRecordInput
  ) {
    const procedureType = await this.getProcedureTypeByCode(procedureTypeCode);
    if (!procedureType) throw new Error('Unknown procedure type');

    const deadlineStatus = await getOtherSetting(ctx.club.id, 'form_pay_deadline_status', ctx.userId);
    const skipDeadlines = deadlineStatus === 'No';

    const totalAmount = skipDeadlines ? 0 : roundMoney(input.totalAmount);
    const initialPayment = skipDeadlines ? 0 : roundMoney(input.initialPayment ?? 0);
    if (initialPayment > totalAmount) throw new Error('Initial payment exceeds total amount');

    const balanceAmount = roundMoney(totalAmount - initialPayment);
    // PHP allowed “operator” to be empty on some screens. We treat `undefined` as “use current user”,
    // but preserve an explicit `null` so procedureRecord.operatorId can be null.
    const operatorId = input.operatorId === undefined ? ctx.userId : input.operatorId;
    await assertOperatorPassword(procedureTypeCode, operatorId, input.operatorPassword, ctx.club.id, ctx.userId);

    const recordDate = toDateOnly(input.recordDate);
    const paymentDate = input.paymentDate ? toDateOnly(input.paymentDate) : recordDate;
    // An explicit null means "no expiration"; only an omitted dueDate inherits the payment date.
    const dueDate =
      input.dueDate === undefined ? paymentDate : input.dueDate ? toDateOnly(input.dueDate) : null;

    const metadata = mergeMetadata(input.metadata ?? null, {
      ...(input.paymentType ? { paymentType: input.paymentType } : {}),
      ...(input.taxDoc != null ? { taxDoc: input.taxDoc } : {}),
      ...(input.taxDocument ? { taxDocument: input.taxDocument } : {}),
    });

    return prisma.$transaction(async (tx) => {
      const record = await tx.procedureRecord.create({
        data: {
          procedureTypeId: procedureType.id,
          clubId: ctx.club.id,
          memberId: input.memberId,
          operatorId,
          totalAmount,
          paidAmount: initialPayment,
          balanceAmount,
          recordDate,
          dueDate,
          notes: input.notes ?? null,
          metadata: metadata as Prisma.InputJsonValue,
          status: ProcedureRecordStatus.ACTIVE,
        },
      });

      let paymentId: string | null = null;
      if (initialPayment > 0) {
        const payment = await tx.procedurePayment.create({
          data: buildPaymentCreateData({
            procedureRecordId: record.id,
            amount: initialPayment,
            balanceAfter: balanceAmount,
            paymentDate,
            operatorId,
            payMode: input.payMode ?? null,
            notes: input.notes ?? null,
          }),
        });
        paymentId = payment.id;
      }

      let receiptId: string | null = null;
      if (input.createReceipt && initialPayment > 0) {
        const documentType = input.receiptDocumentType ?? 'Invoice';
        const documentNumber =
          input.receiptNumber ?? `${recordDate.getUTCFullYear()}-${String(record.id).slice(-6)}`;
        const receipt = await tx.procedureReceipt.create({
          data: {
            procedureRecordId: record.id,
            procedurePaymentId: paymentId,
            clubId: ctx.club.id,
            memberId: input.memberId,
            operatorId,
            documentType,
            documentNumber,
            amount: totalAmount,
            paymentAmount: initialPayment,
            annotations: input.receiptAnnotations ?? input.notes ?? null,
            serviceName: input.serviceName ?? null,
            receiptDate: paymentDate,
          },
        });
        receiptId = receipt.id;
        try {
          await updateTaxDocumentCounter(
            { userId: ctx.userId, clubId: ctx.club.id },
            documentType,
            documentNumber
          );
        } catch (counterError) {
          console.error('createRecord: tax counter update failed:', counterError);
        }
      }

      if (!skipDeadlines) {
        await ensureDefaultInstallment(
          record.id,
          totalAmount,
          initialPayment,
          paymentDate.toISOString().slice(0, 10),
          dueDate?.toISOString().slice(0, 10) ?? null,
          input.notes ?? null,
          tx
        );
      }

      if (initialPayment > 0 && input.payMode === 'card') {
        await applyCardCreditPayment(ctx.club.id, input.memberId, initialPayment, operatorId);
      }

      return { recordId: record.id, paymentId, receiptId };
    });
  }

  async addPayment(
    ctx: ClubAuthContext,
    procedureTypeCode: string,
    recordId: string,
    input: AddProcedurePaymentInput
  ) {
    const procedureType = await this.getProcedureTypeByCode(procedureTypeCode);
    if (!procedureType) throw new Error('Unknown procedure type');

    const amount = roundMoney(input.amount);
    if (amount <= 0) throw new Error('Payment amount must be greater than 0');

    const record = await prisma.procedureRecord.findFirst({
      where: {
        id: recordId,
        clubId: ctx.club.id,
        procedureTypeId: procedureType.id,
        status: ProcedureRecordStatus.ACTIVE,
      },
    });
    if (!record) throw new Error('Record not found');

    const currentBalance = decimalToNumber(record.balanceAmount);
    if (amount > currentBalance) throw new Error('Payment exceeds remaining balance');

    const operatorId = input.operatorId ?? ctx.userId;
    await assertOperatorPassword(procedureTypeCode, operatorId, input.operatorPassword, ctx.club.id, ctx.userId);

    const paymentDate = toDateOnly(input.paymentDate);
    const newPaid = roundMoney(decimalToNumber(record.paidAmount) + amount);
    const newBalance = roundMoney(currentBalance - amount);

    const existingMetadata = (record.metadata as Record<string, unknown> | null) ?? null;
    const metadata = mergeMetadata(existingMetadata, {
      ...(input.paymentType ? { paymentType: input.paymentType } : {}),
      ...(input.taxDoc != null ? { taxDoc: input.taxDoc } : {}),
      ...(input.taxDocument ? { taxDocument: input.taxDocument } : {}),
    });

    // Commit payment first so a receipt failure cannot roll back the tracked payment.
    const paymentResult = await prisma.$transaction(async (tx) => {
      const payment = await tx.procedurePayment.create({
        data: buildPaymentCreateData({
          procedureRecordId: record.id,
          amount,
          balanceAfter: newBalance,
          paymentDate,
          operatorId,
          payMode: input.payMode ?? null,
          notes: input.notes ?? null,
        }),
      });

      await tx.procedureRecord.update({
        where: { id: record.id },
        data: {
          paidAmount: newPaid,
          balanceAmount: newBalance,
          operatorId,
          notes: input.notes ?? record.notes,
          dueDate: input.debtExpire ? toDateOnly(input.debtExpire) : record.dueDate,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });

      // Keep deadline rows in sync with the record (oldest open installment first).
      await applyPaymentToInstallments(record.id, amount, tx);

      if (input.payMode === 'card') {
        await applyCardCreditPayment(ctx.club.id, record.memberId, amount, operatorId);
      }

      return { paymentId: payment.id, balanceAmount: newBalance };
    });

    let receiptId: string | null = null;
    // Only create receipt when explicitly requested at Confirm (tagged from tax modal).
    if (input.createReceipt) {
      try {
        const documentType =
          input.receiptDocumentType ??
          (input.taxDocument && typeof input.taxDocument === 'object'
            ? String((input.taxDocument as { documentType?: string }).documentType ?? 'Invoice')
            : 'Invoice');
        const documentNumber =
          input.receiptNumber ??
          `${paymentDate.getUTCFullYear()}-${String(paymentResult.paymentId).slice(-6)}`;

        const receipt = await prisma.procedureReceipt.create({
          data: {
            procedureRecordId: record.id,
            procedurePaymentId: paymentResult.paymentId,
            clubId: ctx.club.id,
            memberId: record.memberId,
            operatorId,
            documentType,
            documentNumber,
            amount: decimalToNumber(record.totalAmount),
            paymentAmount: amount,
            annotations: input.receiptAnnotations ?? input.notes ?? null,
            serviceName: input.serviceName ?? null,
            receiptDate: paymentDate,
          },
        });
        receiptId = receipt.id;

        try {
          await updateTaxDocumentCounter(
            { userId: ctx.userId, clubId: ctx.club.id },
            documentType,
            documentNumber
          );
        } catch (counterError) {
          console.error('addPayment: tax counter update failed (receipt was saved):', counterError);
        }
      } catch (receiptError) {
        console.error('addPayment: receipt create failed (payment was saved):', receiptError);
      }
    }

    return { paymentId: paymentResult.paymentId, receiptId, balanceAmount: paymentResult.balanceAmount };
  }

  async softDeleteRecord(ctx: ClubAuthContext, procedureTypeCode: string, recordId: string) {
    const procedureType = await this.getProcedureTypeByCode(procedureTypeCode);
    if (!procedureType) throw new Error('Unknown procedure type');

    const result = await prisma.procedureRecord.updateMany({
      where: {
        id: recordId,
        clubId: ctx.club.id,
        procedureTypeId: procedureType.id,
        status: ProcedureRecordStatus.ACTIVE,
      },
      data: { status: ProcedureRecordStatus.DELETED },
    });
    if (result.count === 0) throw new Error('Record not found');

    const deleted = await prisma.procedureRecord.findUnique({
      where: { id: recordId },
      select: { memberId: true, metadata: true },
    });
    const source = (deleted?.metadata as Record<string, unknown> | null)?.source;
    if (deleted && source === MEMBER_SETTINGS_RECORD_SOURCE) {
      try {
        await forgetMemberSettingsDeadlines({
          clubId: ctx.club.id,
          memberUserId: deleted.memberId,
          recordId,
        });
      } catch (error) {
        console.error('softDeleteRecord: member Settings link not reset', error);
      }
    }
  }

  async updateRecord(
    ctx: ClubAuthContext,
    procedureTypeCode: string,
    recordId: string,
    input: {
      recordDate?: string;
      dueDate?: string | null;
      notes?: string;
      operatorId?: string;
      totalAmount?: number;
    }
  ) {
    const procedureType = await this.getProcedureTypeByCode(procedureTypeCode);
    if (!procedureType) throw new Error('Unknown procedure type');

    const record = await prisma.procedureRecord.findFirst({
      where: {
        id: recordId,
        clubId: ctx.club.id,
        procedureTypeId: procedureType.id,
        status: ProcedureRecordStatus.ACTIVE,
      },
    });
    if (!record) throw new Error('Record not found');

    const data: Record<string, unknown> = {};
    if (input.recordDate) data.recordDate = toDateOnly(input.recordDate);
    if (input.dueDate !== undefined) data.dueDate = input.dueDate ? toDateOnly(input.dueDate) : null;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.operatorId) data.operatorId = input.operatorId;
    if (input.totalAmount !== undefined) {
      const diff = input.totalAmount - decimalToNumber(record.totalAmount);
      data.totalAmount = input.totalAmount;
      data.balanceAmount = decimalToNumber(record.balanceAmount) + diff;
    }

    await prisma.procedureRecord.update({
      where: { id: recordId },
      data: data as Prisma.ProcedureRecordUpdateInput,
    });

    return { success: true };
  }

  async updatePayment(
    ctx: ClubAuthContext,
    procedureTypeCode: string,
    paymentId: string,
    input: { paymentDate?: string; notes?: string; operatorId?: string }
  ) {
    const procedureType = await this.getProcedureTypeByCode(procedureTypeCode);
    if (!procedureType) throw new Error('Unknown procedure type');

    const payment = await prisma.procedurePayment.findFirst({
      where: { id: paymentId },
      include: { procedureRecord: { select: { procedureTypeId: true, clubId: true } } },
    });
    if (!payment || payment.procedureRecord.clubId !== ctx.club.id || payment.procedureRecord.procedureTypeId !== procedureType.id) {
      throw new Error('Payment not found');
    }

    const data: Record<string, unknown> = {};
    if (input.paymentDate) data.paymentDate = toDateOnly(input.paymentDate);
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.operatorId) data.operatorId = input.operatorId;

    await prisma.procedurePayment.update({
      where: { id: paymentId },
      data: data as Prisma.ProcedurePaymentUpdateInput,
    });

    return { success: true };
  }

  async deletePayment(ctx: ClubAuthContext, procedureTypeCode: string, paymentId: string) {
    const procedureType = await this.getProcedureTypeByCode(procedureTypeCode);
    if (!procedureType) throw new Error('Unknown procedure type');

    const payment = await prisma.procedurePayment.findFirst({
      where: { id: paymentId },
      include: {
        procedureRecord: {
          select: {
            procedureTypeId: true,
            clubId: true,
            memberId: true,
            totalAmount: true,
            paidAmount: true,
            balanceAmount: true,
            metadata: true,
          },
        },
      },
    });
    if (!payment || payment.procedureRecord.clubId !== ctx.club.id || payment.procedureRecord.procedureTypeId !== procedureType.id) {
      throw new Error('Payment not found');
    }

    // The payment's amount owes again: back into the record's rest and the deadlines it settled.
    const record = payment.procedureRecord;
    const amount = roundMoney(decimalToNumber(payment.amount));
    const total = decimalToNumber(record.totalAmount);
    await prisma.$transaction(async (tx) => {
      await tx.procedurePayment.delete({ where: { id: paymentId } });
      await tx.procedureRecord.update({
        where: { id: payment.procedureRecordId },
        data: {
          paidAmount: roundMoney(Math.max(0, decimalToNumber(record.paidAmount) - amount)),
          balanceAmount: roundMoney(Math.min(total, decimalToNumber(record.balanceAmount) + amount)),
        },
      });
      await reversePaymentOnInstallments(payment.procedureRecordId, amount, tx);
    });

    const source = (record.metadata as Record<string, unknown> | null)?.source;
    if (
      source === MEMBER_SETTINGS_RECORD_SOURCE &&
      payment.notes === MEMBER_SETTINGS_INSTALLMENT_LABELS.firstPayment
    ) {
      try {
        await forgetMemberSettingsFirstPaid({
          clubId: ctx.club.id,
          memberUserId: record.memberId,
          recordId: payment.procedureRecordId,
        });
      } catch (error) {
        console.error('deletePayment: member Settings Paid tick not reset', error);
      }
    }

    return { success: true };
  }

  /** Duplicate document numbers are allowed (legacy data already has them) but must be flagged. */
  async checkDuplicateDocument(
    ctx: ClubAuthContext,
    documentType: string,
    documentNumber: string,
    excludeReceiptId?: string
  ): Promise<boolean> {
    const trimmedNumber = documentNumber.trim();
    if (!trimmedNumber) return false;

    const count = await prisma.procedureReceipt.count({
      where: {
        clubId: ctx.club.id,
        documentType,
        documentNumber: trimmedNumber,
        ...(excludeReceiptId ? { id: { not: excludeReceiptId } } : {}),
      },
    });

    return count > 0;
  }

  /** Keys of `documentType::documentNumber` pairs that appear on more than one receipt for the club. */
  async getDuplicateDocumentKeys(clubId: string): Promise<Set<string>> {
    const groups = await prisma.procedureReceipt.groupBy({
      by: ['documentType', 'documentNumber'],
      where: { clubId, documentNumber: { not: null } },
      _count: { id: true },
    });

    const keys = new Set<string>();
    for (const g of groups) {
      const number = (g.documentNumber ?? '').trim();
      if (!number) continue;
      if (g._count.id > 1) keys.add(`${g.documentType ?? ''}::${number}`);
    }
    return keys;
  }

  async updateReceipt(
    ctx: ClubAuthContext,
    procedureTypeCode: string,
    receiptId: string,
    input: { documentType?: string; documentNumber?: string; annotations?: string; confirmDuplicate?: boolean }
  ) {
    const procedureType = await this.getProcedureTypeByCode(procedureTypeCode);
    if (!procedureType) throw new Error('Unknown procedure type');

    const receipt = await prisma.procedureReceipt.findFirst({
      where: { id: receiptId },
      include: { procedureRecord: { select: { procedureTypeId: true, clubId: true } } },
    });
    if (!receipt || receipt.procedureRecord.clubId !== ctx.club.id || receipt.procedureRecord.procedureTypeId !== procedureType.id) {
      throw new Error('Receipt not found');
    }

    const nextDocumentType = input.documentType !== undefined ? input.documentType : (receipt.documentType ?? '');
    const nextDocumentNumber = input.documentNumber !== undefined ? input.documentNumber : (receipt.documentNumber ?? '');

    if (!input.confirmDuplicate) {
      const isDuplicate = await this.checkDuplicateDocument(ctx, nextDocumentType, nextDocumentNumber, receiptId);
      if (isDuplicate) {
        const error = new Error('Duplicate document number') as Error & { duplicate?: boolean };
        error.duplicate = true;
        throw error;
      }
    }

    const data: Record<string, unknown> = {};
    if (input.documentType !== undefined) data.documentType = input.documentType;
    if (input.documentNumber !== undefined) data.documentNumber = input.documentNumber;
    if (input.annotations !== undefined) data.annotations = input.annotations;

    await prisma.procedureReceipt.update({
      where: { id: receiptId },
      data: data as Prisma.ProcedureReceiptUpdateInput,
    });

    return { success: true };
  }

  async deleteReceipt(ctx: ClubAuthContext, procedureTypeCode: string, receiptId: string) {
    const procedureType = await this.getProcedureTypeByCode(procedureTypeCode);
    if (!procedureType) throw new Error('Unknown procedure type');

    const receipt = await prisma.procedureReceipt.findFirst({
      where: { id: receiptId },
      include: { procedureRecord: { select: { procedureTypeId: true, clubId: true } } },
    });
    if (!receipt || receipt.procedureRecord.clubId !== ctx.club.id || receipt.procedureRecord.procedureTypeId !== procedureType.id) {
      throw new Error('Receipt not found');
    }

    await prisma.procedureReceipt.delete({ where: { id: receiptId } });

    return { success: true };
  }

  async listRecords(
    ctx: ClubAuthContext,
    procedureTypeCode: string,
    query: ListQuery,
    options: { onlyWithBalance?: boolean } = {}
  ) {
    const procedureType = await this.getProcedureTypeByCode(procedureTypeCode);
    if (!procedureType) throw new Error('Unknown procedure type');

    const { page, pageSize, skip } = parsePagination(query);
    const { whereExtras, orderBy } = await recordListFilterExtras(query);
    const where: Prisma.ProcedureRecordWhereInput = {
      clubId: ctx.club.id,
      procedureTypeId: procedureType.id,
      procedureType: { code: procedureTypeCode },
      status: ProcedureRecordStatus.ACTIVE,
      ...(query.memberId ? { memberId: query.memberId } : {}),
      ...(query.recordIds && query.recordIds.length > 0
        ? { id: { in: query.recordIds } }
        : query.recordId
          ? { id: query.recordId }
          : {}),
      ...(options.onlyWithBalance ? { balanceAmount: { gt: 0 } } : {}),
      ...whereExtras,
    };

    const [total, rows] = await Promise.all([
      prisma.procedureRecord.count({ where }),
      prisma.procedureRecord.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: {
          payments: { select: { paymentDate: true }, orderBy: { paymentDate: 'desc' }, take: 1 },
        },
      }),
    ]);

    const profileById = await loadUserProfiles(
      rows.flatMap((r) => [r.memberId, r.operatorId].filter(Boolean) as string[])
    );

    const items: ProcedureRecordDto[] = rows.map((row) => ({
      id: row.id,
      procedureTypeCode,
      clubId: row.clubId,
      memberId: row.memberId,
      memberName: profileById.get(row.memberId)?.name ?? row.memberId,
      memberImage: profileById.get(row.memberId)?.image ?? null,
      operatorId: row.operatorId,
      operatorName: row.operatorId ? profileById.get(row.operatorId)?.name ?? '-' : '-',
      totalAmount: decimalToNumber(row.totalAmount),
      paidAmount: decimalToNumber(row.paidAmount),
      balanceAmount: decimalToNumber(row.balanceAmount),
      recordDate: row.recordDate.toISOString().slice(0, 10),
      dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
      createdAt: row.createdAt.toISOString(),
      notes: row.notes,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      lastPaymentDate: row.payments[0]?.paymentDate.toISOString().slice(0, 10) ?? null,
    }));

    return paginated(items, total, page, pageSize);
  }

  async listPayments(ctx: ClubAuthContext, procedureTypeCode: string, query: ListQuery) {
    const procedureType = await this.getProcedureTypeByCode(procedureTypeCode);
    if (!procedureType) throw new Error('Unknown procedure type');

    const { page, pageSize, skip } = parsePagination(query);
    const search = query.search?.trim();
    const memberIds = search ? await memberIdsMatchingSearch(search) : [];
    const where: Prisma.ProcedurePaymentWhereInput = {
      procedureRecord: {
        clubId: ctx.club.id,
        procedureTypeId: procedureType.id,
        procedureType: { code: procedureTypeCode },
        status: ProcedureRecordStatus.ACTIVE,
        ...(query.memberId ? { memberId: query.memberId } : {}),
        ...(query.recordIds && query.recordIds.length > 0
          ? { id: { in: query.recordIds } }
          : query.recordId
            ? { id: query.recordId }
            : {}),
      },
      ...(query.fromDate || query.toDate
        ? {
            paymentDate: {
              ...(query.fromDate ? { gte: toDateOnly(query.fromDate) } : {}),
              ...(query.toDate ? { lte: toDateOnly(query.toDate) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { notes: { contains: search } },
              ...(memberIds.length > 0
                ? [{ procedureRecord: { memberId: { in: memberIds } } }]
                : []),
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.procedurePayment.count({ where }),
      prisma.procedurePayment.findMany({
        where,
        orderBy:
          query.orderBy === 'old'
            ? [{ paymentDate: 'asc' }, { createdAt: 'asc' }]
            : [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: { procedureRecord: { select: { memberId: true, metadata: true, totalAmount: true, balanceAmount: true } } },
      }),
    ]);

    const nameById = await loadUserNames(
      rows.flatMap((r) => [r.procedureRecord.memberId, r.operatorId].filter(Boolean) as string[])
    );

    const items: ProcedurePaymentDto[] = rows.map((row) => {
      const metadata = (row.procedureRecord.metadata as Record<string, unknown> | null) ?? null;
      const def = getProcedureDefinition(procedureTypeCode);
      const primaryKey = def?.metadataKeys.primary ?? 'serviceName';
      return {
        id: row.id,
        procedureRecordId: row.procedureRecordId,
        memberId: row.procedureRecord.memberId,
        memberName: nameById.get(row.procedureRecord.memberId) ?? row.procedureRecord.memberId,
        amount: decimalToNumber(row.amount),
        paymentDate: row.paymentDate.toISOString().slice(0, 10),
        operatorId: row.operatorId,
        operatorName: row.operatorId ? nameById.get(row.operatorId) ?? '-' : '-',
        payMode: row.payMode,
        notes: row.notes,
        serviceName: metaString(metadata, primaryKey) || null,
        typology: getProcedureTypology(procedureTypeCode),
        balanceAfter: readBalanceAfter(row),
        originalDebt: decimalToNumber(row.procedureRecord.totalAmount),
        residualDebt: decimalToNumber(row.procedureRecord.balanceAmount),
      };
    });

    return paginated(items, total, page, pageSize);
  }

  async listReceipts(ctx: ClubAuthContext, procedureTypeCode: string, query: ListQuery) {
    const procedureType = await this.getProcedureTypeByCode(procedureTypeCode);
    if (!procedureType) throw new Error('Unknown procedure type');

    const { page, pageSize, skip } = parsePagination(query);
    const search = query.search?.trim();
    const memberIds = search ? await memberIdsMatchingSearch(search) : [];
    const where: Prisma.ProcedureReceiptWhereInput = {
      clubId: ctx.club.id,
      ...(query.memberId ? { memberId: query.memberId } : {}),
      procedureRecord: {
        procedureTypeId: procedureType.id,
        procedureType: { code: procedureTypeCode },
        status: ProcedureRecordStatus.ACTIVE,
        ...(query.recordIds && query.recordIds.length > 0
          ? { id: { in: query.recordIds } }
          : query.recordId
            ? { id: query.recordId }
            : {}),
      },
      ...(query.fromDate || query.toDate
        ? {
            receiptDate: {
              ...(query.fromDate ? { gte: toDateOnly(query.fromDate) } : {}),
              ...(query.toDate ? { lte: toDateOnly(query.toDate) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { annotations: { contains: search } },
              { documentNumber: { contains: search } },
              { serviceName: { contains: search } },
              ...(memberIds.length > 0 ? [{ memberId: { in: memberIds } }] : []),
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.procedureReceipt.count({ where }),
      prisma.procedureReceipt.findMany({
        where,
        orderBy: query.orderBy === 'old' ? { receiptDate: 'asc' } : { receiptDate: 'desc' },
        skip,
        take: pageSize,
        include: {
          procedureRecord: { select: { metadata: true, balanceAmount: true } },
        },
      }),
    ]);

    const nameById = await loadUserNames(
      rows.flatMap((r) => [r.memberId, r.operatorId].filter(Boolean) as string[])
    );

    const def = getProcedureDefinition(procedureTypeCode);
    const primaryKey = def?.metadataKeys.primary ?? 'serviceName';
    const duplicateKeys = await this.getDuplicateDocumentKeys(ctx.club.id);

    const items: ProcedureReceiptDto[] = rows.map((row) => {
      const metadata = (row.procedureRecord.metadata as Record<string, unknown> | null) ?? null;
      const documentNumber = (row.documentNumber ?? '').trim();
      return {
        id: row.id,
        procedureRecordId: row.procedureRecordId,
        procedurePaymentId: row.procedurePaymentId,
        memberId: row.memberId,
        memberName: receiptMemberName(row.memberId, metadata, nameById),
        documentType: row.documentType,
        documentNumber: row.documentNumber,
        amount: decimalToNumber(row.amount),
        paymentAmount: decimalToNumber(row.paymentAmount),
        residualDebt: decimalToNumber(row.procedureRecord.balanceAmount),
        serviceName: row.serviceName || metaString(metadata, primaryKey) || null,
        receiptDate: row.receiptDate.toISOString().slice(0, 10),
        annotations: row.annotations,
        typology: getProcedureTypology(procedureTypeCode),
        operatorName: row.operatorId ? nameById.get(row.operatorId) ?? '-' : '-',
        isDuplicate: documentNumber ? duplicateKeys.has(`${row.documentType ?? ''}::${documentNumber}`) : false,
      };
    });

    return paginated(items, total, page, pageSize);
  }
}

export const procedureService = new ProcedureService();
