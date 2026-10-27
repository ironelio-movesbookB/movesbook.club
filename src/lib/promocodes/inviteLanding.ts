import { coercePublicOrigin } from '@/lib/siteUrl';

export type InviteSectionKey = 'intro' | 'body' | 'doc' | 'links';

export const DEFAULT_INVITE_SECTIONS: Record<InviteSectionKey, boolean> = {
  intro: true,
  body: true,
  doc: true,
  links: true,
};

/** Body of the invite is always included. */
export function normalizeInviteSections(
  input?: Partial<Record<InviteSectionKey, boolean>> | null,
): Record<InviteSectionKey, boolean> {
  return {
    intro: input?.intro !== false,
    body: true,
    doc: input?.doc !== false,
    links: input?.links !== false,
  };
}

export function encodeInviteSections(sections: Record<InviteSectionKey, boolean>): string {
  const normalized = normalizeInviteSections(sections);
  return (['intro', 'doc', 'links'] as const)
    .filter((key) => normalized[key])
    .join(',');
}

export function parseInviteSections(raw: string | null | undefined): Record<InviteSectionKey, boolean> {
  if (raw == null || raw.trim() === '') return { ...DEFAULT_INVITE_SECTIONS };
  const parts = new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return {
    intro: parts.has('intro'),
    body: true,
    doc: parts.has('doc'),
    links: parts.has('links'),
  };
}

export function buildInviteLandingUrl(
  origin: string,
  input: {
    promocode: string;
    inviter?: string | null;
    lang?: string | null;
    inviteByMovesbook?: boolean;
    sections?: Partial<Record<InviteSectionKey, boolean>> | null;
    userEmail?: string | null;
  },
): string {
  const publicOrigin = coercePublicOrigin(origin);
  const params = new URLSearchParams();
  if (input.promocode.trim()) params.set('promocode', input.promocode.trim());
  if (input.inviteByMovesbook) params.set('invite_by', 'movesbook');
  else if (input.inviter?.trim()) params.set('inviter', input.inviter.trim());
  if (input.lang?.trim()) params.set('lang', input.lang.trim());
  if (input.userEmail?.trim()) params.set('user_email', input.userEmail.trim());
  const sections = encodeInviteSections(normalizeInviteSections(input.sections));
  if (sections) params.set('sections', sections);
  return `${publicOrigin}/invite?${params.toString()}`;
}

export function buildQuickRegisterUrlFromInvite(
  origin: string,
  input: {
    promocode: string;
    inviter?: string | null;
    lang?: string | null;
    inviteByMovesbook?: boolean;
    userEmail?: string | null;
  },
): string {
  const publicOrigin = coercePublicOrigin(origin);
  const params = new URLSearchParams();
  if (input.promocode.trim()) params.set('promocode', input.promocode.trim());
  if (input.inviteByMovesbook) params.set('invite_by', 'movesbook');
  else if (input.inviter?.trim()) params.set('inviter', input.inviter.trim());
  if (input.lang?.trim()) params.set('lang', input.lang.trim());
  if (input.userEmail?.trim()) params.set('user_email', input.userEmail.trim());
  return `${publicOrigin}/users/quickRegister?${params.toString()}`;
}
