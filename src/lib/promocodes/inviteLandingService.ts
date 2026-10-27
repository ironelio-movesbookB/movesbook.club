import { prisma } from '@/lib/prisma';
import { findPublicOrg, publicOrgCard } from '@/lib/club/publicOrg';
import { resolveEntityLogoUrl } from '@/lib/entity/entityLogo';
import { toMediaApiPath } from '@/lib/uploadMediaUrl';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';
import {
  loadSenderIntroMessage,
  resolveInviteOtherInfoAndAdvPage,
} from '@/lib/promocodes/promocodeInviteLinks';
import { getHelpHtmlPagesTable, getLegacyUsersTable, getPromocodeSettingsTable } from '@/lib/promocodes/legacyDb';
import { getTableColumns } from '@/lib/outcomeSettingsDb';
import { loadPromocodeInviteLanguageParagraph } from '@/lib/promocodes/promocodeInviteLanguage';
import {
  buildQuickRegisterUrlFromInvite,
  normalizeInviteSections,
  parseInviteSections,
  type InviteSectionKey,
} from '@/lib/promocodes/inviteLanding';
import { coercePublicOrigin } from '@/lib/siteUrl';
import { ensurePromocodeMetaTables } from '@/lib/promocodes/ensureMetaTables';

export type PublicInviteView = {
  promocode: string;
  language: string;
  sections: Record<InviteSectionKey, boolean>;
  introMessage: string;
  inviteBodyHtml: string;
  documentHtml: string;
  otherInfo: string;
  visitAlso: string;
  registerUrl: string;
  sender: {
    username: string;
    displayName: string;
    photoUrl: string | null;
    bannerUrl: string | null;
    location: string | null;
    kindLabel: string;
    visitorPageUrl: string | null;
    members: number | null;
    staff: number | null;
    sinceYear: number | null;
  };
};

async function websiteCover(workspaceId: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ cover_path: string | null; slug: string | null }>>(
      `SELECT cover_path, slug FROM org_websites WHERE workspace_id = ? LIMIT 1`,
      workspaceId,
    );
    const cover = rows[0]?.cover_path?.trim();
    return cover ? toMediaApiPath(cover) : null;
  } catch {
    return null;
  }
}

async function loadSenderByUsername(username: string): Promise<{
  userId: string;
  username: string;
  name: string;
  image: string | null;
  userType: string;
  legacyUserId: number | null;
  email: string;
} | null> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; username: string; name: string; image: string | null; userType: string; email: string }>
  >(
    `SELECT id, username, name, image, userType, email FROM users_new WHERE LOWER(username) = ? LIMIT 1`,
    username.toLowerCase(),
  );
  const user = rows[0];
  if (!user) return null;

  let legacyUserId: number | null = null;
  const legacyTable = await getLegacyUsersTable();
  if (legacyTable) {
    const columns = await getTableColumns(legacyTable);
    if (columns.has('username')) {
      const legacyRows = await prisma.$queryRawUnsafe<Array<{ id: number | bigint }>>(
        `SELECT id FROM \`${legacyTable}\` WHERE LOWER(username) = ? LIMIT 1`,
        user.username.toLowerCase(),
      );
      if (legacyRows[0]) legacyUserId = Number(legacyRows[0].id);
    }
  }

  return {
    userId: user.id,
    username: user.username,
    name: user.name || user.username,
    image: user.image,
    userType: String(user.userType),
    legacyUserId,
    email: user.email,
  };
}

async function senderVisual(sender: {
  userId: string;
  userType: string;
  image: string | null;
  name: string;
  username: string;
}): Promise<{
  photoUrl: string | null;
  bannerUrl: string | null;
  location: string | null;
  kindLabel: string;
  visitorPageUrl: string | null;
  members: number | null;
  staff: number | null;
  sinceYear: number | null;
}> {
  const photoUrl = resolvePublicImageUrl(sender.image) || resolveEntityLogoUrl(sender.image);
  let bannerUrl: string | null = null;
  let location: string | null = null;
  let kindLabel = 'Movesbook member';
  let visitorPageUrl: string | null = null;
  let members: number | null = null;
  let staff: number | null = null;
  let sinceYear: number | null = null;

  if (sender.userType === 'CLUB' || sender.userType === 'CLUB_TRAINER') {
    const club = await prisma.club.findFirst({
      where: { adminId: sender.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, location: true, createdAt: true },
    });
    if (club) {
      kindLabel = 'Club';
      location = club.location;
      sinceYear = club.createdAt.getFullYear();
      const org = await findPublicOrg(club.id);
      if (org) {
        const card = publicOrgCard(org);
        bannerUrl = card.bannerUrl;
        if (card.logoUrl) {
          /* keep photo as profile image when present */
        }
      }
      bannerUrl = (await websiteCover(club.id)) || bannerUrl;
      try {
        const slugRows = await prisma.$queryRawUnsafe<Array<{ slug: string | null }>>(
          `SELECT slug FROM org_websites WHERE workspace_id = ? AND enabled = 1 LIMIT 1`,
          club.id,
        );
        if (slugRows[0]?.slug) visitorPageUrl = `/site/${slugRows[0].slug}`;
      } catch {
        /* optional */
      }
      const memberCount = await prisma.clubMember.count({ where: { clubId: club.id } }).catch(() => 0);
      members = memberCount;
    }
  } else if (sender.userType === 'TEAM' || sender.userType === 'TEAM_TRAINER') {
    const team = await prisma.team.findFirst({
      where: { adminId: sender.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    });
    if (team) {
      kindLabel = 'Team';
      sinceYear = team.createdAt.getFullYear();
      const org = await findPublicOrg(team.id);
      if (org) {
        const card = publicOrgCard(org);
        bannerUrl = card.bannerUrl;
      }
      bannerUrl = (await websiteCover(team.id)) || bannerUrl;
      try {
        const slugRows = await prisma.$queryRawUnsafe<Array<{ slug: string | null }>>(
          `SELECT slug FROM org_websites WHERE workspace_id = ? AND enabled = 1 LIMIT 1`,
          team.id,
        );
        if (slugRows[0]?.slug) visitorPageUrl = `/site/${slugRows[0].slug}`;
      } catch {
        /* optional */
      }
    }
  } else if (sender.userType === 'COACH') {
    kindLabel = 'Coach';
  } else {
    kindLabel = 'Athlete';
  }

  return { photoUrl, bannerUrl, location, kindLabel, visitorPageUrl, members, staff, sinceYear };
}

export async function loadPublicInvite(input: {
  promocode: string;
  inviter?: string | null;
  lang?: string | null;
  sectionsRaw?: string | null;
  inviteByMovesbook?: boolean;
  userEmail?: string | null;
  origin: string;
}): Promise<PublicInviteView | null> {
  const promocode = input.promocode.trim();
  if (!promocode) return null;
  const inviter = input.inviter?.trim() || '';
  const language = (input.lang?.trim() || 'en').toLowerCase().slice(0, 10);
  const sections = parseInviteSections(input.sectionsRaw);

  const sender = inviter ? await loadSenderByUsername(inviter) : null;
  const visual = sender
    ? await senderVisual(sender)
    : {
        photoUrl: null,
        bannerUrl: null,
        location: null,
        kindLabel: 'Movesbook',
        visitorPageUrl: null,
        members: null,
        staff: null,
        sinceYear: null,
      };

  const introMessage =
    sections.intro && sender?.legacyUserId
      ? await loadSenderIntroMessage(sender.legacyUserId)
      : sections.intro
        ? ''
        : '';

  await ensurePromocodeMetaTables().catch(() => undefined);
  const languageId =
    language === 'it' ? '2' : language === 'fr' ? '3' : language === 'de' ? '4' : language === 'es' ? '5' : '1';

  let inviteBodyHtml = '';
  try {
    inviteBodyHtml = (await loadPromocodeInviteLanguageParagraph(languageId)) || '';
  } catch {
    inviteBodyHtml = '';
  }

  let documentHtml = '';
  if (sections.doc) {
    try {
      const settingsTable = await getPromocodeSettingsTable();
      let htmlPageId = '';
      if (settingsTable) {
        const cols = await getTableColumns(settingsTable);
        const helpCol = cols.has('help_html_pages_id')
          ? 'help_html_pages_id'
          : cols.has('help_html_page_id')
            ? 'help_html_page_id'
            : null;
        if (helpCol) {
          const rows = await prisma.$queryRawUnsafe<Array<{ help_id: string | number | null }>>(
            `SELECT \`${helpCol}\` AS help_id FROM \`${settingsTable}\` WHERE code = ? LIMIT 1`,
            promocode,
          );
          if (rows[0]?.help_id != null) htmlPageId = String(rows[0].help_id);
        }
      }
      const helpTable = await getHelpHtmlPagesTable();
      if (helpTable && htmlPageId) {
        const helpCols = await getTableColumns(helpTable);
        const contentCol = helpCols.has('content') ? 'content' : null;
        if (contentCol) {
          const helpRows = await prisma.$queryRawUnsafe<Array<{ content: string | null }>>(
            `SELECT \`${contentCol}\` AS content FROM \`${helpTable}\` WHERE id = ? LIMIT 1`,
            htmlPageId,
          );
          documentHtml = helpRows[0]?.content?.trim() || '';
        }
      }
    } catch {
      documentHtml = '';
    }
  }

  let otherInfo = '';
  let visitAlso = '';
  if (sections.links && sender?.legacyUserId) {
    const links = await resolveInviteOtherInfoAndAdvPage({
      senderLegacyUserId: sender.legacyUserId,
      senderEmail: sender.email,
    });
    otherInfo = links.otherInfo;
    visitAlso = links.advPage;
  }

  const registerUrl = buildQuickRegisterUrlFromInvite(coercePublicOrigin(input.origin), {
    promocode,
    inviter: sender?.username || inviter || null,
    lang: language,
    inviteByMovesbook: Boolean(input.inviteByMovesbook),
    userEmail: input.userEmail,
  });

  return {
    promocode,
    language,
    sections: normalizeInviteSections(sections),
    introMessage,
    inviteBodyHtml,
    documentHtml,
    otherInfo,
    visitAlso,
    registerUrl,
    sender: {
      username: sender?.username || inviter || 'Movesbook',
      displayName: sender?.name || inviter || 'Movesbook',
      photoUrl: visual.photoUrl,
      bannerUrl: visual.bannerUrl,
      location: visual.location,
      kindLabel: visual.kindLabel,
      visitorPageUrl: visual.visitorPageUrl,
      members: visual.members,
      staff: visual.staff,
      sinceYear: visual.sinceYear,
    },
  };
}
