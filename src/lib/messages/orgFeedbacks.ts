import { prisma } from '@/lib/prisma';
import {
  createThreadWithFirstMessage,
  deleteMessageThread,
  excerptFromBody,
  getThreadForUser,
} from '@/lib/messages/userThreads';

/**
 * Feedbacks from club/team members to their club/team.
 * Members see their own threads; the owner and the staff see and answer every thread.
 */
export const ORG_FEEDBACK_CATEGORY = 'org_feedback';

export type OrgKind = 'club' | 'team';
export type OrgRole = 'admin' | 'staff' | 'member';
export type OrgFeedbackScope = 'mine' | 'manage';

export type FeedbackOrg = { kind: OrgKind; id: string; name: string; role: OrgRole };

export function orgFeedbackPath(kind: OrgKind, orgId: string): string {
  return `${kind}:${orgId}`;
}

export function parseOrgFeedbackPath(
  pathStaff: string | null | undefined,
): { kind: OrgKind; id: string } | null {
  const m = /^(club|team):(.+)$/.exec(pathStaff?.trim() || '');
  return m ? { kind: m[1] as OrgKind, id: m[2] } : null;
}

export async function getOrgAccess(
  userId: string,
  kind: OrgKind,
  orgId: string,
): Promise<{ isManager: boolean; isMember: boolean }> {
  if (kind === 'club') {
    const [owned, staff, member] = await Promise.all([
      prisma.club.findFirst({ where: { id: orgId, adminId: userId }, select: { id: true } }),
      prisma.clubStaff.findFirst({ where: { clubId: orgId, userId }, select: { id: true } }),
      prisma.clubMember.findFirst({ where: { clubId: orgId, memberId: userId }, select: { id: true } }),
    ]);
    return { isManager: Boolean(owned || staff), isMember: Boolean(member) };
  }
  const [owned, staff, member] = await Promise.all([
    prisma.team.findFirst({ where: { id: orgId, adminId: userId }, select: { id: true } }),
    prisma.teamStaff.findFirst({ where: { teamId: orgId, userId }, select: { id: true } }),
    prisma.teamMember.findFirst({ where: { teamId: orgId, athleteId: userId }, select: { id: true } }),
  ]);
  return { isManager: Boolean(owned || staff), isMember: Boolean(member) };
}

/** Clubs and teams of a user, with the user's role in each. */
export async function listFeedbackOrgs(userId: string): Promise<FeedbackOrg[]> {
  const [ownedClubs, clubStaff, clubMembers, ownedTeams, teamStaff, teamMembers] = await Promise.all([
    prisma.club.findMany({ where: { adminId: userId }, select: { id: true, name: true } }),
    prisma.clubStaff.findMany({ where: { userId }, select: { club: { select: { id: true, name: true } } } }),
    prisma.clubMember.findMany({ where: { memberId: userId }, select: { club: { select: { id: true, name: true } } } }),
    prisma.team.findMany({ where: { adminId: userId }, select: { id: true, name: true } }),
    prisma.teamStaff.findMany({ where: { userId }, select: { team: { select: { id: true, name: true } } } }),
    prisma.teamMember.findMany({ where: { athleteId: userId }, select: { team: { select: { id: true, name: true } } } }),
  ]);

  const map = new Map<string, FeedbackOrg>();
  const add = (kind: OrgKind, org: { id: string; name: string }, role: OrgRole) => {
    const key = orgFeedbackPath(kind, org.id);
    if (!map.has(key)) map.set(key, { kind, id: org.id, name: org.name, role });
  };
  ownedClubs.forEach((c) => add('club', c, 'admin'));
  clubStaff.forEach((s) => add('club', s.club, 'staff'));
  clubMembers.forEach((m) => add('club', m.club, 'member'));
  ownedTeams.forEach((t) => add('team', t, 'admin'));
  teamStaff.forEach((s) => add('team', s.team, 'staff'));
  teamMembers.forEach((m) => add('team', m.team, 'member'));
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

type PersonRow = {
  id: string;
  name: string | null;
  username: string | null;
  firstName?: string | null;
  surname?: string | null;
  image: string | null;
};

const personSelect = {
  id: true,
  name: true,
  username: true,
  firstName: true,
  surname: true,
  image: true,
} as const;

function toPersonDto(user: PersonRow | null | undefined) {
  if (!user) return null;
  const full = [user.firstName, user.surname].filter(Boolean).join(' ').trim();
  return {
    id: user.id,
    name: full || user.name || user.username || 'Member',
    username: user.username,
    image: user.image ?? null,
  };
}

export async function listOrgFeedbacks(params: {
  viewerId: string;
  scope: OrgFeedbackScope;
  /** `club:<id>` or `team:<id>`; empty = every club/team of the scope */
  orgKey?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, params.pageSize ?? 10));
  const orgs = await listFeedbackOrgs(params.viewerId);
  const scoped = orgs.filter((o) =>
    params.scope === 'manage' ? o.role !== 'member' : o.role === 'member',
  );
  const paths = scoped
    .map((o) => orgFeedbackPath(o.kind, o.id))
    .filter((p) => !params.orgKey || p === params.orgKey);
  const empty = { items: [], total: 0, page, pageSize, orgs: scoped, viewerId: params.viewerId };
  if (paths.length === 0) return empty;

  const where = {
    supportCategory: ORG_FEEDBACK_CATEGORY,
    pathStaff: { in: paths },
    ...(params.scope === 'mine' ? { userId: params.viewerId } : {}),
  };
  const [total, threads] = await Promise.all([
    prisma.userMessageThread.count({ where }),
    prisma.userMessageThread.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: personSelect },
        _count: { select: { messages: true } },
        messages: { orderBy: { createdAt: 'asc' }, select: { body: true, isStaff: true } },
      },
    }),
  ]);

  const orgNameByPath = new Map(scoped.map((o) => [orgFeedbackPath(o.kind, o.id), o.name]));
  const items = threads.map((th) => {
    const org = parseOrgFeedbackPath(th.pathStaff);
    const last = th.messages[th.messages.length - 1];
    return {
      id: th.id,
      title: th.subject?.trim() || 'Feedback',
      excerpt: th.messages[0] ? excerptFromBody(th.messages[0].body) : '',
      updatedAt: th.updatedAt.toISOString(),
      createdAt: th.createdAt.toISOString(),
      replyCount: Math.max(0, th._count.messages - 1),
      orgKind: org?.kind ?? null,
      orgId: org?.id ?? null,
      orgName: (th.pathStaff && orgNameByPath.get(th.pathStaff)) || '',
      author: toPersonDto(th.user),
      awaitingReply: Boolean(last && !last.isStaff),
      isCreator: th.userId === params.viewerId,
    };
  });
  return { items, total, page, pageSize, orgs: scoped, viewerId: params.viewerId };
}

export async function createOrgFeedback(params: {
  userId: string;
  kind: OrgKind;
  orgId: string;
  subject?: string;
  body: string;
}) {
  const access = await getOrgAccess(params.userId, params.kind, params.orgId);
  if (!access.isMember && !access.isManager) throw new Error('Forbidden');
  return createThreadWithFirstMessage({
    userId: params.userId,
    kind: 'SUPPORT',
    subject: params.subject?.trim() || 'Feedback',
    body: params.body,
    supportCategory: ORG_FEEDBACK_CATEGORY,
    pathStaff: orgFeedbackPath(params.kind, params.orgId),
  });
}

async function loadFeedbackThread(threadId: string) {
  const thread = await prisma.userMessageThread.findUnique({
    where: { id: threadId },
    select: { id: true, userId: true, pathStaff: true, supportCategory: true },
  });
  if (!thread || thread.supportCategory !== ORG_FEEDBACK_CATEGORY) return null;
  const org = parseOrgFeedbackPath(thread.pathStaff);
  return org ? { ...thread, org } : null;
}

/** creator = the member who wrote it; manager = owner/staff of the club or team. */
async function resolveFeedbackRole(
  thread: { userId: string; org: { kind: OrgKind; id: string } },
  viewerId: string,
): Promise<'creator' | 'manager' | null> {
  const access = await getOrgAccess(viewerId, thread.org.kind, thread.org.id);
  if (access.isManager) return 'manager';
  if (thread.userId === viewerId) return 'creator';
  return null;
}

export function isOrgFeedbackCategory(category: string | null | undefined): boolean {
  return category === ORG_FEEDBACK_CATEGORY;
}

export async function getOrgFeedbackThread(threadId: string, viewerId: string) {
  const thread = await loadFeedbackThread(threadId);
  if (!thread) return null;
  const role = await resolveFeedbackRole(thread, viewerId);
  if (!role) return null;
  const detail = await getThreadForUser(threadId, viewerId, false, { allowClubMessage: true });
  if (!detail) return null;
  return {
    ...detail,
    orgKind: thread.org.kind,
    orgId: thread.org.id,
    viewerId,
    role,
    canReply: true,
    canDelete: true,
  };
}

/** Reply allowed for the author and the club/team owner and staff; staff replies are flagged. */
export async function resolveOrgFeedbackReply(
  threadId: string,
  viewerId: string,
): Promise<{ ok: boolean; asStaff: boolean }> {
  const thread = await loadFeedbackThread(threadId);
  if (!thread) return { ok: false, asStaff: false };
  const role = await resolveFeedbackRole(thread, viewerId);
  return { ok: role !== null, asStaff: role === 'manager' };
}

export async function deleteOrgFeedback(threadId: string, viewerId: string): Promise<boolean> {
  const thread = await loadFeedbackThread(threadId);
  if (!thread) return false;
  if (!(await resolveFeedbackRole(thread, viewerId))) return false;
  return deleteMessageThread(threadId);
}

/** Counts for the sidebar: own threads (member) and threads waiting for an answer (manager). */
export async function countOrgFeedbacks(viewerId: string): Promise<{ mine: number; awaiting: number }> {
  const orgs = await listFeedbackOrgs(viewerId);
  const managedPaths = orgs.filter((o) => o.role !== 'member').map((o) => orgFeedbackPath(o.kind, o.id));
  const [mine, managed] = await Promise.all([
    prisma.userMessageThread.count({
      where: { supportCategory: ORG_FEEDBACK_CATEGORY, userId: viewerId },
    }),
    managedPaths.length
      ? prisma.userMessageThread.findMany({
          where: { supportCategory: ORG_FEEDBACK_CATEGORY, pathStaff: { in: managedPaths } },
          select: { messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { isStaff: true } } },
        })
      : Promise.resolve([] as Array<{ messages: { isStaff: boolean }[] }>),
  ]);
  const awaiting = managed.filter((t) => t.messages[0] && !t.messages[0].isStaff).length;
  return { mine, awaiting };
}
