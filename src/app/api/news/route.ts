import { NextRequest, NextResponse } from 'next/server';
import { SportType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken, verifyPassword } from '@/lib/auth';
import { verifyClubOwnership } from '@/lib/clubNewsShareAuth';
import { isClubOgpAudienceMode } from '@/lib/clubOgpAudience';
import { isValidSportType } from '@/lib/profileSports';
import * as serialize from 'php-serialize';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const section = searchParams.get('section');
    const sport = searchParams.get('sport');
    const documentType = searchParams.get('documentType');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const language = searchParams.get('language');
    const method = searchParams.get('method');
    const search = searchParams.get('search');
    const categoryId = searchParams.get('categoryId');

    const where: any = {};

    if (section) {
      where.section = { contains: section };
    }

    if (documentType) {
      where.documentType = documentType;
    }

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) {
        where.date.gte = new Date(fromDate);
      }
      if (toDate) {
        where.date.lte = new Date(toDate);
      }
    }

    if (language) {
      where.langValueId = language;
    }


    if (method) {
      where.method = method;
    }

    if (categoryId) {
      where.newsCategoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { section: { contains: search } },
        { author: { contains: search } },
        { originalAuthor: { contains: search } },
        { searchingKeywords: { contains: search } },
      ];
    }

    const total = await prisma.news.count({ where });

    const news = await prisma.news.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        originalLanguage: true,
        _count: {
          select: {
            newsComments: true,
            relatedArticles: true,
          },
        },
      },
    });

    return NextResponse.json({
      news,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const {
      date,
      langValueId,
      documentType,
      title,
      newsCategoryId,
      section,
      image,
      bannerImage,
      author,
      originalAuthor,
      priority,
      content,
      internetLink,
      internetLinkEditor,
      pageOption,
      displayMode,
      mode,
      searchingKeywords,
      method,
      shareEnable,
      shareCommentOption,
      visualizeInReadingPageAuthorName,
      visualizeInReadingPageActualAuthorName,
      inLastNews,
      editableAdmin,
      editableOperators,
      editableUsers,
      editableTranslators,
      enableCheck,
      checkedBanner,
      favArticleAuthor,
      feturedNews,
      briefDesc,
      writerUsername,
      writerPassword,
      showWriterImage,
      languageTitles,
      settings,
      relatedArticleIds,
      shareToClubId,
      audienceMode: audienceModeRaw,
    } = body;

    const username = writerUsername?.trim();
    const password = writerPassword?.trim();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Writer username and password are required' },
        { status: 400 }
      );
    }

    let verifiedUser: any = null;

    const superAdmin = await prisma.superAdmin.findFirst({
      where: {
        OR: [
          { email: username },
          { username: username },
          { email: username.toLowerCase() },
          { username: username.toLowerCase() },
        ],
        isActive: true,
      },
    });

    if (superAdmin && await verifyPassword(password, superAdmin.password)) {
      verifiedUser = { id: superAdmin.id, username: superAdmin.username, type: 'Admin' };
    } else {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: username.toLowerCase() },
            { email: username.toLowerCase() },
          ],
        },
      });

      if (user && await verifyPassword(password, user.password)) {
        verifiedUser = { id: user.id, username: user.username };
      }
    }

    if (!verifiedUser) {
      return NextResponse.json(
        { error: 'Invalid writer credentials' },
        { status: 401 }
      );
    }

    const clubIdToShare =
      typeof shareToClubId === 'string' && shareToClubId.trim() ? shareToClubId.trim() : null;
    if (clubIdToShare) {
      const creator = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { userType: true },
      });
      if (creator?.userType !== 'CLUB') {
        return NextResponse.json({ error: 'Club admin only' }, { status: 403 });
      }
      const ownsClub = await verifyClubOwnership(decoded.userId, clubIdToShare);
      if (!ownsClub) {
        return NextResponse.json({ error: 'Club not found or access denied' }, { status: 403 });
      }
    }

    const shareAudienceMode = isClubOgpAudienceMode(audienceModeRaw)
      ? audienceModeRaw
      : 'me-and-club-members';

    let actualLangValueId: string | null = null;
    if (langValueId) {
      const language = await prisma.language.findUnique({
        where: { id: langValueId, isActive: true },
        select: { id: true },
      });
      if (language) {
        actualLangValueId = language.id;
      }
    }

    const news = await prisma.news.create({
      data: {
        userId: decoded.userId,
        date: date ? new Date(date) : new Date(),
        langValueId: actualLangValueId,
        documentType: documentType || null,
        title: title || null,
        newsCategoryId: newsCategoryId || null,
        section: section || null,
        image: image || null,
        bannerImage: bannerImage || null,
        author: author || null,
        originalAuthor: originalAuthor || null,
        priority: priority || null,
        content: (() => {
          const contentObj = typeof content === 'object' ? content : (content ? JSON.parse(Buffer.from(content, 'base64').toString()) : { en: '' });
          const serialized = serialize.serialize(contentObj);
          return Buffer.from(serialized).toString('base64');
        })(),
        mode: mode || 'content',
        internetLink: internetLink || null,
        internetLinkEditor: internetLinkEditor || null,
        pageOption: pageOption || null,
        displayMode: displayMode || null,
        searchingKeywords: searchingKeywords || null,
        method: method || 'Typed',
        shareEnable: shareEnable || 'N',
        shareCommentOption: shareCommentOption || 'N',
        visualizeInReadingPageAuthorName: visualizeInReadingPageAuthorName || 'N',
        visualizeInReadingPageActualAuthorName: visualizeInReadingPageActualAuthorName || 'N',
        inLastNews: inLastNews || 'N',
        editableAdmin: editableAdmin || 'N',
        editableOperators: editableOperators || 'N',
        editableUsers: editableUsers || 'N',
        editableTranslators: editableTranslators || 'N',
        enableCheck: enableCheck || 'N',
        checkedBanner: checkedBanner || 'N',
        favArticleAuthor: favArticleAuthor || 'N',
        feturedNews: feturedNews || 'N',
        briefDesc: briefDesc || null,
        writerUsername: writerUsername || null,
        writerVerified: true,
        showWriterImage: showWriterImage === true,
      },
    });

    if (languageTitles && Array.isArray(languageTitles)) {
      const languageTitleData = await Promise.all(
        languageTitles.map(async (lt: any) => {
          const language = await prisma.language.findUnique({
            where: { id: lt.languageId, isActive: true },
            select: { id: true },
          });
          
          if (!language) {
            throw new Error(`Language with ID ${lt.languageId} not found or inactive`);
          }
          
          return {
            newsId: news.id,
            languageId: language.id,
            title: lt.title,
          };
        })
      );
      
      await prisma.newsLanguageTitle.createMany({
        data: languageTitleData,
      });
    }

    if (settings) {
      const functionsJson = settings.functions && typeof settings.functions === 'object' 
        ? JSON.stringify(settings.functions)
        : null;
      
      const newsSetting = await prisma.newsSetting.create({
        data: {
          newsId: news.id,
          sectorId: settings.sectorId || null,
          duration: settings.duration ? Math.ceil((new Date(settings.duration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null,
          reshare: settings.reshare || 'N',
          functions: functionsJson,
        },
      });

      if (settings.sports && Array.isArray(settings.sports)) {
        const validSports = settings.sports.filter(
          (sport: string): sport is SportType => isValidSportType(sport)
        );
        if (validSports.length > 0) {
          await prisma.newsSettingSport.createMany({
            data: validSports.map((sport) => ({
              newsSettingId: newsSetting.id,
              sport,
            })),
          });
        }
      }

      if (settings.roles && Array.isArray(settings.roles)) {
        await prisma.newsSettingRole.createMany({
          data: settings.roles.map((role: string) => ({
            newsSettingId: newsSetting.id,
            role: role as any,
          })),
        });
      }

      if (settings.languages && Array.isArray(settings.languages)) {
        const languageSettingData = await Promise.all(
          settings.languages.map(async (langId: string) => {
            const language = await prisma.language.findUnique({
              where: { id: langId, isActive: true },
              select: { id: true },
            });
            
            if (!language) {
              throw new Error(`Language with ID ${langId} not found or inactive`);
            }
            
            return {
              newsSettingId: newsSetting.id,
              languageId: language.id,
            };
          })
        );
        
        await prisma.newsSettingLanguage.createMany({
          data: languageSettingData,
        });
      }

      if (settings.countries && Array.isArray(settings.countries)) {
        await prisma.newsSettingCountry.createMany({
          data: settings.countries.map((country: string) => ({
            newsSettingId: newsSetting.id,
            countryCode: country,
          })),
        });
      }
    }

    if (relatedArticleIds && Array.isArray(relatedArticleIds)) {
      await prisma.newsRelatedArticle.createMany({
        data: relatedArticleIds.map((articleId: string) => ({
          newsId: news.id,
          articleId: articleId,
        })),
      });
    }

    let sharedClubIds: string[] = [];
    if (clubIdToShare) {
      await prisma.clubSharedNews.upsert({
        where: { clubId_newsId: { clubId: clubIdToShare, newsId: news.id } },
        create: {
          clubId: clubIdToShare,
          newsId: news.id,
          sharedById: decoded.userId,
          audienceMode: shareAudienceMode,
        },
        update: { sharedById: decoded.userId, audienceMode: shareAudienceMode },
      });
      sharedClubIds = [clubIdToShare];
    }

    const createdNews = await prisma.news.findUnique({
      where: { id: news.id },
      include: {
        category: true,
        originalLanguage: true,
        languageTitles: {
          include: {
            language: true,
          },
        },
        settings: {
          include: {
            sports: true,
            roles: true,
            languages: {
              include: {
                language: true,
              },
            },
            countries: true,
          },
        },
        relatedArticles: {
          include: {
            article: {
              select: {
                id: true,
                title: true,
                image: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      { ...createdNews, sharedClubIds, clubAudienceMode: clubIdToShare ? shareAudienceMode : undefined },
      { status: 201 },
    );
  } catch (error: any) {
    console.error('Error creating news:', error);
    return NextResponse.json(
      { error: 'Failed to create news', details: error.message },
      { status: 500 }
    );
  }
}
