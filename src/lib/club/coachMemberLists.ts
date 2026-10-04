import { prisma, prismaConnect } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';

/**
 * Coach workspace of Archive of Users.
 * Athletes trained = `coach_athletes` rows of the coach plus members of the coach's groups trained.
 * Groups (and the Group of training filter) are the coach's groups trained (`coaching_groups`).
 * Favourites live in `coach_member_favorites` (raw SQL, created on first use).
 */
const FAVOURITES = 'coach_member_favorites';

let favouritesReady: Promise<void> | null = null;

function ensureFavouritesTable(): Promise<void> {
  if (!favouritesReady) {
    favouritesReady = (async () => {
      await prismaConnect();
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`${FAVOURITES}\` (
          coach_id VARCHAR(191) NOT NULL,
          member_id VARCHAR(191) NOT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (coach_id, member_id),
          KEY coach_member_favorites_member_id_idx (member_id)
        )
      `);
    })().catch((e) => {
      favouritesReady = null;
      throw e;
    });
  }
  return favouritesReady;
}

export type CoachAthleteLink = {
  athleteId: string;
  /** Earliest date the athlete was linked to the coach (direct or via a group). */
  joinedAt: Date;
  groupIds: string[];
};

/** Athletes trained by the coach, with the groups trained each one belongs to. */
export async function listCoachAthleteLinks(coachId: string): Promise<CoachAthleteLink[]> {
  const [direct, groupMembers] = await Promise.all([
    prisma.coachAthlete.findMany({
      where: { coachId },
      select: { athleteId: true, createdAt: true },
    }),
    prisma.coachingGroupMember.findMany({
      where: { coachingGroup: { coachId } },
      select: { athleteId: true, coachingGroupId: true, joinedAt: true },
    }),
  ]);
  const byAthlete = new Map<string, CoachAthleteLink>();
  const link = (athleteId: string, at: Date, groupId?: string) => {
    const existing = byAthlete.get(athleteId);
    if (!existing) {
      byAthlete.set(athleteId, { athleteId, joinedAt: at, groupIds: groupId ? [groupId] : [] });
      return;
    }
    if (at < existing.joinedAt) existing.joinedAt = at;
    if (groupId && !existing.groupIds.includes(groupId)) existing.groupIds.push(groupId);
  };
  for (const row of direct) link(row.athleteId, row.createdAt);
  for (const row of groupMembers) link(row.athleteId, row.joinedAt, row.coachingGroupId);
  return [...byAthlete.values()].sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime());
}

export async function isCoachAthlete(coachId: string, athleteId: string): Promise<boolean> {
  const [direct, viaGroup] = await Promise.all([
    prisma.coachAthlete.count({ where: { coachId, athleteId } }),
    prisma.coachingGroupMember.count({ where: { athleteId, coachingGroup: { coachId } } }),
  ]);
  return direct + viaGroup > 0;
}

/** Keeps only ids of athletes trained by the coach. */
export async function validateCoachAthleteIds(coachId: string, memberIds: string[]): Promise<string[]> {
  const unique = [...new Set(memberIds.filter(Boolean))];
  if (unique.length === 0) return [];
  const trained = new Set((await listCoachAthleteLinks(coachId)).map((l) => l.athleteId));
  return unique.filter((id) => trained.has(id));
}

export async function createCoachGroup(coachId: string, name: string, memberIds: string[]) {
  const group = await prisma.coachingGroup.create({
    data: {
      coachId,
      name,
      members: { create: memberIds.map((athleteId) => ({ athleteId })) },
    },
    select: { id: true, name: true, createdAt: true },
  });
  return { ...group, memberCount: memberIds.length };
}

export async function listCoachGroups(coachId: string) {
  const groups = await prisma.coachingGroup.findMany({
    where: { coachId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, createdAt: true, _count: { select: { members: true } } },
  });
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    memberCount: g._count.members,
    createdAt: g.createdAt.toISOString(),
  }));
}

export async function listCoachGroupMemberIds(coachId: string, groupId: string): Promise<string[]> {
  const rows = await prisma.coachingGroupMember.findMany({
    where: { coachingGroupId: groupId, coachingGroup: { coachId } },
    select: { athleteId: true },
    orderBy: { joinedAt: 'asc' },
  });
  return rows.map((r) => r.athleteId);
}

export async function getCoachGroup(coachId: string, groupId: string) {
  const group = await prisma.coachingGroup.findFirst({
    where: { id: groupId, coachId },
    select: { id: true, name: true, createdAt: true },
  });
  if (!group) return null;
  return {
    id: group.id,
    name: group.name,
    memberIds: await listCoachGroupMemberIds(coachId, groupId),
    createdAt: group.createdAt.toISOString(),
  };
}

export async function renameCoachGroup(coachId: string, groupId: string, name: string) {
  const changed = await prisma.coachingGroup.updateMany({
    where: { id: groupId, coachId },
    data: { name },
  });
  return changed.count > 0 ? { id: groupId, name } : null;
}

export async function deleteCoachGroup(coachId: string, groupId: string): Promise<boolean> {
  const deleted = await prisma.coachingGroup.deleteMany({ where: { id: groupId, coachId } });
  return deleted.count > 0;
}

export async function addCoachFavourites(coachId: string, memberIds: string[]): Promise<void> {
  await ensureFavouritesTable();
  for (const memberId of memberIds) {
    await prisma.$executeRawUnsafe(
      `INSERT IGNORE INTO \`${FAVOURITES}\` (coach_id, member_id) VALUES (?, ?)`,
      coachId,
      memberId,
    );
  }
}

export async function removeCoachFavourites(coachId: string, memberIds: string[]): Promise<number> {
  await ensureFavouritesTable();
  if (memberIds.length === 0) return 0;
  return prisma.$executeRawUnsafe(
    `DELETE FROM \`${FAVOURITES}\` WHERE coach_id = ? AND member_id IN (${memberIds.map(() => '?').join(', ')})`,
    coachId,
    ...memberIds,
  );
}

export async function listCoachFavouriteIds(coachId: string): Promise<string[]> {
  await ensureFavouritesTable();
  const rows = await prisma.$queryRawUnsafe<{ member_id: string }[]>(
    `SELECT member_id FROM \`${FAVOURITES}\` WHERE coach_id = ? ORDER BY created_at DESC`,
    coachId,
  );
  return rows.map((r) => String(r.member_id));
}

/**
 * Archive → Add a member for a coach: the athlete confirms with their own password,
 * like club/team insertion, and becomes an athlete trained (`coach_athletes`).
 */
export async function addCoachAthleteByCredentials(
  coachId: string,
  username: string,
  password: string,
): Promise<{ ok: true; athleteId: string } | { error: string; status: number }> {
  const athlete = await prisma.user.findUnique({
    where: { username },
    select: { id: true, password: true, userType: true },
  });
  if (!athlete) return { error: 'User not found', status: 404 };
  if (athlete.id === coachId) return { error: 'You cannot add yourself', status: 400 };
  if (athlete.userType !== 'ATHLETE' && athlete.userType !== 'COACH') {
    return { error: 'Only Single Users and Coaches can be added', status: 400 };
  }
  if (!(await verifyPassword(password, athlete.password))) {
    return { error: 'Invalid password', status: 401 };
  }
  const existing = await prisma.coachAthlete.findUnique({
    where: { coachId_athleteId: { coachId, athleteId: athlete.id } },
    select: { id: true },
  });
  if (existing) return { error: 'This athlete is already trained by you', status: 400 };
  await prisma.coachAthlete.create({ data: { coachId, athleteId: athlete.id } });
  return { ok: true, athleteId: athlete.id };
}

/** Stops training an athlete: removes the direct link and the coach's group memberships. */
export async function removeCoachAthlete(coachId: string, athleteId: string): Promise<boolean> {
  const removed = await prisma.$transaction(async (tx) => {
    const direct = await tx.coachAthlete.deleteMany({ where: { coachId, athleteId } });
    const viaGroups = await tx.coachingGroupMember.deleteMany({
      where: { athleteId, coachingGroup: { coachId } },
    });
    return direct.count + viaGroups.count;
  });
  if (removed === 0) return false;
  await removeCoachFavourites(coachId, [athleteId]);
  return true;
}
