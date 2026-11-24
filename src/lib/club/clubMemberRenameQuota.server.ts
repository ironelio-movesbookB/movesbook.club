import type { PrismaClient } from '@prisma/client';
import {
  getMemberDatabaseAllowance,
  isMemberDatabaseUnlimited,
} from '@/lib/admin/subscriptionManageableUsers';
import {
  parseClubDescriptionMeta,
  type ClubDescriptionMeta,
} from '@/lib/club/clubSidebarLabel';
import { getMemberRegistrationInfoForUser } from '@/lib/registration/memberRegistrationInfoService';
import {
  computeMemberRenameQuota,
  readMemberRenamesQuotaA,
  readMemberRenamesUsed,
  renameQuotaFromSlotCount,
  type MemberRenameQuotaPublic,
} from '@/lib/club/clubMemberRenameQuota';

type Db = Pick<PrismaClient, 'club' | 'team'>;

function serializeMeta(prev: ClubDescriptionMeta, patch: Partial<ClubDescriptionMeta>): string {
  return JSON.stringify({ ...prev, ...patch });
}

async function resolveTotalAvailableSlots(params: {
  description: string | null | undefined;
  viewerUserId: string;
}): Promise<{ total: number | null; unlimited: boolean; meta: ClubDescriptionMeta }> {
  const meta = parseClubDescriptionMeta(params.description);
  const registrationInfo = await getMemberRegistrationInfoForUser(params.viewerUserId).catch(
    () => null,
  );
  const phase = (meta.subscriptionRenewalCount ?? 0) > 0 ? 'renewal' : 'first';
  const allowance =
    getMemberDatabaseAllowance(registrationInfo?.subscriptionSettingId ?? null, phase) ?? 0;
  const unlimited = isMemberDatabaseUnlimited(allowance);
  if (unlimited) {
    return { total: null, unlimited: true, meta };
  }
  const total = (meta.membersPurchasedBase ?? 0) + Math.max(0, allowance);
  return { total, unlimited: false, meta };
}

/**
 * Ensure A is stored. First visit: A = floor(10% × current total available slots).
 * Returns public residual view (A − B).
 */
export async function resolveRenameQuotaForEntity(params: {
  description: string | null | undefined;
  createdAt?: Date | string | null;
  viewerUserId: string;
  /** When set, persist bootstrap of A onto this club/team. */
  persistKind?: 'club' | 'team';
  persistId?: string;
  db?: Db;
}): Promise<MemberRenameQuotaPublic> {
  void params.createdAt;
  const { total, unlimited, meta } = await resolveTotalAvailableSlots(params);
  if (unlimited) {
    return { residual: null, canRename: true, unlimited: true };
  }

  let quotaA = readMemberRenamesQuotaA(meta);
  if (quotaA === undefined) {
    quotaA = renameQuotaFromSlotCount(total ?? 0);
    if (params.db && params.persistKind && params.persistId) {
      const description = serializeMeta(meta, { memberRenamesQuota: quotaA });
      if (params.persistKind === 'team') {
        await params.db.team.update({
          where: { id: params.persistId },
          data: { description },
        });
      } else {
        await params.db.club.update({
          where: { id: params.persistId },
          data: { description },
        });
      }
    }
  }

  const stats = computeMemberRenameQuota({
    quotaA,
    renamesUsed: readMemberRenamesUsed(meta),
  });
  return {
    residual: stats.residual,
    canRename: stats.canRename,
    unlimited: stats.unlimited,
  };
}

/** +1 to B when a rename is consumed. */
export async function incrementMemberRenamesUsed(
  db: Db,
  params: { kind: 'club' | 'team'; id: string },
): Promise<number> {
  const select = { id: true, description: true } as const;
  const row =
    params.kind === 'team'
      ? await db.team.findUnique({ where: { id: params.id }, select })
      : await db.club.findUnique({ where: { id: params.id }, select });
  if (!row) return 0;

  const meta = parseClubDescriptionMeta(row.description);
  const next = readMemberRenamesUsed(meta) + 1;
  const description = serializeMeta(meta, { memberRenamesUsed: next });
  if (params.kind === 'team') {
    await db.team.update({ where: { id: params.id }, data: { description } });
  } else {
    await db.club.update({ where: { id: params.id }, data: { description } });
  }
  return next;
}

/**
 * Purchase N available slots:
 * - Total available slots += N (via membersPurchasedBase)
 * - A += floor(10% × N)
 */
export async function purchaseAvailableMemberSlots(
  db: Db,
  params: {
    kind: 'club' | 'team';
    id: string;
    slots: number;
    viewerUserId: string;
  },
): Promise<
  | {
      ok: true;
      slotsAdded: number;
      renamesAddedToA: number;
      membersPurchasedBase: number;
      memberRenamesQuota: number;
      renameResidual: number;
    }
  | { error: string; status: number }
> {
  const slots = Math.round(Number(params.slots));
  if (!Number.isFinite(slots) || slots < 1) {
    return { error: 'Enter a positive number of slots to purchase.', status: 400 };
  }
  if (slots > 100_000) {
    return { error: 'Slot quantity is too large.', status: 400 };
  }

  const select = { id: true, description: true } as const;
  const row =
    params.kind === 'team'
      ? await db.team.findUnique({ where: { id: params.id }, select })
      : await db.club.findUnique({ where: { id: params.id }, select });
  if (!row) {
    return { error: params.kind === 'team' ? 'Team not found' : 'Club not found', status: 404 };
  }

  const { total, unlimited, meta } = await resolveTotalAvailableSlots({
    description: row.description,
    viewerUserId: params.viewerUserId,
  });
  if (unlimited) {
    return {
      error: 'Your subscription already allows unlimited members; slot packs are not required.',
      status: 400,
    };
  }

  let quotaA = readMemberRenamesQuotaA(meta);
  if (quotaA === undefined) {
    quotaA = renameQuotaFromSlotCount(total ?? 0);
  }

  const renamesAddedToA = renameQuotaFromSlotCount(slots);
  const nextBase = (meta.membersPurchasedBase ?? 0) + slots;
  const nextA = quotaA + renamesAddedToA;
  const used = readMemberRenamesUsed(meta);
  const description = serializeMeta(meta, {
    membersPurchasedBase: nextBase,
    memberRenamesQuota: nextA,
  });

  if (params.kind === 'team') {
    await db.team.update({ where: { id: params.id }, data: { description } });
  } else {
    await db.club.update({ where: { id: params.id }, data: { description } });
  }

  return {
    ok: true,
    slotsAdded: slots,
    renamesAddedToA,
    membersPurchasedBase: nextBase,
    memberRenamesQuota: nextA,
    renameResidual: Math.max(0, nextA - used),
  };
}
