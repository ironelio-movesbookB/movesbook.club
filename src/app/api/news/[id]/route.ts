import { NextRequest, NextResponse } from 'next/server';
import { SportType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { requireAuthWithUser } from '@/app/api/news/auth';
import { isValidSportType } from '@/lib/profileSports';
import * as serialize from 'php-serialize';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const news = await prisma.news.findUnique({
      where: { id },
      include: {
        category: true,
        originalLanguage: true,
        languageTitles: {
          include: {
            language: true,
          },
        },
        settings: {
          select: {
            id: true,
            functions: true,
            reshare: true,
            duration: true,
            sports: {
              select: {
                sport: true,
              },
            },
            roles: {
              select: {
                role: true,
              },
            },
            languages: {
              select: {
                language: {
                  select: {
                    id: true,
                  },
                },
                languageId: true,
              },
            },
            countries: {
              select: {
                countryCode: true,
              },
            },
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
                section: true,
              },
            },
          },
        },
      },
    });

    if (!news) {
      return NextResponse.json({ error: 'News not found' }, { status: 404 });
    }

    return NextResponse.json(news);
  } catch (error: any) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
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
      mode,
      internetLink,
      internetLinkEditor,
      pageOption,
      displayMode,
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
      comments,
      favArticleAuthor,
      feturedNews,
      briefDesc,
      writerUsername,
      writerVerified,
      showWriterImage,
      languageTitles,
      settings,
      relatedArticleIds,
    } = body;

    const existingNews = await prisma.news.findUnique({
      where: { id },
    });

    if (!existingNews) {
      return NextResponse.json({ error: 'News not found' }, { status: 404 });
    }

    let actualLangValueId: string | null = null;
    if (langValueId !== undefined) {
      if (langValueId) {
        const language = await prisma.language.findUnique({
          where: { id: langValueId, isActive: true },
          select: { id: true },
        });
        if (language) {
          actualLangValueId = language.id;
        } else {
          return NextResponse.json({ error: `Language with ID ${langValueId} not found or inactive` }, { status: 400 });
        }
      } else {
        actualLangValueId = null;
      }
    } else {
      actualLangValueId = existingNews.langValueId;
    }

    const updateData: any = {};

    if (date !== undefined) updateData.date = new Date(date);
    if (langValueId !== undefined) updateData.langValueId = actualLangValueId;
    if (documentType !== undefined) updateData.documentType = documentType;
    if (title !== undefined) updateData.title = title;
    if (newsCategoryId !== undefined) updateData.newsCategoryId = newsCategoryId;
    if (section !== undefined) updateData.section = section;
    if (image !== undefined) updateData.image = image;
    if (bannerImage !== undefined) updateData.bannerImage = bannerImage;
    if (author !== undefined) updateData.author = author;
    if (originalAuthor !== undefined) updateData.originalAuthor = originalAuthor;
    if (priority !== undefined) updateData.priority = priority;
    if (content !== undefined) {
      if (typeof content === 'object' && content !== null) {
        const serialized = serialize.serialize(content);
        updateData.content = Buffer.from(serialized).toString('base64');
      } else if (typeof content === 'string') {
        updateData.content = content;
      }
    }
    if (mode !== undefined) updateData.mode = mode;
    if (internetLink !== undefined) updateData.internetLink = internetLink;
    if (internetLinkEditor !== undefined) updateData.internetLinkEditor = internetLinkEditor;
    if (pageOption !== undefined) updateData.pageOption = pageOption;
    if (displayMode !== undefined) updateData.displayMode = displayMode;
    if (searchingKeywords !== undefined) updateData.searchingKeywords = searchingKeywords;
    if (method !== undefined) updateData.method = method;
    if (shareEnable !== undefined) updateData.shareEnable = shareEnable;
    if (shareCommentOption !== undefined) updateData.shareCommentOption = shareCommentOption;
    if (visualizeInReadingPageAuthorName !== undefined)
      updateData.visualizeInReadingPageAuthorName = visualizeInReadingPageAuthorName;
    if (visualizeInReadingPageActualAuthorName !== undefined)
      updateData.visualizeInReadingPageActualAuthorName = visualizeInReadingPageActualAuthorName;
    if (inLastNews !== undefined) updateData.inLastNews = inLastNews;
    if (editableAdmin !== undefined) updateData.editableAdmin = editableAdmin;
    if (editableOperators !== undefined) updateData.editableOperators = editableOperators;
    if (editableUsers !== undefined) updateData.editableUsers = editableUsers;
    if (editableTranslators !== undefined) updateData.editableTranslators = editableTranslators;
    if (enableCheck !== undefined) updateData.enableCheck = enableCheck;
    if (checkedBanner !== undefined) updateData.checkedBanner = checkedBanner;
    if (comments !== undefined) updateData.comments = comments;
    if (favArticleAuthor !== undefined) updateData.favArticleAuthor = favArticleAuthor;
    if (feturedNews !== undefined) updateData.feturedNews = feturedNews;
    if (briefDesc !== undefined) updateData.briefDesc = briefDesc;
    if (writerUsername !== undefined) updateData.writerUsername = writerUsername;
    if (writerVerified !== undefined) updateData.writerVerified = writerVerified;
    if (showWriterImage !== undefined) updateData.showWriterImage = showWriterImage === true;

    const news = await prisma.news.update({
      where: { id },
      data: updateData,
    });

    if (languageTitles && Array.isArray(languageTitles)) {
      await prisma.newsLanguageTitle.deleteMany({
        where: { newsId: id },
      });

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
            newsId: id,
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
      await prisma.newsSetting.deleteMany({
        where: { newsId: id },
      });

      const functionsJson = settings.functions && typeof settings.functions === 'object' 
        ? JSON.stringify(settings.functions)
        : (settings.functions || null);

      const newsSetting = await prisma.newsSetting.create({
        data: {
          newsId: id,
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
      await prisma.newsRelatedArticle.deleteMany({
        where: { newsId: id },
      });

      await prisma.newsRelatedArticle.createMany({
        data: relatedArticleIds.map((articleId: string) => ({
          newsId: id,
          articleId: articleId,
        })),
      });
    }

    const updatedNews = await prisma.news.findUnique({
      where: { id },
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

    return NextResponse.json(updatedNews);
  } catch (error: any) {
    console.error('Error updating news:', error);
    return NextResponse.json(
      { error: 'Failed to update news', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthWithUser(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const existingNews = await prisma.news.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingNews) {
      return NextResponse.json({ error: 'News not found' }, { status: 404 });
    }

    const isOwner = existingNews.userId === auth.userId;
    if (!isOwner && !auth.isAdmin && !auth.isSuperAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await prisma.news.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'News deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting news:', error);
    return NextResponse.json(
      { error: 'Failed to delete news', details: error.message },
      { status: 500 }
    );
  }
}
