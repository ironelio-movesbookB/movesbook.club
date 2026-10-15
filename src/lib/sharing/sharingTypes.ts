import type { CreatableCompaniesQuota } from '@/lib/club/creatableCompaniesQuota.shared';

/** Who can share: single users and companies (club, team, group, coach group trained). */
export type SharePartyKind = 'user' | 'club' | 'team' | 'group' | 'coach';

export const SHARE_PARTY_KINDS: SharePartyKind[] = ['user', 'club', 'coach', 'team', 'group'];

export function isSharePartyKind(value: unknown): value is SharePartyKind {
  return typeof value === 'string' && (SHARE_PARTY_KINDS as string[]).includes(value);
}

/** Communities sidebar list for each recipient kind. */
export const SHARE_LIST_LABELS: Record<SharePartyKind, string> = {
  user: 'Sharing friends',
  club: 'My Clubs',
  coach: 'My Coaches',
  team: 'My teams',
  group: 'My Groups',
};

export const SHARE_PARTY_KIND_LABELS: Record<SharePartyKind, string> = {
  user: 'Single user',
  club: 'Club',
  coach: 'Coach group',
  team: 'Team',
  group: 'Group',
};

export type ShareSection = { key: string; label: string };

export const COMPANY_SHARE_SECTIONS: ShareSection[] = [
  { key: 'info', label: 'Info' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'social', label: 'Section Social' },
  { key: 'training', label: 'Section Training' },
  { key: 'body_analysis', label: 'Section Body Analysis' },
  { key: 'nutrition', label: 'Section Nutrition' },
  { key: 'management', label: 'Section Management' },
  { key: 'friends', label: 'Friends' },
  { key: 'communities', label: 'Communities' },
];

export const USER_SHARE_SECTIONS: ShareSection[] = [
  { key: 'info', label: 'Profile' },
  { key: 'social', label: 'Section Social' },
  { key: 'training', label: 'Section Training' },
  { key: 'body_analysis', label: 'Section Body Analysis' },
  { key: 'nutrition', label: 'Section Nutrition' },
  { key: 'friends', label: 'Friends' },
];

export function shareSectionsForKind(kind: SharePartyKind): ShareSection[] {
  return kind === 'user' ? USER_SHARE_SECTIONS : COMPANY_SHARE_SECTIONS;
}

export function sanitizeShareSections(kind: SharePartyKind, sections: unknown): string[] {
  const allowed = new Set(shareSectionsForKind(kind).map((s) => s.key));
  if (!Array.isArray(sections)) return [];
  return Array.from(new Set(sections.filter((s): s is string => typeof s === 'string' && allowed.has(s))));
}

/** Single users share only with companies; companies share with users and companies. */
export function isAllowedSharePair(sender: SharePartyKind, recipient: SharePartyKind): boolean {
  return !(sender === 'user' && recipient === 'user');
}

export type ShareParty = {
  kind: SharePartyKind;
  id: string;
  name: string;
  logo: string | null;
};

export type ShareStatus = 'pending' | 'accepted' | 'rejected' | 'removed';
export type ShareSide = 'sender' | 'recipient';

export type ShareRequestView = {
  id: string;
  status: ShareStatus;
  createdAt: string;
  respondedAt: string | null;
  removedAt: string | null;
  removedBy: ShareSide | null;
  sender: ShareParty;
  recipient: ShareParty;
  senderSections: string[];
  recipientSections: string[];
  viewerSide: ShareSide;
};

export type ShareLimit = {
  limit: number;
  used: number;
  /** null = unlimited */
  available: number | null;
};

export type SharedEntry = {
  shareId: string;
  party: ShareParty;
  viewerSide: ShareSide;
};

export type SharingSummary = {
  self: ShareParty;
  /** Companies the viewer administers (shown in the "share as" picker). */
  companies: ShareParty[];
  /** Company admins must share as one of their companies; single users share as themselves. */
  isCompanyAdmin: boolean;
  limits: Record<SharePartyKind, ShareLimit>;
  shared: Record<SharePartyKind, SharedEntry[]>;
  companyQuota: CreatableCompaniesQuota | null;
};

export type ShareSearchRow = ShareParty & { subtitle: string };

export const SHARING_CHANGED_EVENT = 'movesbook:sharing-changed';

export function notifySharingChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SHARING_CHANGED_EVENT));
}

export function formatShareAvailable(limit: ShareLimit | undefined): string {
  if (!limit) return '0 available';
  return limit.available == null ? 'Unlimited available' : `${limit.available} available`;
}
