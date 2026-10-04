import { randomUUID } from 'crypto';
import { prisma, prismaConnect } from '@/lib/prisma';

/**
 * Saved member groups and favourites of a team workspace. Club workspaces use the Prisma
 * tables `club_member_groups` / `club_member_favorites`, whose foreign key only accepts clubs.
 */
const GROUPS = 'team_member_groups';
const GROUP_MEMBERS = 'team_member_group_members';
const FAVOURITES = 'team_member_favorites';

let tablesReady: Promise<void> | null = null;

function ensureTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      await prismaConnect();
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`${GROUPS}\` (
          id VARCHAR(191) NOT NULL,
          team_id VARCHAR(191) NOT NULL,
          name VARCHAR(191) NOT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          KEY team_member_groups_team_id_idx (team_id)
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`${GROUP_MEMBERS}\` (
          group_id VARCHAR(191) NOT NULL,
          member_id VARCHAR(191) NOT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (group_id, member_id),
          KEY team_member_group_members_member_id_idx (member_id)
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`${FAVOURITES}\` (
          team_id VARCHAR(191) NOT NULL,
          member_id VARCHAR(191) NOT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (team_id, member_id),
          KEY team_member_favorites_member_id_idx (member_id)
        )
      `);
    })().catch((e) => {
      tablesReady = null;
      throw e;
    });
  }
  return tablesReady;
}

/** Keeps only ids of athletes currently on the team. */
export async function validateTeamMemberIds(teamId: string, memberIds: string[]): Promise<string[]> {
  const unique = [...new Set(memberIds.filter(Boolean))];
  if (unique.length === 0) return [];
  const rows = await prisma.teamMember.findMany({
    where: { teamId, athleteId: { in: unique } },
    select: { athleteId: true },
  });
  return rows.map((r) => r.athleteId);
}

export async function createTeamMemberGroup(teamId: string, name: string, memberIds: string[]) {
  await ensureTables();
  const id = randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `INSERT INTO \`${GROUPS}\` (id, team_id, name) VALUES (?, ?, ?)`,
      id,
      teamId,
      name,
    );
    for (const memberId of memberIds) {
      await tx.$executeRawUnsafe(
        `INSERT IGNORE INTO \`${GROUP_MEMBERS}\` (group_id, member_id) VALUES (?, ?)`,
        id,
        memberId,
      );
    }
  });
  return { id, name, memberCount: memberIds.length, createdAt: new Date() };
}

export async function listTeamMemberGroups(teamId: string) {
  await ensureTables();
  const [rows, links, athletes] = await Promise.all([
    prisma.$queryRawUnsafe<{ id: string; name: string; created_at: Date }[]>(
      `SELECT id, name, created_at FROM \`${GROUPS}\` WHERE team_id = ? ORDER BY created_at DESC`,
      teamId,
    ),
    prisma.$queryRawUnsafe<{ group_id: string; member_id: string }[]>(
      `SELECT m.group_id, m.member_id FROM \`${GROUP_MEMBERS}\` m
       INNER JOIN \`${GROUPS}\` g ON g.id = m.group_id
       WHERE g.team_id = ?`,
      teamId,
    ),
    prisma.teamMember.findMany({ where: { teamId }, select: { athleteId: true } }),
  ]);
  // Count only athletes still on the team, matching what opening the group lists.
  const onTeam = new Set(athletes.map((a) => a.athleteId));
  const counts = new Map<string, number>();
  for (const link of links) {
    if (onTeam.has(String(link.member_id))) {
      counts.set(String(link.group_id), (counts.get(String(link.group_id)) ?? 0) + 1);
    }
  }
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    memberCount: counts.get(String(r.id)) ?? 0,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function getTeamMemberGroup(teamId: string, groupId: string) {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<{ id: string; name: string; created_at: Date }[]>(
    `SELECT id, name, created_at FROM \`${GROUPS}\` WHERE id = ? AND team_id = ? LIMIT 1`,
    groupId,
    teamId,
  );
  const group = rows[0];
  if (!group) return null;
  return {
    id: String(group.id),
    name: String(group.name),
    memberIds: await listTeamMemberGroupMemberIds(teamId, groupId),
    createdAt: new Date(group.created_at).toISOString(),
  };
}

export async function listTeamMemberGroupMemberIds(teamId: string, groupId: string): Promise<string[]> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<{ member_id: string }[]>(
    `SELECT m.member_id FROM \`${GROUP_MEMBERS}\` m
     INNER JOIN \`${GROUPS}\` g ON g.id = m.group_id
     WHERE m.group_id = ? AND g.team_id = ?
     ORDER BY m.created_at ASC`,
    groupId,
    teamId,
  );
  return rows.map((r) => String(r.member_id));
}

export async function renameTeamMemberGroup(teamId: string, groupId: string, name: string) {
  await ensureTables();
  const changed = await prisma.$executeRawUnsafe(
    `UPDATE \`${GROUPS}\` SET name = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ? AND team_id = ?`,
    name,
    groupId,
    teamId,
  );
  if (changed === 0 && !(await getTeamMemberGroup(teamId, groupId))) return null;
  return { id: groupId, name };
}

export async function deleteTeamMemberGroup(teamId: string, groupId: string): Promise<boolean> {
  await ensureTables();
  return prisma.$transaction(async (tx) => {
    const deleted = await tx.$executeRawUnsafe(
      `DELETE FROM \`${GROUPS}\` WHERE id = ? AND team_id = ?`,
      groupId,
      teamId,
    );
    if (deleted === 0) return false;
    await tx.$executeRawUnsafe(`DELETE FROM \`${GROUP_MEMBERS}\` WHERE group_id = ?`, groupId);
    return true;
  });
}

export async function addTeamMemberFavourites(teamId: string, memberIds: string[]): Promise<void> {
  await ensureTables();
  for (const memberId of memberIds) {
    await prisma.$executeRawUnsafe(
      `INSERT IGNORE INTO \`${FAVOURITES}\` (team_id, member_id) VALUES (?, ?)`,
      teamId,
      memberId,
    );
  }
}

export async function removeTeamMemberFavourites(teamId: string, memberIds: string[]): Promise<number> {
  await ensureTables();
  if (memberIds.length === 0) return 0;
  return prisma.$executeRawUnsafe(
    `DELETE FROM \`${FAVOURITES}\` WHERE team_id = ? AND member_id IN (${memberIds.map(() => '?').join(', ')})`,
    teamId,
    ...memberIds,
  );
}

export async function listTeamMemberFavouriteIds(teamId: string): Promise<string[]> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<{ member_id: string }[]>(
    `SELECT member_id FROM \`${FAVOURITES}\` WHERE team_id = ? ORDER BY created_at DESC`,
    teamId,
  );
  return rows.map((r) => String(r.member_id));
}
