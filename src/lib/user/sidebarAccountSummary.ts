import { prisma } from '@/lib/prisma';
import { getSubscriptionById } from '@/lib/admin/subscriptionSettingsMock';
import {
  pickCurrentSubscriptionPeriod,
  readNetworkSubscriptionHistory,
} from '@/lib/admin/networkSubscriptionHistory';
import { resolveLegacySubscriptionForUser } from '@/lib/registration/memberRegistrationInfoService';
import { versionDurationDays } from '@/lib/subscriptions/specialOffers';

export type SidebarAccountSummary = {
  /** Purchased version name, e.g. "Club Base". */
  version: string | null;
  /** Current membership end, YYYY-MM-DD. */
  expiration: string | null;
};

function addDaysYmd(ymd: string, days: number): string {
  const date = new Date(`${ymd.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return ymd.slice(0, 10);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Current purchased version and its end date for the My Page sidebar. */
export async function getSidebarAccountSummary(userId: string): Promise<SidebarAccountSummary> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, settings: { select: { adminSettings: true } } },
  });
  const current = pickCurrentSubscriptionPeriod(
    readNetworkSubscriptionHistory(user?.settings?.adminSettings),
  );
  const copiedVersionId = await versionIdFromUserCopy(userId);
  let versionId = copiedVersionId;
  // Legacy lookup is only needed when this account has no version copy and no membership end.
  const legacy =
    current?.dateEnd || versionId != null
      ? null
      : await resolveLegacySubscriptionForUser(userId).catch(() => null);
  if (versionId == null && legacy?.subscriptionSettingId) {
    versionId = legacy.subscriptionSettingId;
  }

  const version =
    current?.version?.trim() ||
    (versionId != null ? getSubscriptionById(versionId)?.name?.trim() : '') ||
    null;

  const startYmd =
    current?.dateStart?.slice(0, 10) ||
    legacy?.subscriptionStartDate?.slice(0, 10) ||
    user?.createdAt.toISOString().slice(0, 10) ||
    null;
  const expiration =
    current?.dateEnd?.slice(0, 10) ||
    legacy?.subscriptionEndDate?.slice(0, 10) ||
    (startYmd ? addDaysYmd(startYmd, versionId != null ? versionDurationDays(versionId) : 365) : null);

  return { version, expiration };
}

/** PCU copy of the purchased version (`user_version_settings.version_id`). Read-only. */
async function versionIdFromUserCopy(userId: string): Promise<number | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ version_id: number | null }[]>(
      `SELECT version_id FROM user_version_settings WHERE user_id = ? LIMIT 1`,
      userId,
    );
    const versionId = rows[0]?.version_id;
    return versionId == null ? null : Number(versionId);
  } catch {
    return null;
  }
}
