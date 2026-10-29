import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deserializeMultiLanguageContent } from '@/lib/news/contentParser';
import { UserType } from '@prisma/client';
import { SPORT_ID_TO_SPORT_TYPE } from '@/lib/news/mappings';
import { verifyToken } from '@/lib/auth';
import { SPORTS_LIST } from '@/constants/moveframe.constants';
import { COUNTRIES_WITH_CODES } from '@/lib/news/countries';
import { getSuperAdminCreatorIds } from '@/app/api/news/auth';

export const dynamic = 'force-dynamic';

const TOTAL_SPORTS = SPORTS_LIST.length;
const TOTAL_USER_TYPES = Object.values(UserType).filter(
  (t) => t !== 'ADMIN' && t !== 'TEAM_MANAGER'
).length;
const TOTAL_COUNTRIES = COUNTRIES_WITH_CODES.length;

interface VisibilityCtx {
  isLoggedIn: boolean;
  userSports: string[];
  userType: string | null;
  userCountry: string | null;
  filterLanguageId: string | null;
  filterSport: string | null;
  filterSportActive: boolean;
}

function isArticleVisible(article: any, ctx: VisibilityCtx): boolean {
  const setting = article.settings?.[0];

  if (!setting) return true;

  if (setting.duration !== null && setting.duration !== undefined && setting.duration <= 0) {
    return false;
  }

  const settingSports: string[]    = setting.sports.map((s: any) => s.sport);
  const settingRoles: string[]     = setting.roles.map((r: any) => r.role);
  const settingLangIds: string[]   = setting.languages.map((l: any) => l.languageId);
  const settingCountries: string[] = setting.countries.map((c: any) => c.countryCode);

  if (ctx.filterLanguageId && settingLangIds.length > 0) {
    if (!settingLangIds.includes(ctx.filterLanguageId)) return false;
  }

  if (ctx.isLoggedIn) {
    if (ctx.filterSportActive) {
      if (ctx.filterSport && settingSports.length > 0) {
        if (!settingSports.includes(ctx.filterSport)) return false;
      }
    } else {
      if (settingSports.length > 0 && ctx.userSports.length > 0) {
        if (!ctx.userSports.some((s) => settingSports.includes(s))) return false;
      }
    }

    if (settingRoles.length > 0 && ctx.userType) {
      if (!settingRoles.includes(ctx.userType)) return false;
    }

    if (settingCountries.length > 0 && ctx.userCountry) {
      if (!settingCountries.includes(ctx.userCountry)) return false;
    }
  } else {
    if (ctx.filterSportActive) {
      if (ctx.filterSport && settingSports.length > 0) {
        if (!settingSports.includes(ctx.filterSport)) return false;
      }
    } 

    if (settingRoles.length > 0 && settingRoles.length < TOTAL_USER_TYPES) return false;

    if (settingCountries.length > 0 && settingCountries.length < TOTAL_COUNTRIES) return false;
  }

  return true;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId        = searchParams.get('categoryId');
    const sportId           = searchParams.get('sportId');
    const languageId        = searchParams.get('languageId');
    const search            = searchParams.get('search');
    const userId            = searchParams.get('userId');
    const userIdsRaw        = searchParams.get('userIds');
    const writerUsername    = searchParams.get('writerUsername');
    const writerUsernamesRaw = searchParams.get('writerUsernames');
    const page              = parseInt(searchParams.get('page')  || '1');
    const limit             = parseInt(searchParams.get('limit') || '10');
    const skip              = (page - 1) * limit;

    let isLoggedIn = false;
    let userSports: string[]    = [];
    let userType: string | null    = null;
    let userCountry: string | null = null;

    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const token   = authHeader.replace('Bearer ', '');
      const decoded = verifyToken(token);
      if (decoded?.userId) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
              userType: true,
              country:  true,
              mainSports:     { select: { sport: true } },
              favoriteSports: { select: { sport: true } },
            },
          });
          if (user) {
            isLoggedIn  = true;
            userType    = user.userType as string;
            userCountry = user.country || null;
            const combined = [
              ...user.mainSports.map((s) => s.sport as string),
              ...user.favoriteSports.map((s) => s.sport as string),
            ];
            userSports = combined.filter((v, i, a) => a.indexOf(v) === i);
          }
        } catch {
          // silent
        }
      }
    }

    const mappedSport       = sportId ? (SPORT_ID_TO_SPORT_TYPE[sportId] ?? null) : null;
    const filterSportActive = !!sportId;

    const where: any = {};

    if (categoryId) {
      where.newsCategoryId = categoryId;
    }

    if (languageId) {
      where.languageTitles = {
        some: { languageId },
      };
    }

    if (writerUsername) {
      where.writerUsername = writerUsername;
    } else if (writerUsernamesRaw) {
      const usernames = writerUsernamesRaw.split(',').map((s) => s.trim()).filter(Boolean);
      if (usernames.length > 0) {
        where.writerUsername = { in: usernames };
      }
    } else if (userId) {
      where.userId = userId;
    } else if (userIdsRaw) {
      const ids = userIdsRaw.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length > 0) {
        where.userId = { in: ids };
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { searchingKeywords: { contains: search } },
        {
          languageTitles: {
            some: { title: { contains: search } },
          },
        },
      ];
    }

    const allNews = await prisma.news.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
            sports:    { select: { sport: true } },
            roles:     { select: { role: true } },
            languages: { select: { languageId: true } },
            countries: { select: { countryCode: true } },
          },
        },
      },
    });

    const visCtx: VisibilityCtx = {
      isLoggedIn,
      userSports,
      userType,
      userCountry,
      filterLanguageId: languageId,
      filterSport: mappedSport,
      filterSportActive,
    };
    const visibleNews   = allNews.filter((article) => isArticleVisible(article, visCtx));
    const total         = visibleNews.length;
    const paginatedNews = visibleNews.slice(skip, skip + limit);

    const userIds = paginatedNews
      .map((item) => item.userId)
      .filter((id): id is string => id !== null);

    const usersMap = new Map<
      string,
      { id: string; username: string; image: string | null; firstname: string | null; lastname: string | null }
    >();

    if (userIds.length > 0) {
      try {
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, firstName: true, surname: true },
        });

        users.forEach((user) => {
          usersMap.set(user.id, {
            id:        user.id,
            username:  user.username,
            image:     null,
            firstname: user.firstName || null,
            lastname:  user.surname   || null,
          });
        });
      } catch {
        // silent
      }
    }

    const formattedNews = paginatedNews.map((item) => {
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
        id:                 item.id,
        title:              item.title,
        content:            deserializedContent,
        image:              item.image,
        createdAt:          item.createdAt.toISOString(),
        mode:               item.mode || null,
        internetLinkEditor: item.internetLinkEditor || null,
        inLastNews:         item.inLastNews  || 'N',
        feturedNews:        item.feturedNews || 'N',
        inGlobalNews:       (item as { inGlobalNews?: boolean }).inGlobalNews === true,
        author:             item.author         || null,
        originalAuthor:     item.originalAuthor  || null,
        searchingKeywords:  item.searchingKeywords || null,
        briefDesc:          item.briefDesc        || null,
        category: item.category
          ? { id: item.category.id, categoryName: item.category.categoryName }
          : null,
        languageTitles: item.languageTitles.map((lt) => ({
          title:    lt.title,
          language: { code: lt.language.code, name: lt.language.name },
        })),
        settings: item.settings.map((s) => ({
          sports: s.sports.map((sp) => ({ sport: sp.sport })),
        })),
        user: userData
          ? {
              id:        userData.id,
              username:  userData.username,
              image:     userData.image,
              firstname: userData.firstname,
              lastname:  userData.lastname,
            }
          : null,
      };
    });

    const movesbookUserIds = isLoggedIn ? await getSuperAdminCreatorIds() : [];

    return NextResponse.json({
      news: formattedNews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      movesbookUserIds,
    });
  } catch (error: any) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news', details: error.message },
      { status: 500 }
    );
  }
}
