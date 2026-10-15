import { prisma } from '@/lib/prisma';
import { parseClubDescriptionMeta, type ClubDescriptionMeta } from '@/lib/club/clubSidebarLabel';
import { resolveEntityLogoUrl } from '@/lib/entity/entityLogo';

/** Club or team shown on a public (no-login) page. */
export type PublicOrg = {
  kind: 'club' | 'team';
  id: string;
  name: string;
  ownerId: string;
  ownerEmail: string;
  description: string | null;
  location: string | null;
  createdAt: Date;
};

export async function findPublicOrg(id: string): Promise<PublicOrg | null> {
  const club = await prisma.club.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      adminId: true,
      description: true,
      location: true,
      createdAt: true,
      admin: { select: { email: true } },
    },
  });
  if (club) {
    return {
      kind: 'club',
      id: club.id,
      name: club.name,
      ownerId: club.adminId,
      ownerEmail: club.admin?.email ?? '',
      description: club.description,
      location: club.location,
      createdAt: club.createdAt,
    };
  }
  const team = await prisma.team.findUnique({
    where: { id },
    select: { id: true, name: true, adminId: true, description: true, createdAt: true, admin: { select: { email: true } } },
  });
  if (!team) return null;
  return {
    kind: 'team',
    id: team.id,
    name: team.name,
    ownerId: team.adminId,
    ownerEmail: team.admin?.email ?? '',
    description: team.description,
    location: null,
    createdAt: team.createdAt,
  };
}

export type PublicOrgCard = {
  kind: 'club' | 'team';
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  email: string;
  phone: string;
  website: string;
};

type TeamProfileLike = {
  contacts?: { email?: string; phone1?: string; website?: string };
  mainData?: { fiscalCode?: string };
};

export function teamProfileOf(meta: ClubDescriptionMeta): TeamProfileLike | undefined {
  return meta.teamProfile as unknown as TeamProfileLike | undefined;
}

export function publicOrgCard(org: PublicOrg): PublicOrgCard {
  const meta = parseClubDescriptionMeta(org.description);
  const contacts = meta.clubContacts ?? teamProfileOf(meta)?.contacts;
  const website = (contacts?.website || meta.website || '').trim();
  return {
    kind: org.kind,
    name: org.name,
    logoUrl: resolveEntityLogoUrl(meta.logoUrl),
    bannerUrl: resolveEntityLogoUrl(meta.bannerUrl),
    email: (contacts?.email || org.ownerEmail || '').trim(),
    phone: (contacts?.phone1 || meta.phone || '').trim(),
    website: website && !/^https?:\/\//i.test(website) ? `https://${website}` : website,
  };
}

function normalizeLang(value: string | null | undefined): string | null {
  const code = String(value ?? '').trim().toLowerCase().split('-')[0];
  return /^[a-z]{2,3}$/.test(code) ? code : null;
}

/** Visitor's language when given, else the club/team admin's language, else English. */
export async function resolvePublicLanguage(requested: string | null, ownerUserId: string): Promise<string> {
  const wanted = normalizeLang(requested);
  if (wanted) return wanted;
  const settings = await prisma.userSettings
    .findFirst({ where: { userId: ownerUserId }, select: { language: true } })
    .catch(() => null);
  return normalizeLang(settings?.language) ?? 'en';
}

const seededCategories = new Set<string>();

/**
 * Words of a public page from Settings → Language: missing English / Italian defaults are
 * added once (edits are never overwritten), then each key resolves language → English → default.
 */
export async function loadPublicTexts(
  catalog: Record<string, { en: string; it: string }>,
  category: string,
  language: string,
): Promise<Record<string, string>> {
  const keys = Object.keys(catalog);
  if (!seededCategories.has(category)) {
    try {
      await prisma.translation.createMany({
        data: Object.entries(catalog).flatMap(([key, v]) => [
          { key, language: 'en', value: v.en, category },
          { key, language: 'it', value: v.it, category },
        ]),
        skipDuplicates: true,
      });
      seededCategories.add(category);
    } catch (e) {
      console.error(`seed ${category} translations`, e);
    }
  }
  const rows = await prisma.translation.findMany({
    where: { key: { in: keys }, language: { in: Array.from(new Set([language, 'en'])) }, isDeleted: false },
    select: { key: true, language: true, value: true },
  });
  const out: Record<string, string> = {};
  for (const key of keys) {
    const own = rows.find((r) => r.key === key && r.language === language && r.value.trim());
    const en = rows.find((r) => r.key === key && r.language === 'en' && r.value.trim());
    out[key] = (own ?? en)?.value ?? catalog[key].en;
  }
  return out;
}
