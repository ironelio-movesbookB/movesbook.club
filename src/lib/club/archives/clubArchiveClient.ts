'use client';

import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import type { Member } from '@/types/clubTable';

export type ArchiveListResult = {
  items: Member[];
  total: number;
  page: number;
  pageSize: number;
};

export type ArchiveType =
  | 'members'
  | 'parents'
  | 'operators'
  | 'affiliations'
  | 'subscriptions'
  | 'product-sales'
  | 'product-sales-unified'
  | 'credits'
  | 'cash-movements'
  | 'deadlines'
  | 'payments'
  | 'receipts'
  | 'accesses'
  | 'reservations'
  | 'cards-assignments'
  | 'events'
  | 'polls'
  | 'marketing-contacts'
  | 'alerts-assigned'
  | 'advertising-campaigns'
  | 'staff-queries';

export type ArchiveFetchParams = {
  page?: number;
  pageSize?: number;
  direction?: 'all' | 'IN' | 'OUT';
  search?: string;
  fromDate?: string;
  toDate?: string;
  orderBy?: 'recent' | 'old';
  includePaid?: boolean;
  /** Deadlines archive: one row per installment instead of one row per record. */
  expandDeadlines?: boolean;
  /** Scope to a single member (e.g. "Member selected" vs "All members" toggle). */
  memberId?: string;
  /** Club to load; required for correct Archive of Members when admin owns several clubs. */
  clubId?: string;
  /** Team workspace id (Team Admin Archive of Users). */
  teamId?: string;
  /** Scope to the record selected in the archive we came from ("Record selected"). */
  recordId?: string;
  /** Filter by sport. */
  sport?: string;
  /** Filter by group of training. */
  groupTrained?: string;
  /** Saved member group id (Archive → Groups). */
  memberGroupId?: string;
  /** member | pending | not_member | archived | all (all = A+B+C, excludes archived) */
  membershipStatus?: 'member' | 'pending' | 'not_member' | 'archived' | 'all';
  /** Archive of Payments: only payments still to be verified. */
  toBeVerified?: boolean;
};

export async function fetchClubArchive(
  type: ArchiveType,
  params?: ArchiveFetchParams
): Promise<ArchiveListResult> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
  if (params?.direction) qs.set('direction', params.direction);
  if (params?.search) qs.set('search', params.search);
  if (params?.fromDate) qs.set('fromDate', params.fromDate);
  if (params?.toDate) qs.set('toDate', params.toDate);
  if (params?.orderBy) qs.set('orderBy', params.orderBy);
  if (params?.includePaid) qs.set('includePaid', '1');
  if (params?.expandDeadlines) qs.set('expandDeadlines', '1');
  if (params?.memberId) qs.set('memberId', params.memberId);
  if (params?.clubId) qs.set('clubId', params.clubId);
  if (params?.teamId) qs.set('teamId', params.teamId);
  if (params?.recordId) qs.set('recordId', params.recordId);
  if (params?.sport) qs.set('sport', params.sport);
  if (params?.groupTrained) qs.set('groupTrained', params.groupTrained);
  if (params?.memberGroupId) qs.set('memberGroupId', params.memberGroupId);
  if (params?.membershipStatus) {
    qs.set('membershipStatus', params.membershipStatus);
  }
  if (params?.toBeVerified) qs.set('toBeVerified', '1');
  const query = qs.toString();
  const url = `/api/club/archives/${type}${query ? `?${query}` : ''}`;
  return clubApiFetch<ArchiveListResult>(url);
}

export async function fetchCompanies(): Promise<{ id: string; name: string }[]> {
  const res = await clubApiFetch<{ companies: { id: string; name: string }[] }>('/api/club/companies');
  return res.companies;
}

export type InstallmentRow = {
  id: string;
  procedureRecordId: string;
  paid: number;
  balance: number;
  paymentDate: string;
  expireDate: string | null;
  createdAt?: string | null;
  description: string | null;
};

const BASE = '/api/club/procedures';

export async function fetchInstallments(
  procedureType: string,
  recordId: string
): Promise<InstallmentRow[]> {
  const res = await clubApiFetch<{ items: InstallmentRow[] }>(
    `${BASE}/${procedureType}/records/${recordId}/installments`
  );
  return res.items;
}

export async function createInstallment(
  procedureType: string,
  recordId: string,
  body: {
    balance: number;
    paid?: number;
    paymentDate: string;
    expireDate?: string | null;
    description?: string | null;
  }
): Promise<InstallmentRow> {
  const res = await clubApiFetch<{ installment: InstallmentRow }>(
    `${BASE}/${procedureType}/records/${recordId}/installments`,
    { method: 'POST', body: JSON.stringify(body) }
  );
  return res.installment;
}

export async function updateInstallment(
  procedureType: string,
  recordId: string,
  installmentId: string,
  body: Partial<{
    balance: number;
    paid: number;
    paymentDate: string;
    expireDate: string | null;
    description: string | null;
  }>
): Promise<InstallmentRow> {
  const res = await clubApiFetch<{ installment: InstallmentRow }>(
    `${BASE}/${procedureType}/records/${recordId}/installments?id=${encodeURIComponent(installmentId)}`,
    { method: 'PUT', body: JSON.stringify(body) }
  );
  return res.installment;
}

export async function deleteInstallment(
  procedureType: string,
  recordId: string,
  installmentId: string
): Promise<void> {
  await clubApiFetch(
    `${BASE}/${procedureType}/records/${recordId}/installments?id=${encodeURIComponent(installmentId)}`,
    { method: 'DELETE' }
  );
}

/** Archive of the Deadlines: delete one deadline (refused when it is already paid). */
export async function deleteArchiveDeadline(
  procedureType: string,
  recordId: string,
  installmentId: string
): Promise<{ deleted: 'deadline' | 'record' }> {
  return clubApiFetch<{ deleted: 'deadline' | 'record' }>(
    `${BASE}/${procedureType}/records/${recordId}/installments?id=${encodeURIComponent(installmentId)}&mode=archive`,
    { method: 'DELETE' }
  );
}
