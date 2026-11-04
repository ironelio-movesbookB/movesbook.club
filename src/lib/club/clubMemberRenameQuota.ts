import type { ClubDescriptionMeta } from '@/lib/club/clubSidebarLabel';

/** Public shape attached to member profile bundles (A/B stay server-side). */
export type MemberRenameQuotaPublic = {
  residual: number | null;
  canRename: boolean;
  unlimited: boolean;
};

export const UNRESTRICTED_RENAME_QUOTA: MemberRenameQuotaPublic = {
  residual: null,
  canRename: true,
  unlimited: true,
};

export type MemberRenameQuotaStats = {
  /** A — renamings allowed (stored; grows by 10% of each slot purchase). */
  quota: number | null;
  /** B — renamings already performed. */
  used: number;
  /** A − B (null when unlimited). */
  residual: number | null;
  canRename: boolean;
  unlimited: boolean;
};

/** 10% of slots (floor) — used for initial A and for each purchase pack. */
export function renameQuotaFromSlotCount(slotCount: number): number {
  return Math.max(0, Math.floor(Math.max(0, slotCount) * 0.1));
}

/** @deprecated Use renameQuotaFromSlotCount */
export const renameQuotaFromTotalSlots = renameQuotaFromSlotCount;

/**
 * Residual renamings from stored A and B.
 * Pass `quotaA: null` for unlimited plans.
 */
export function computeMemberRenameQuota(params: {
  /** A — stored rename allowance; null = unlimited. */
  quotaA: number | null;
  /** B — renames already performed. */
  renamesUsed: number;
}): MemberRenameQuotaStats {
  const used = Math.max(0, Math.round(params.renamesUsed) || 0);
  if (params.quotaA == null) {
    return {
      quota: null,
      used,
      residual: null,
      canRename: true,
      unlimited: true,
    };
  }
  const quota = Math.max(0, Math.round(params.quotaA));
  const residual = Math.max(0, quota - used);
  return {
    quota,
    used,
    residual,
    canRename: residual > 0,
    unlimited: false,
  };
}

export function readMemberRenamesUsed(meta: ClubDescriptionMeta): number {
  const raw = meta.memberRenamesUsed;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return Math.round(raw);
  }
  return 0;
}

/** Read stored A; `undefined` means not bootstrapped yet. */
export function readMemberRenamesQuotaA(meta: ClubDescriptionMeta): number | undefined {
  const raw = meta.memberRenamesQuota;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return Math.round(raw);
  }
  return undefined;
}

export function namesDifferForRename(
  before: { firstName?: string | null; lastName?: string | null },
  after: { firstName?: string | null; lastName?: string | null },
): boolean {
  const norm = (v: string | null | undefined) => String(v ?? '').trim();
  return (
    norm(before.firstName) !== norm(after.firstName) ||
    norm(before.lastName) !== norm(after.lastName)
  );
}

/** Capacity/profile helper: use stored A, or bootstrap formula when A not yet persisted. */
export function renameQuotaStatsFromMeta(
  meta: ClubDescriptionMeta,
  totalAvailableSlots: number | null,
  unlimited: boolean,
): MemberRenameQuotaStats {
  if (unlimited) {
    return computeMemberRenameQuota({
      quotaA: null,
      renamesUsed: readMemberRenamesUsed(meta),
    });
  }
  const storedA = readMemberRenamesQuotaA(meta);
  const quotaA =
    storedA !== undefined ? storedA : renameQuotaFromSlotCount(totalAvailableSlots ?? 0);
  return computeMemberRenameQuota({
    quotaA,
    renamesUsed: readMemberRenamesUsed(meta),
  });
}
