import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deserializeMultiLanguageContent } from '@/lib/news/contentParser';
import {
  canViewerSeeClubSharedOgp,
  newsSettingsToClubVisibility,
  parseJsonStringArray,
  type ClubSharedFeedItem,
} from '@/lib/clubNewsShareAuth';
import { parseClubDescriptionMeta } from '@/lib/club/clubSidebarLabel';
import { getSuperAdminCreatorIds } from '@/app/api/news/auth';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ clubId: string }> };

async function getClubAccess(
  userId: string,
  clubId: string,
): Promise<{ isClubAdmin: boolean; isClubMember: boolean }> {
  const club = await prisma.club.findFirst({
    where: { id: clubId, adminId: userId },
    select: { id: true },
  });
  if (club) return { isClubAdmin: true, isClubMember: true };

  const membership = await prisma.clubMember.findFirst({
    where: { clubId, memberId: userId },
    select: { id: true },
  });
  return { isClubAdmin: false, isClubMember: Boolean(membership) };
}

function clubUsernameFromDescription(description: string | null | undefined): string | null {
  const username = parseClubDescriptionMeta(description).username?.trim();
  return username || null;
}

async function loadClubUsernameMap(clubIds: string[]): Promise<Map<string, string | null>> {
  const unique = [...new Set(clubIds.filter(Boolean))];
  const map = new Map<string, string | null>();
  if (unique.length === 0) return map;
  const clubs = await prisma.club.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, description: true },
  });
  for (const c of clubs) {
    map.set(c.id, clubUsernameFromDescription(c.description) || c.name || null);
  }
  return map;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = verifyToken(authHeader.slice(7));
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clubId } = await context.params;
    const access = await getClubAccess(decoded.userId, clubId);
    if (!access.isClubAdmin && !access.isClubMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const type = request.nextUrl.searchParams.get('type') ?? 'all';
    const detail = request.nextUrl.searchParams.get('detail') ?? 'summary';
    const includeDeleted =
      request.nextUrl.searchParams.get('includeDeleted') === '1' ||
      request.nextUrl.searchParams.get('includeDeleted') === 'true';

    const viewerUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        userType: true,
        country: true,
        settings: { select: { language: true } },
        mainSports: { select: { sport: true } },
      },
    });
    const viewer = {
      userType: viewerUser?.userType ?? '',
      country: viewerUser?.country ?? null,
      languageCode: (viewerUser?.settings?.language ?? 'en').slice(0, 2).toLowerCase() || 'en',
      sports: (viewerUser?.mainSports ?? []).map((s) => s.sport),
    };

    /** Full ArticlePasted-compatible payload for Club News → OGP News UI. */
    if (detail === 'full' && type === 'ogp') {
      const includeOtherClubs =
        access.isClubAdmin &&
        request.nextUrl.searchParams.get('includeOtherClubs') === '1';

      let clubIdsForShares = [clubId];
      if (includeOtherClubs) {
        const adminClubs = await prisma.club.findMany({
          where: { adminId: decoded.userId },
          select: { id: true },
        });
        clubIdsForShares = adminClubs.map((c) => c.id);
        if (!clubIdsForShares.includes(clubId)) clubIdsForShares.push(clubId);
      }

      const clubUsernameById = await loadClubUsernameMap(clubIdsForShares);

      const ogpShares = await prisma.clubSharedOgpArticle.findMany({
        where: { clubId: { in: clubIdsForShares } },
        orderBy: { createdAt: 'desc' },
        include: {
          ogpArticle: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  country: true,
                  userType: true,
                },
              },
            },
          },
        },
      });

      const articlesById = new Map<string, Record<string, unknown>>();
      for (const row of ogpShares) {
        if (row.ogpArticle.deletedAt) continue;
        const a = row.ogpArticle;
        const shareClubId = row.clubId;
        const isFromOtherClub = shareClubId !== clubId;
        // Prefer current-club share when the same article appears in multiple clubs.
        if (articlesById.has(a.id) && isFromOtherClub) continue;
        if (
          !canViewerSeeClubSharedOgp({
            audienceMode: row.audienceMode,
            isClubAdmin: access.isClubAdmin,
            isClubMember: isFromOtherClub ? false : access.isClubMember,
            viewer,
            visibility: {
              userTypes: parseJsonStringArray(a.visibilityUserTypes),
              countries: parseJsonStringArray(a.visibilityCountries),
              languages: parseJsonStringArray(a.visibilityLanguages),
              sports: parseJsonStringArray(a.visibilitySports),
              expiresAt: a.expiresAt,
            },
          })
        ) {
          // Other-club shares are admin-only overview; still allow club admin to see them.
          if (!(includeOtherClubs && isFromOtherClub && access.isClubAdmin)) continue;
        }

        const existing = articlesById.get(a.id);
        const sharedClubIds = Array.isArray(existing?.sharedClubIds)
          ? [...(existing!.sharedClubIds as string[])]
          : [];
        if (!sharedClubIds.includes(shareClubId)) sharedClubIds.push(shareClubId);

        // Keep current-club row fields when already present; only expand sharedClubIds.
        if (existing && !isFromOtherClub) {
          existing.sharedClubIds = sharedClubIds;
          existing.inClubGlobalNews = row.inClubGlobalNews === true;
          existing.clubAudienceMode = row.audienceMode;
          existing.sharedClubId = shareClubId;
          existing.sharedClubUsername = clubUsernameById.get(shareClubId) ?? null;
          existing.isFromOtherClub = false;
          continue;
        }
        if (existing && isFromOtherClub) {
          existing.sharedClubIds = sharedClubIds;
          continue;
        }

        articlesById.set(a.id, {
          id: a.id,
          userId: a.userId,
          creatorUsername: a.user?.username ?? null,
          creatorCountry: a.user?.country ?? null,
          createdByCurrentUser: a.userId === decoded.userId,
          createdBySuperAdmin: a.user?.userType === 'ADMIN',
          title: a.title,
          image: a.image,
          description: a.description,
          url: a.url,
          siteName: a.siteName,
          type: a.type,
          customDescription: a.customDescription,
          topic: a.topic,
          languageCode: a.languageCode ?? undefined,
          savedAt: a.savedAt.toISOString(),
          inGlobalNews: a.inGlobalNews === true,
          inClubGlobalNews: row.inClubGlobalNews === true,
          clubAudienceMode: row.audienceMode,
          deletedAt: a.deletedAt?.toISOString() ?? null,
          deletedByUserId: a.deletedByUserId,
          visibilityUserTypes: parseJsonStringArray(a.visibilityUserTypes),
          visibilityCountries: parseJsonStringArray(a.visibilityCountries),
          visibilityLanguages: parseJsonStringArray(a.visibilityLanguages),
          visibilitySports: parseJsonStringArray(a.visibilitySports),
          expiresAt: a.expiresAt?.toISOString() ?? null,
          sharedAt: row.createdAt.toISOString(),
          sharedClubIds,
          sharedClubId: shareClubId,
          sharedClubUsername: clubUsernameById.get(shareClubId) ?? null,
          isFromOtherClub,
        });
      }

      // Ensure current-club username is present even when includeOtherClubs is off.
      if (!includeOtherClubs) {
        const currentUsername = clubUsernameById.get(clubId) ?? null;
        for (const entry of articlesById.values()) {
          if (!entry.sharedClubUsername) entry.sharedClubUsername = currentUsername;
          if (!entry.sharedClubId) entry.sharedClubId = clubId;
        }
      }

      // Second pass: attach all club ids this article is shared to (among admin clubs).
      if (includeOtherClubs) {
        for (const row of ogpShares) {
          const entry = articlesById.get(row.ogpArticleId);
          if (!entry) continue;
          const ids = Array.isArray(entry.sharedClubIds)
            ? (entry.sharedClubIds as string[])
            : [];
          if (!ids.includes(row.clubId)) {
            entry.sharedClubIds = [...ids, row.clubId];
          }
        }
      }

      const articles = [...articlesById.values()];

      const ogpGroupShares = await prisma.clubSharedOgpGroup.findMany({
        where: { clubId: { in: clubIdsForShares } },
        orderBy: { createdAt: 'desc' },
        include: {
          ogpNewsGroup: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  country: true,
                  userType: true,
                },
              },
              items: {
                orderBy: [{ sortOrder: 'asc' }, { addedAt: 'asc' }],
                include: {
                  ogpArticle: {
                    include: {
                      user: { select: { username: true, country: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const groupsById = new Map<string, Record<string, unknown>>();
      for (const row of ogpGroupShares) {
        if (row.ogpNewsGroup.deletedAt) continue;
        const g = row.ogpNewsGroup;
        const shareClubId = row.clubId;
        const isFromOtherClub = shareClubId !== clubId;
        if (groupsById.has(g.id) && isFromOtherClub) continue;
        if (
          !canViewerSeeClubSharedOgp({
            audienceMode: row.audienceMode,
            isClubAdmin: access.isClubAdmin,
            isClubMember: isFromOtherClub ? false : access.isClubMember,
            viewer,
            visibility: {
              userTypes: parseJsonStringArray(g.visibilityUserTypes),
              countries: parseJsonStringArray(g.visibilityCountries),
              languages: parseJsonStringArray(g.visibilityLanguages),
              sports: parseJsonStringArray(g.visibilitySports),
              expiresAt: g.expiresAt,
            },
          })
        ) {
          if (!(includeOtherClubs && isFromOtherClub && access.isClubAdmin)) continue;
        }

        const existing = groupsById.get(g.id);
        const sharedClubIds = Array.isArray(existing?.sharedClubIds)
          ? [...(existing!.sharedClubIds as string[])]
          : [];
        if (!sharedClubIds.includes(shareClubId)) sharedClubIds.push(shareClubId);

        if (existing && !isFromOtherClub) {
          existing.sharedClubIds = sharedClubIds;
          existing.inClubGlobalNews = row.inClubGlobalNews === true;
          existing.clubAudienceMode = row.audienceMode;
          existing.audienceMode = row.audienceMode;
          existing.sharedClubId = shareClubId;
          existing.sharedClubUsername = clubUsernameById.get(shareClubId) ?? null;
          existing.isFromOtherClub = false;
          continue;
        }
        if (existing && isFromOtherClub) {
          existing.sharedClubIds = sharedClubIds;
          continue;
        }

        const sortedItems = [...g.items].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.addedAt.getTime() - b.addedAt.getTime(),
        );
        const first = sortedItems[0]?.ogpArticle ?? null;
        const creatorName =
          (g.user?.name && g.user.name.trim()) || g.user?.username || null;

        groupsById.set(g.id, {
          id: g.id,
          userId: g.userId,
          name: g.name,
          topic: g.topic,
          savedAt: g.savedAt.toISOString(),
          memberCount: sortedItems.length,
          memberIds: sortedItems.map((i) => i.ogpArticleId),
          creatorUsername: g.user?.username ?? null,
          creatorName,
          creatorCountry: g.user?.country ?? null,
          createdByCurrentUser: g.userId === decoded.userId,
          customDescription: g.customDescription ?? first?.customDescription ?? null,
          coverImage: g.coverImage ?? null,
          deletedAt: g.deletedAt?.toISOString() ?? null,
          visibilityUserTypes: parseJsonStringArray(g.visibilityUserTypes),
          visibilityCountries: parseJsonStringArray(g.visibilityCountries),
          visibilityLanguages: parseJsonStringArray(g.visibilityLanguages),
          visibilitySports: parseJsonStringArray(g.visibilitySports),
          expiresAt: g.expiresAt?.toISOString() ?? null,
          audienceMode: row.audienceMode,
          clubAudienceMode: row.audienceMode,
          inClubGlobalNews: row.inClubGlobalNews === true,
          title: first?.title ?? g.name,
          image: g.coverImage ?? first?.image ?? null,
          description: first?.description ?? null,
          url: first?.url ?? '',
          siteName: first?.siteName ?? null,
          type: first?.type ?? null,
          previewTopic: first?.topic ?? g.topic,
          previewCreatorUsername: first?.user?.username ?? g.user?.username ?? null,
          sharedAt: row.createdAt.toISOString(),
          sharedClubIds,
          sharedClubId: shareClubId,
          sharedClubUsername: clubUsernameById.get(shareClubId) ?? null,
          isFromOtherClub,
        });
      }

      if (includeOtherClubs) {
        for (const row of ogpGroupShares) {
          const entry = groupsById.get(row.ogpNewsGroupId);
          if (!entry) continue;
          const ids = Array.isArray(entry.sharedClubIds)
            ? (entry.sharedClubIds as string[])
            : [];
          if (!ids.includes(row.clubId)) {
            entry.sharedClubIds = [...ids, row.clubId];
          }
        }
      }

      const groups = [...groupsById.values()];

      return NextResponse.json({ articles, groups, items: articles });
    }

    /** Full NewsList-compatible payload for the Club News → News archive UI. */
    if (detail === 'full' && type === 'news') {
      const newsShares = await prisma.clubSharedNews.findMany({
        where: { clubId },
        orderBy: { createdAt: 'desc' },
        include: {
          news: {
            include: {
              category: {
                select: { id: true, categoryName: true },
              },
              languageTitles: {
                include: {
                  language: {
                    select: { id: true, code: true, name: true },
                  },
                },
              },
              settings: {
                include: {
                  sports: { select: { sport: true } },
                  roles: { select: { role: true } },
                  languages: {
                    include: { language: { select: { code: true } } },
                  },
                  countries: { select: { countryCode: true } },
                },
              },
            },
          },
        },
      });

      const userIds = newsShares
        .filter((row) =>
          canViewerSeeClubSharedOgp({
            audienceMode: row.audienceMode,
            isClubAdmin: access.isClubAdmin,
            isClubMember: access.isClubMember,
            viewer,
            visibility: newsSettingsToClubVisibility(row.news.settings, row.news.createdAt),
          }),
        )
        .map((row) => row.news.userId)
        .filter((id): id is string => id !== null);

      const usersMap = new Map<
        string,
        { id: string; username: string; image: string | null; firstname: string | null; lastname: string | null }
      >();

      if (userIds.length > 0) {
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, firstName: true, surname: true },
        });
        users.forEach((u) => {
          usersMap.set(u.id, {
            id: u.id,
            username: u.username,
            image: null,
            firstname: u.firstName || null,
            lastname: u.surname || null,
          });
        });
      }

      const news = newsShares
        .filter((row) =>
          canViewerSeeClubSharedOgp({
            audienceMode: row.audienceMode,
            isClubAdmin: access.isClubAdmin,
            isClubMember: access.isClubMember,
            viewer,
            visibility: newsSettingsToClubVisibility(row.news.settings, row.news.createdAt),
          }),
        )
        .map((row) => {
        const item = row.news;
        let deserializedContent: Record<string, string> = {};
        if (item.content) {
          try {
            deserializedContent = deserializeMultiLanguageContent(item.content);
          } catch {
            deserializedContent = {};
          }
        }
        const userData = item.userId ? usersMap.get(item.userId) ?? null : null;
        return {
          id: item.id,
          title: item.title,
          content: deserializedContent,
          image: item.image,
          createdAt: item.createdAt.toISOString(),
          mode: item.mode || null,
          internetLinkEditor: item.internetLinkEditor || null,
          inLastNews: item.inLastNews || 'N',
          feturedNews: item.feturedNews || 'N',
          author: item.author || null,
          originalAuthor: item.originalAuthor || null,
          searchingKeywords: item.searchingKeywords || null,
          briefDesc: item.briefDesc || null,
          category: item.category
            ? { id: item.category.id, categoryName: item.category.categoryName }
            : null,
          languageTitles: item.languageTitles.map((lt) => ({
            title: lt.title,
            language: { code: lt.language.code, name: lt.language.name },
          })),
          settings: item.settings.map((s) => ({
            sports: s.sports.map((sp) => ({ sport: sp.sport })),
          })),
          user: userData
            ? {
                id: userData.id,
                username: userData.username,
                image: userData.image,
                firstname: userData.firstname,
                lastname: userData.lastname,
              }
            : null,
          sharedAt: row.createdAt.toISOString(),
          sharedClubIds: [clubId],
          inClubGlobalNews: row.inClubGlobalNews === true,
          clubAudienceMode: row.audienceMode,
        };
      });

      const [clubRow, staffRows, memberRows, movesbookUserIds] = await Promise.all([
        prisma.club.findUnique({
          where: { id: clubId },
          select: { adminId: true },
        }),
        prisma.clubStaff.findMany({
          where: { clubId },
          select: { userId: true },
        }),
        prisma.clubMember.findMany({
          where: { clubId },
          select: { memberId: true },
        }),
        getSuperAdminCreatorIds(),
      ]);
      const adminStaffUserIds = [
        ...new Set(
          [clubRow?.adminId, ...staffRows.map((s) => s.userId)].filter(
            (id): id is string => Boolean(id),
          ),
        ),
      ];
      const adminStaffSet = new Set(adminStaffUserIds);
      const movesbookIdSet = new Set(movesbookUserIds);
      const memberUserIds = [
        ...new Set(
          memberRows
            .map((m) => m.memberId)
            .filter((id) => id && !adminStaffSet.has(id) && !movesbookIdSet.has(id)),
        ),
      ];

      return NextResponse.json({
        news,
        items: news,
        currentUserId: decoded.userId,
        adminStaffUserIds,
        memberUserIds,
        movesbookUserIds,
      });
    }

    const items: ClubSharedFeedItem[] = [];
    /** Club Global News (type=all) only includes items promoted via the globe toggle. */
    const globalOnly = type === 'all';
    const shareWhere = globalOnly
      ? { clubId, inClubGlobalNews: true }
      : { clubId };

    const [clubRow, staffRows, memberRows, movesbookUserIds] = await Promise.all([
      prisma.club.findUnique({
        where: { id: clubId },
        select: { adminId: true },
      }),
      prisma.clubStaff.findMany({
        where: { clubId },
        select: { userId: true },
      }),
      prisma.clubMember.findMany({
        where: { clubId },
        select: { memberId: true },
      }),
      getSuperAdminCreatorIds(),
    ]);

    const adminStaffUserIds = [
      ...new Set(
        [clubRow?.adminId, ...staffRows.map((s) => s.userId)].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ];
    const adminStaffSet = new Set(adminStaffUserIds);
    const movesbookIdSet = new Set(movesbookUserIds);
    const memberUserIds = [
      ...new Set(
        memberRows
          .map((m) => m.memberId)
          .filter((id) => id && !adminStaffSet.has(id) && !movesbookIdSet.has(id)),
      ),
    ];

    if (type === 'all' || type === 'news') {
      const newsShares = await prisma.clubSharedNews.findMany({
        where: shareWhere,
        orderBy: { createdAt: 'desc' },
        include: {
          news: {
            select: {
              id: true,
              userId: true,
              title: true,
              date: true,
              author: true,
              originalAuthor: true,
              method: true,
              image: true,
              briefDesc: true,
              internetLink: true,
              category: { select: { categoryName: true } },
            },
          },
        },
      });
      const newsUserIds = [
        ...new Set(
          newsShares.map((row) => row.news.userId).filter((id): id is string => Boolean(id)),
        ),
      ];
      const newsUsers =
        newsUserIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: newsUserIds } },
              select: { id: true, country: true },
            })
          : [];
      const newsCountryByUserId = new Map(
        newsUsers.map((u) => [u.id, u.country ?? null] as const),
      );

      for (const row of newsShares) {
        items.push({
          kind: 'news',
          id: row.news.id,
          shareId: row.id,
          title: row.news.title,
          date: row.news.date.toISOString(),
          author: row.news.author ?? row.news.originalAuthor,
          posterUserId: row.news.userId ?? null,
          creatorCountry: row.news.userId
            ? (newsCountryByUserId.get(row.news.userId) ?? null)
            : null,
          expiresAt: null,
          deletedAt: null,
          categoryName: row.news.category?.categoryName ?? null,
          method: row.news.method,
          image: row.news.image,
          briefDesc: row.news.briefDesc,
          internetLink: row.news.internetLink,
          sharedAt: row.createdAt.toISOString(),
          inClubGlobalNews: row.inClubGlobalNews === true,
        });
      }
    }

    if (type === 'all' || type === 'ogp') {
      const ogpShares = await prisma.clubSharedOgpArticle.findMany({
        where: shareWhere,
        orderBy: { createdAt: 'desc' },
        include: {
          ogpArticle: {
            select: {
              id: true,
              userId: true,
              title: true,
              savedAt: true,
              topic: true,
              image: true,
              url: true,
              description: true,
              customDescription: true,
              deletedAt: true,
              visibilityUserTypes: true,
              visibilityCountries: true,
              visibilityLanguages: true,
              visibilitySports: true,
              expiresAt: true,
              user: { select: { username: true, country: true } },
            },
          },
        },
      });
      for (const row of ogpShares) {
        if (row.ogpArticle.deletedAt && !includeDeleted) continue;
        const a = row.ogpArticle;
        // Soft-deleted items are only returned for client-side "Show deleted" filters.
        if (
          !a.deletedAt &&
          !canViewerSeeClubSharedOgp({
            audienceMode: row.audienceMode,
            isClubAdmin: access.isClubAdmin,
            isClubMember: access.isClubMember,
            viewer,
            visibility: {
              userTypes: parseJsonStringArray(a.visibilityUserTypes),
              countries: parseJsonStringArray(a.visibilityCountries),
              languages: parseJsonStringArray(a.visibilityLanguages),
              sports: parseJsonStringArray(a.visibilitySports),
              // When includeDeleted, allow expired through so client can filter.
              expiresAt: includeDeleted ? null : a.expiresAt,
            },
          })
        ) {
          continue;
        }
        items.push({
          kind: 'ogp',
          id: row.ogpArticle.id,
          shareId: row.id,
          title: row.ogpArticle.title,
          date: row.ogpArticle.savedAt.toISOString(),
          topic: row.ogpArticle.topic,
          creatorUsername: row.ogpArticle.user?.username ?? null,
          posterUserId: row.ogpArticle.userId ?? null,
          creatorCountry: row.ogpArticle.user?.country ?? null,
          expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
          deletedAt: a.deletedAt ? a.deletedAt.toISOString() : null,
          image: row.ogpArticle.image,
          url: row.ogpArticle.url,
          description: row.ogpArticle.description,
          customDescription: row.ogpArticle.customDescription,
          languages: parseJsonStringArray(a.visibilityLanguages),
          sharedAt: row.createdAt.toISOString(),
          inClubGlobalNews: row.inClubGlobalNews === true,
        });
      }
    }

    if (type === 'all' || type === 'ogp') {
      const ogpGroupShares = await prisma.clubSharedOgpGroup.findMany({
        where: shareWhere,
        orderBy: { createdAt: 'desc' },
        include: {
          ogpNewsGroup: {
            select: {
              id: true,
              userId: true,
              name: true,
              topic: true,
              savedAt: true,
              coverImage: true,
              customDescription: true,
              deletedAt: true,
              visibilityUserTypes: true,
              visibilityCountries: true,
              visibilityLanguages: true,
              visibilitySports: true,
              expiresAt: true,
              user: { select: { username: true, name: true, country: true } },
              items: {
                orderBy: [{ sortOrder: 'asc' }, { addedAt: 'asc' }],
                take: 1,
                include: {
                  ogpArticle: {
                    select: {
                      title: true,
                      image: true,
                      description: true,
                      url: true,
                      customDescription: true,
                    },
                  },
                },
              },
              _count: { select: { items: true } },
            },
          },
        },
      });
      for (const row of ogpGroupShares) {
        if (row.ogpNewsGroup.deletedAt && !includeDeleted) continue;
        const g = row.ogpNewsGroup;
        if (
          !g.deletedAt &&
          !canViewerSeeClubSharedOgp({
            audienceMode: row.audienceMode,
            isClubAdmin: access.isClubAdmin,
            isClubMember: access.isClubMember,
            viewer,
            visibility: {
              userTypes: parseJsonStringArray(g.visibilityUserTypes),
              countries: parseJsonStringArray(g.visibilityCountries),
              languages: parseJsonStringArray(g.visibilityLanguages),
              sports: parseJsonStringArray(g.visibilitySports),
              expiresAt: includeDeleted ? null : g.expiresAt,
            },
          })
        ) {
          continue;
        }
        const first = g.items[0]?.ogpArticle ?? null;
        items.push({
          kind: 'ogp-group',
          id: g.id,
          shareId: row.id,
          title: first?.title ?? g.name,
          date: g.savedAt.toISOString(),
          topic: g.topic,
          creatorUsername: g.user?.username ?? null,
          posterUserId: g.userId ?? null,
          creatorCountry: g.user?.country ?? null,
          expiresAt: g.expiresAt ? g.expiresAt.toISOString() : null,
          deletedAt: g.deletedAt ? g.deletedAt.toISOString() : null,
          image: g.coverImage ?? first?.image ?? null,
          url: first?.url ?? '',
          description: first?.description ?? null,
          customDescription: g.customDescription ?? first?.customDescription ?? null,
          memberCount: g._count.items,
          languages: parseJsonStringArray(g.visibilityLanguages),
          sharedAt: row.createdAt.toISOString(),
          inClubGlobalNews: row.inClubGlobalNews === true,
        });
      }
    }

    // Club Global News: chronological by article date (like admin Global News).
    // Other feeds: by when shared into the club.
    items.sort((a, b) =>
      globalOnly
        ? new Date(b.date).getTime() - new Date(a.date).getTime()
        : new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime(),
    );

    return NextResponse.json({
      items,
      isClubAdmin: access.isClubAdmin,
      currentUserId: decoded.userId,
      adminStaffUserIds,
      memberUserIds,
      movesbookUserIds,
    });
  } catch (error) {
    console.error('Fetch club shared news:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
