import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTableSuperAdmin } from '@/lib/globalNewsAuth';
import {
  clampDelayMs,
  clampIntervalRows,
  clampStartRow,
  isHttpUrl,
  isSponsorLinkTarget,
  isSponsorSize,
  parseSponsorDateInput,
  type OgpSponsorLinkTarget,
  type OgpSponsorSize,
} from '@/lib/news/ogpSponsors';
import {
  loadSerializedSponsorSettings,
  saveSponsorGroup,
} from '@/lib/news/ogpSponsorStore';

export const dynamic = 'force-dynamic';

type IncomingSponsor = {
  id?: unknown;
  image?: unknown;
  size?: unknown;
  hoverTitle?: unknown;
  linkUrl?: unknown;
  linkTarget?: unknown;
  ogpArticleId?: unknown;
};

function parseSponsors(raw: unknown): {
  ok: true;
  sponsors: {
    id: string | null;
    image: string;
    ogpArticleId: string | null;
    size: OgpSponsorSize;
    hoverTitle: string | null;
    linkUrl: string;
    linkTarget: OgpSponsorLinkTarget;
    sortOrder: number;
  }[];
} | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'sponsors must be an array' };
  }
  const sponsors = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as IncomingSponsor;
    const image = typeof item?.image === 'string' ? item.image.trim() : '';
    const linkUrl = typeof item?.linkUrl === 'string' ? item.linkUrl.trim() : '';
    const hoverTitle =
      typeof item?.hoverTitle === 'string' ? item.hoverTitle.trim() : '';
    const ogpArticleId =
      typeof item?.ogpArticleId === 'string' && item.ogpArticleId.trim()
        ? item.ogpArticleId.trim()
        : null;
    if (!linkUrl || !isHttpUrl(linkUrl)) {
      return { ok: false, error: `Sponsor ${i + 1}: a valid http(s) link is required` };
    }
    if (!isSponsorSize(item?.size)) {
      return { ok: false, error: `Sponsor ${i + 1}: size must be single, double, triple, or quadruple` };
    }
    const linkTarget = isSponsorLinkTarget(item?.linkTarget) ? item.linkTarget : 'tab';
    const id = typeof item?.id === 'string' && item.id.trim() ? item.id.trim() : null;
    sponsors.push({
      id,
      image,
      ogpArticleId,
      size: item.size,
      hoverTitle: hoverTitle || null,
      linkUrl,
      linkTarget,
      sortOrder: i,
    });
  }
  return { ok: true, sponsors };
}

/** PUT — save one sponsor group’s placement, schedule, and sponsor list. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireTableSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: groupId } = await params;
    if (!groupId?.trim()) {
      return NextResponse.json({ error: 'Group id is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = parseSponsors(body.sponsors);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const startRow = clampStartRow(body.startRow);
    const intervalRows = clampIntervalRows(body.intervalRows);
    const delayMs = clampDelayMs(body.delayMs ?? (Number(body.delaySeconds) || 0) * 1000);
    const enabled = body.enabled !== false && body.enabled !== 0 && body.enabled !== '0';
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;

    const fromRaw =
      body.enabledFrom === null || body.enabledFrom === ''
        ? null
        : typeof body.enabledFrom === 'string'
          ? body.enabledFrom.trim()
          : '';
    const toRaw =
      body.enabledTo === null || body.enabledTo === ''
        ? null
        : typeof body.enabledTo === 'string'
          ? body.enabledTo.trim()
          : '';
    if (fromRaw !== null && fromRaw !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(fromRaw)) {
      return NextResponse.json({ error: 'Enabled from must be a valid date (YYYY-MM-DD)' }, { status: 400 });
    }
    if (toRaw !== null && toRaw !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(toRaw)) {
      return NextResponse.json({ error: 'Enabled to must be a valid date (YYYY-MM-DD)' }, { status: 400 });
    }
    const enabledFromYmd = fromRaw || null;
    const enabledToYmd = toRaw || null;
    if (enabledFromYmd && enabledToYmd && enabledFromYmd > enabledToYmd) {
      return NextResponse.json(
        { error: 'Enabled from must be on or before Enabled to' },
        { status: 400 },
      );
    }
    const enabledFrom = parseSponsorDateInput(enabledFromYmd);
    const enabledTo = parseSponsorDateInput(enabledToYmd);

    const missingImage = parsed.sponsors.filter((s) => !s.image);
    if (missingImage.length > 0) {
      const ids = [...new Set(missingImage.map((s) => s.ogpArticleId).filter((id): id is string => !!id))];
      const urls = [...new Set(missingImage.map((s) => s.linkUrl))];
      const ogpRows =
        ids.length || urls.length
          ? await prisma.ogpArticle.findMany({
              where: {
                deletedAt: null,
                OR: [
                  ...(ids.length ? [{ id: { in: ids } }] : []),
                  ...(urls.length ? [{ url: { in: urls } }] : []),
                ],
              },
              select: { id: true, image: true, url: true, title: true },
            })
          : [];
      const byId = new Map(ogpRows.map((a) => [a.id, a]));
      const byUrl = new Map(
        ogpRows
          .filter((a) => a.url)
          .map((a) => [a.url.replace(/\/+$/, '').toLowerCase(), a]),
      );
      for (let i = 0; i < parsed.sponsors.length; i++) {
        const sponsor = parsed.sponsors[i];
        if (sponsor.image) continue;
        const fromId = sponsor.ogpArticleId ? byId.get(sponsor.ogpArticleId) : undefined;
        const fromUrl = byUrl.get(sponsor.linkUrl.replace(/\/+$/, '').toLowerCase());
        const ogp = fromId?.image ? fromId : fromUrl?.image ? fromUrl : fromId ?? fromUrl;
        if (!ogp?.image) {
          return NextResponse.json(
            {
              error: `Sponsor ${i + 1}: select a picture, or choose an OGP News that has a picture`,
            },
            { status: 400 },
          );
        }
        sponsor.image = ogp.image;
        if (!sponsor.hoverTitle && ogp.title) sponsor.hoverTitle = ogp.title;
      }
    }

    const group = await saveSponsorGroup(groupId.trim(), {
      name,
      startRow,
      intervalRows,
      delayMs,
      enabled,
      enabledFrom,
      enabledTo,
      sponsors: parsed.sponsors.map(({ id, image, size, hoverTitle, linkUrl, linkTarget, sortOrder }) => ({
        id,
        image,
        size,
        hoverTitle,
        linkUrl,
        linkTarget,
        sortOrder,
      })),
    });

    const settings = await loadSerializedSponsorSettings();
    return NextResponse.json({ group, ...settings });
  } catch (e) {
    console.error('PUT /api/admin/ogp-sponsors/groups/[id]', e);
    const message = e instanceof Error ? e.message : 'Failed to save sponsor group';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
