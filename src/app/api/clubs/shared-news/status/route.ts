import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireClubAdmin } from '@/lib/clubNewsShareAuth';

export const dynamic = 'force-dynamic';

/** Returns which clubs the current club admin has shared each item to. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireClubAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const kind = request.nextUrl.searchParams.get('kind');
    const idsParam = request.nextUrl.searchParams.get('ids') ?? '';
    const clubId = request.nextUrl.searchParams.get('clubId')?.trim() || null;
    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean);

    if (!kind || (kind !== 'ogp' && kind !== 'news' && kind !== 'ogp-group')) {
      return NextResponse.json({ error: 'kind must be ogp, ogp-group, or news' }, { status: 400 });
    }
    if (ids.length === 0) {
      return NextResponse.json({ sharedByItem: {}, inClubGlobalByItem: {} });
    }

    if (kind === 'ogp-group') {
      const rows = await prisma.clubSharedOgpGroup.findMany({
        where: {
          sharedById: auth.userId,
          ogpNewsGroupId: { in: ids },
        },
        select: { ogpNewsGroupId: true, clubId: true, inClubGlobalNews: true, audienceMode: true },
      });
      const sharedByItem: Record<string, string[]> = {};
      const inClubGlobalByItem: Record<string, boolean> = {};
      const audienceModeByItem: Record<string, string> = {};
      for (const row of rows) {
        if (!sharedByItem[row.ogpNewsGroupId]) sharedByItem[row.ogpNewsGroupId] = [];
        sharedByItem[row.ogpNewsGroupId].push(row.clubId);
        if (clubId && row.clubId === clubId) {
          inClubGlobalByItem[row.ogpNewsGroupId] = row.inClubGlobalNews === true;
          audienceModeByItem[row.ogpNewsGroupId] = row.audienceMode;
        }
      }
      return NextResponse.json({ sharedByItem, inClubGlobalByItem, audienceModeByItem });
    }

    if (kind === 'ogp') {
      const rows = await prisma.clubSharedOgpArticle.findMany({
        where: {
          sharedById: auth.userId,
          ogpArticleId: { in: ids },
        },
        select: { ogpArticleId: true, clubId: true, inClubGlobalNews: true, audienceMode: true },
      });
      const sharedByItem: Record<string, string[]> = {};
      const inClubGlobalByItem: Record<string, boolean> = {};
      const audienceModeByItem: Record<string, string> = {};
      for (const row of rows) {
        if (!sharedByItem[row.ogpArticleId]) sharedByItem[row.ogpArticleId] = [];
        sharedByItem[row.ogpArticleId].push(row.clubId);
        if (clubId && row.clubId === clubId) {
          inClubGlobalByItem[row.ogpArticleId] = row.inClubGlobalNews === true;
          audienceModeByItem[row.ogpArticleId] = row.audienceMode;
        }
      }
      return NextResponse.json({ sharedByItem, inClubGlobalByItem, audienceModeByItem });
    }

    // With clubId: read that club's shares (audience / global flags).
    // Without: list clubs the current admin shared to (Share in My Clubs).
    const rows = await prisma.clubSharedNews.findMany({
      where: clubId
        ? { newsId: { in: ids }, clubId }
        : { sharedById: auth.userId, newsId: { in: ids } },
      select: { newsId: true, clubId: true, inClubGlobalNews: true, audienceMode: true },
    });
    const sharedByItem: Record<string, string[]> = {};
    const inClubGlobalByItem: Record<string, boolean> = {};
    const audienceModeByItem: Record<string, string> = {};
    for (const row of rows) {
      if (!sharedByItem[row.newsId]) sharedByItem[row.newsId] = [];
      sharedByItem[row.newsId].push(row.clubId);
      if (clubId && row.clubId === clubId) {
        inClubGlobalByItem[row.newsId] = row.inClubGlobalNews === true;
        audienceModeByItem[row.newsId] = row.audienceMode;
      }
    }
    return NextResponse.json({ sharedByItem, inClubGlobalByItem, audienceModeByItem });
  } catch (error) {
    console.error('Club shared news status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
