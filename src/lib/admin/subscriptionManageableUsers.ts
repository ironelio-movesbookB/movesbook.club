import {
  getSubscriptionById,
  getSubscriptionEditData,
} from '@/lib/admin/subscriptionSettingsMock';
import { hasCreatableCompaniesSetting } from '@/lib/admin/subscriptionEditSettingsLayout';

/** Companies creatable by admin — from saved version settings (coach / team / club only). */
export function getCreatableCompaniesLimit(subscriptionSettingId: number | null | undefined): number | null {
  if (subscriptionSettingId == null || !Number.isFinite(subscriptionSettingId)) return null;

  const row = getSubscriptionById(subscriptionSettingId);
  if (!row || !hasCreatableCompaniesSetting(row.userType)) return null;

  const editData = getSubscriptionEditData(subscriptionSettingId, false);
  const fromSettings = editData?.settings.creatableCompanies;
  if (typeof fromSettings === 'number') return fromSettings;

  return row.creatableCompanies;
}

export function isCreatableCompaniesUnlimited(limit: number): boolean {
  return limit === -1;
}

export function canCreateAnotherCompany(limit: number, createdCount: number): boolean {
  if (isCreatableCompaniesUnlimited(limit)) return true;
  if (limit <= 0) return false;
  return createdCount < limit;
}

export function remainingCreatableCompanies(limit: number, createdCount: number): number | null {
  if (isCreatableCompaniesUnlimited(limit)) return null;
  return Math.max(0, limit - createdCount);
}

function readManageableUsersFromSubscription(subscriptionSettingId: number) {
  const row = getSubscriptionById(subscriptionSettingId);
  if (!row || !hasCreatableCompaniesSetting(row.userType)) return null;

  const editData = getSubscriptionEditData(subscriptionSettingId, false);
  return {
    usersFirstSubscription:
      editData?.settings.usersAvailableFirstSubscription ?? row.usersFirstSubscription,
    usersRenewal: editData?.settings.usersAvailableRenewal ?? row.usersRenewal,
  };
}

export function getUsersAvailableFirstSubscription(
  subscriptionSettingId: number | null | undefined,
): number | null {
  if (subscriptionSettingId == null || !Number.isFinite(subscriptionSettingId)) return null;
  return readManageableUsersFromSubscription(subscriptionSettingId)?.usersFirstSubscription ?? null;
}

export function getUsersAvailableRenewal(
  subscriptionSettingId: number | null | undefined,
): number | null {
  if (subscriptionSettingId == null || !Number.isFinite(subscriptionSettingId)) return null;
  return readManageableUsersFromSubscription(subscriptionSettingId)?.usersRenewal ?? null;
}

export function isMemberDatabaseUnlimited(limit: number): boolean {
  return limit === -1;
}

export function getMemberDatabaseAllowance(
  subscriptionSettingId: number | null | undefined,
  phase: 'first' | 'renewal',
): number | null {
  const value =
    phase === 'renewal'
      ? getUsersAvailableRenewal(subscriptionSettingId)
      : getUsersAvailableFirstSubscription(subscriptionSettingId);
  return value ?? null;
}
