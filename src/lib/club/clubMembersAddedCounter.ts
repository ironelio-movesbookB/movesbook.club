import type { PrismaClient } from '@prisma/client';
import {
  parseClubDescriptionMeta,
  type ClubDescriptionMeta,
} from '@/lib/club/clubSidebarLabel';

type Db = Pick<PrismaClient, 'club' | 'team' | 'clubMember' | 'teamMember'>;

function serializeMeta(prev: ClubDescriptionMeta, patch: Partial<ClubDescriptionMeta>): string {
  return JSON.stringify({ ...prev, ...patch });
}

/** Resolve progressive Members added; bootstrap from live count when unset. */
export function resolveMembersAddedLifetime(
  meta: ClubDescriptionMeta,
  currentMembers: number,
): { count: number; needsPersist: boolean } {
  const live = Math.max(0, Math.round(currentMembers));
  const raw = meta.membersAddedLifetime;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    const stored = Math.round(raw);
    // Self-heal if members were added outside the increment path.
    const count = Math.max(stored, live);
    return { count, needsPersist: count !== stored };
  }
  return { count: live, needsPersist: true };
}

export async function ensureMembersAddedLifetime(
  db: Db,
  params: { kind: 'club' | 'team'; id: string; currentMembers: number },
): Promise<number> {
  const select = { id: true, description: true } as const;
  const row =
    params.kind === 'team'
      ? await db.team.findUnique({ where: { id: params.id }, select })
      : await db.club.findUnique({ where: { id: params.id }, select });
  if (!row) return Math.max(0, params.currentMembers);

  const meta = parseClubDescriptionMeta(row.description);
  const { count, needsPersist } = resolveMembersAddedLifetime(meta, params.currentMembers);
  if (!needsPersist) return count;

  const description = serializeMeta(meta, { membersAddedLifetime: count });
  if (params.kind === 'team') {
    await db.team.update({ where: { id: params.id }, data: { description } });
  } else {
    await db.club.update({ where: { id: params.id }, data: { description } });
  }
  return count;
}

/** Call after a successful new membership row is created. */
export async function incrementMembersAddedLifetime(
  db: Db,
  params: { kind: 'club' | 'team'; id: string },
): Promise<number> {
  const select = { id: true, description: true } as const;
  const row =
    params.kind === 'team'
      ? await db.team.findUnique({ where: { id: params.id }, select })
      : await db.club.findUnique({ where: { id: params.id }, select });
  if (!row) return 0;

  const liveCount =
    params.kind === 'team'
      ? await db.teamMember.count({ where: { teamId: params.id } })
      : await db.clubMember.count({ where: { clubId: params.id } });

  const meta = parseClubDescriptionMeta(row.description);
  const beforeLive = Math.max(0, liveCount - 1);
  const baseline = resolveMembersAddedLifetime(meta, beforeLive).count;
  const next = baseline + 1;
  const description = serializeMeta(meta, { membersAddedLifetime: next });

  if (params.kind === 'team') {
    await db.team.update({ where: { id: params.id }, data: { description } });
  } else {
    await db.club.update({ where: { id: params.id }, data: { description } });
  }
  return next;
}
