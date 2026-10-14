import { prisma } from '@/lib/prisma';
import { toMediaApiPath } from '@/lib/uploadMediaUrl';
import {
  findPublicOrg,
  loadPublicTexts,
  publicOrgCard,
  resolvePublicLanguage,
  type PublicOrgCard,
} from '@/lib/club/publicOrg';
import {
  SPONSOR_SECTIONS,
  addDaysYmd,
  isSponsorSectionKey,
  pickCurrentContract,
  todayYmd,
  type SponsorPlacements,
  type SponsorStats,
} from '@/lib/club/sponsors/sponsorConstants';
import { SPONSOR_PUBLIC_TEXTS, SPONSOR_TEXTS_CATEGORY } from '@/lib/club/sponsors/sponsorPublicTexts';
import { ensureSponsorTables, getSponsorStatsById } from '@/lib/club/sponsors/sponsorService';

export type SponsorOrgCard = PublicOrgCard;

const findOrg = findPublicOrg;
const orgCard = publicOrgCard;
const resolveLanguage = resolvePublicLanguage;
const loadTexts = (language: string) => loadPublicTexts(SPONSOR_PUBLIC_TEXTS, SPONSOR_TEXTS_CATEGORY, language);

// ---------- sponsorship kit ----------

export type SponsorKitData = {
  language: string;
  texts: Record<string, string>;
  org: SponsorOrgCard;
  community: { members: number; staff: number; groups: number; years: number };
  demographics: {
    male: number;
    female: number;
    other: number;
    ages: Array<{ label: string; count: number }>;
  };
  touchpoints: { app: number; web: number; email: number };
  last30: { views: number; clicks: number };
  sponsors: Array<{ name: string; logoUrl: string | null; landingUrl: string }>;
  sampleBannerUrl: string | null;
};

const AGE_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: '0-13', min: 0, max: 13 },
  { label: '14-18', min: 14, max: 18 },
  { label: '19-35', min: 19, max: 35 },
  { label: '36-55', min: 36, max: 55 },
  { label: '56+', min: 56, max: 200 },
];

function ageOf(birthdate: Date, now: Date): number {
  let age = now.getFullYear() - birthdate.getFullYear();
  const m = now.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthdate.getDate())) age -= 1;
  return age;
}

function genderOf(value: string | null): 'male' | 'female' | 'other' {
  const g = (value ?? '').trim().toLowerCase();
  if (['m', 'male', 'man', 'maschio', 'uomo', 'masculino', 'homme'].includes(g)) return 'male';
  if (['f', 'female', 'woman', 'femmina', 'donna', 'femenino', 'femme'].includes(g)) return 'female';
  return 'other';
}

const EMAIL_SECTIONS = new Set(['email_medical_expiry', 'email_payment_reminder', 'email_membership_reminder']);
const WEB_SECTIONS = new Set(['events_page', 'online_registrations', 'online_payments']);

export async function getSponsorKit(orgId: string, requestedLang: string | null): Promise<SponsorKitData | null> {
  const org = await findOrg(orgId);
  if (!org) return null;
  await ensureSponsorTables();
  const language = await resolveLanguage(requestedLang, org.ownerId);

  const members =
    org.kind === 'club'
      ? await prisma.clubMember.findMany({
          where: { clubId: org.id },
          select: { member: { select: { gender: true, birthdate: true } } },
        })
      : await prisma.teamMember.findMany({
          where: { teamId: org.id },
          select: { athlete: { select: { gender: true, birthdate: true } } },
        });
  const people = members.map((m) => ('member' in m ? m.member : m.athlete));

  const [staff, groups, texts] = await Promise.all([
    org.kind === 'club'
      ? prisma.clubStaff.count({ where: { clubId: org.id } })
      : prisma.teamStaff.count({ where: { teamId: org.id } }),
    org.kind === 'club' ? prisma.clubMemberGroup.count({ where: { clubId: org.id } }) : Promise.resolve(0),
    loadTexts(language),
  ]);

  const now = new Date();
  const demographics = { male: 0, female: 0, other: 0, ages: AGE_BUCKETS.map((b) => ({ label: b.label, count: 0 })) };
  let unknownAge = 0;
  for (const p of people) {
    demographics[genderOf(p.gender)] += 1;
    if (!p.birthdate) {
      unknownAge += 1;
      continue;
    }
    const age = ageOf(p.birthdate, now);
    const idx = AGE_BUCKETS.findIndex((b) => age >= b.min && age <= b.max);
    if (idx >= 0) demographics.ages[idx].count += 1;
    else unknownAge += 1;
  }
  if (unknownAge > 0) demographics.ages.push({ label: '', count: unknownAge });

  const sponsorRows = await prisma.$queryRawUnsafe<
    Array<{ id: string; name: string; logo_path: string | null; banner_path: string | null; landing_url: string }>
  >(
    `SELECT id, name, logo_path, banner_path, landing_url FROM org_sponsors
     WHERE workspace_kind = ? AND workspace_id = ? AND visible = 1 ORDER BY name ASC`,
    org.kind,
    org.id,
  );
  const last30 = { views: 0, clicks: 0 };
  if (sponsorRows.length) {
    const marks = sponsorRows.map(() => '?').join(',');
    const rows = await prisma.$queryRawUnsafe<Array<{ event: string; total: bigint | number }>>(
      `SELECT event, COUNT(*) AS total FROM org_sponsor_events
       WHERE sponsor_id IN (${marks}) AND created_at >= ? GROUP BY event`,
      ...sponsorRows.map((r) => r.id),
      `${addDaysYmd(todayYmd(), -30)} 00:00:00`,
    );
    for (const r of rows) {
      if (r.event === 'view') last30.views = Number(r.total);
      else if (r.event === 'click') last30.clicks = Number(r.total);
    }
  }

  const keys = SPONSOR_SECTIONS.map((s) => s.key as string);
  return {
    language,
    texts,
    org: orgCard(org),
    community: {
      members: people.length,
      staff,
      groups,
      years: Math.max(1, now.getFullYear() - org.createdAt.getFullYear()),
    },
    demographics,
    touchpoints: {
      app: keys.filter((k) => !EMAIL_SECTIONS.has(k) && !WEB_SECTIONS.has(k)).length,
      web: keys.filter((k) => WEB_SECTIONS.has(k)).length + 1,
      email: keys.filter((k) => EMAIL_SECTIONS.has(k)).length,
    },
    last30,
    sponsors: sponsorRows.map((r) => ({
      name: r.name,
      logoUrl: r.logo_path ? toMediaApiPath(r.logo_path) : null,
      landingUrl: r.landing_url,
    })),
    sampleBannerUrl: (() => {
      const withBanner = sponsorRows.find((r) => r.banner_path);
      return withBanner?.banner_path ? toMediaApiPath(withBanner.banner_path) : null;
    })(),
  };
}

// ---------- sponsor report ----------

export type SponsorReportData = {
  language: string;
  texts: Record<string, string>;
  org: SponsorOrgCard;
  sponsor: { name: string; logoUrl: string | null; bannerUrl: string | null; landingUrl: string };
  placements: SponsorPlacements;
  contract: { startDate: string; endDate: string } | null;
  stats: SponsorStats;
};

export async function getSponsorReport(
  token: string,
  requestedLang: string | null,
  fromInput: string | null,
  toInput: string | null,
): Promise<SponsorReportData | null> {
  if (!/^[a-f0-9]{16,64}$/.test(token)) return null;
  await ensureSponsorTables();
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      workspace_id: string;
      name: string;
      logo_path: string | null;
      banner_path: string | null;
      landing_url: string;
      placements_json: string | null;
    }>
  >(
    `SELECT id, workspace_id, name, logo_path, banner_path, landing_url, placements_json
     FROM org_sponsors WHERE report_token = ? LIMIT 1`,
    token,
  );
  const row = rows[0];
  if (!row) return null;
  const org = await findOrg(row.workspace_id);
  if (!org) return null;

  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  const to = toInput && ymd.test(toInput) ? toInput : todayYmd();
  const from = fromInput && ymd.test(fromInput) ? fromInput : addDaysYmd(to, -30);

  const contracts = await prisma.$queryRawUnsafe<Array<{ start_date: Date; end_date: Date }>>(
    `SELECT start_date, end_date FROM org_sponsor_contracts WHERE sponsor_id = ?`,
    row.id,
  );
  const current = pickCurrentContract(
    contracts.map((c, i) => ({
      id: String(i),
      startDate: c.start_date.toISOString().slice(0, 10),
      endDate: c.end_date.toISOString().slice(0, 10),
      value: 0,
      reminderDays: 0,
      notes: '',
      pdfName: null,
      pdfUrl: null,
      createdAt: '',
    })),
  );

  let placements: SponsorPlacements = {};
  try {
    const parsed = JSON.parse(row.placements_json || '{}') as Record<string, unknown>;
    for (const [k, v] of Object.entries(parsed)) {
      if (isSponsorSectionKey(k) && (v === 'logo' || v === 'banner')) placements[k] = v;
    }
  } catch {
    placements = {};
  }

  const language = await resolveLanguage(requestedLang, org.ownerId);
  const [texts, stats] = await Promise.all([
    loadTexts(language),
    getSponsorStatsById(row.id, from <= to ? from : to, from <= to ? to : from),
  ]);

  return {
    language,
    texts,
    org: orgCard(org),
    sponsor: {
      name: row.name,
      logoUrl: row.logo_path ? toMediaApiPath(row.logo_path) : null,
      bannerUrl: row.banner_path ? toMediaApiPath(row.banner_path) : null,
      landingUrl: row.landing_url,
    },
    placements,
    contract: current ? { startDate: current.startDate, endDate: current.endDate } : null,
    stats,
  };
}
