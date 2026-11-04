import { prisma } from '@/lib/prisma';
import {
  CREATE_DEADLINES_PAYMENT_STATUS,
  emptyMemberSettingsDeadlines,
  MEMBER_SETTINGS_INSTALLMENT_KEYS,
  normalizeMemberSettingsDeadlines,
  type MemberSettingsInstallmentKey,
} from '@/lib/club/memberProfileTypes';

/** Installment descriptions written in the archive for the member Settings payments. */
export const MEMBER_SETTINGS_INSTALLMENT_LABELS: Record<MemberSettingsInstallmentKey, string> = {
  firstPayment: 'First payment',
  secondPayment: 'Second payment',
  thirdPayment: 'Third payment',
};

export const MEMBER_SETTINGS_RECORD_SOURCE = 'member-settings';

export function memberSettingsKeyForLabel(
  description: string | null | undefined,
): MemberSettingsInstallmentKey | null {
  return (
    MEMBER_SETTINGS_INSTALLMENT_KEYS.find(
      (key) => MEMBER_SETTINGS_INSTALLMENT_LABELS[key] === String(description ?? '').trim(),
    ) ?? null
  );
}

type ProfileRow = {
  table: 'club_member_profiles' | 'team_member_profiles';
  keyColumn: 'clubMemberId' | 'teamMemberId';
  keyValue: string;
  profileJson: string;
};

/** `clubId` is the club id, or the team id for Team workspace records. */
async function findProfileRow(clubId: string, memberUserId: string): Promise<ProfileRow | null> {
  const clubMember = await prisma.clubMember.findUnique({
    where: { clubId_memberId: { clubId, memberId: memberUserId } },
    select: { id: true },
  });
  if (clubMember) {
    const rows = await prisma.$queryRawUnsafe<{ profileJson: string }[]>(
      'SELECT profileJson FROM club_member_profiles WHERE clubMemberId = ? LIMIT 1',
      clubMember.id,
    );
    return rows[0]
      ? { table: 'club_member_profiles', keyColumn: 'clubMemberId', keyValue: clubMember.id, profileJson: rows[0].profileJson }
      : null;
  }
  const teamMember = await prisma.teamMember.findUnique({
    where: { teamId_athleteId: { teamId: clubId, athleteId: memberUserId } },
    select: { id: true },
  });
  if (!teamMember) return null;
  const rows = await prisma.$queryRawUnsafe<{ profileJson: string }[]>(
    'SELECT profileJson FROM team_member_profiles WHERE teamMemberId = ? LIMIT 1',
    teamMember.id,
  ).catch(() => []);
  return rows[0]
    ? { table: 'team_member_profiles', keyColumn: 'teamMemberId', keyValue: teamMember.id, profileJson: rows[0].profileJson }
    : null;
}

/**
 * Keeps the member Settings in step with deletions made in the archive, so the next Settings save
 * does not file again what the operator removed.
 * With `key`: that deadline was deleted — its amount is cleared and its row unlocks.
 * Without `key`: the whole record was deleted — the link, the Paid tick and "Create deadlines" are reset.
 */
export async function forgetMemberSettingsDeadlines(opts: {
  clubId: string;
  memberUserId: string;
  recordId: string;
  key?: MemberSettingsInstallmentKey;
}): Promise<void> {
  await updateLinkedSettings(opts, (football, deadlines) => {
    const key = opts.key;
    if (key) {
      deadlines.generated = deadlines.generated.filter((k) => k !== key);
      deadlines.paidKeys = deadlines.paidKeys.filter((k) => k !== key);
      deadlines.firstPaidRecorded = deadlines.paidKeys.includes('firstPayment');
      football[key] = { ...(football[key] ?? {}), amount: '', status: '' };
      football.deadlines =
        deadlines.generated.length > 0 ? deadlines : emptyMemberSettingsDeadlines();
    } else {
      football.deadlines = emptyMemberSettingsDeadlines();
      for (const installmentKey of MEMBER_SETTINGS_INSTALLMENT_KEYS) {
        football[installmentKey] = { ...(football[installmentKey] ?? {}), status: '' };
      }
      if (football.paymentStatus === CREATE_DEADLINES_PAYMENT_STATUS) football.paymentStatus = 'Pending';
    }
  });
}

/**
 * A Settings-linked payment was deleted in the Archive of Payments: untick Paid for that
 * installment so it can be recorded again. Defaults to first payment when `key` is omitted.
 */
export async function forgetMemberSettingsFirstPaid(opts: {
  clubId: string;
  memberUserId: string;
  recordId: string;
  key?: MemberSettingsInstallmentKey;
}): Promise<void> {
  const key = opts.key ?? 'firstPayment';
  await updateLinkedSettings(opts, (football, deadlines) => {
    football[key] = { ...(football[key] ?? {}), status: '' };
    const paidKeys = deadlines.paidKeys.filter((k) => k !== key);
    football.deadlines = {
      ...deadlines,
      paidKeys,
      firstPaidRecorded: paidKeys.includes('firstPayment'),
    };
  });
}

/** Applies `mutate` only when the member's Settings still point at `recordId`. */
async function updateLinkedSettings(
  opts: { clubId: string; memberUserId: string; recordId: string },
  mutate: (football: Record<string, any>, deadlines: ReturnType<typeof normalizeMemberSettingsDeadlines>) => void,
): Promise<void> {
  const row = await findProfileRow(opts.clubId, opts.memberUserId);
  if (!row) return;
  let json: Record<string, any>;
  try {
    json = JSON.parse(row.profileJson || '{}');
  } catch {
    return;
  }
  const football = json?.settings?.football;
  if (!football || typeof football !== 'object') return;
  const deadlines = normalizeMemberSettingsDeadlines(football.deadlines);
  if (deadlines.recordId !== opts.recordId) return;

  mutate(football, deadlines);

  await prisma.$executeRawUnsafe(
    `UPDATE \`${row.table}\` SET profileJson = ?, updatedAt = ? WHERE \`${row.keyColumn}\` = ?`,
    JSON.stringify(json),
    new Date(),
    row.keyValue,
  );
}
