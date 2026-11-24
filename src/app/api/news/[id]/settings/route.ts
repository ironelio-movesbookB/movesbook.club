import { NextRequest, NextResponse } from 'next/server';
import { SportType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { isValidSportType } from '@/lib/profileSports';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const settings = await prisma.newsSetting.findMany({
      where: { newsId: id },
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
    });

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('Error fetching news settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news settings', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
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

    const { sectorId, duration, reshare, functions, sports, roles, languages, countries } = body;

    await prisma.newsSetting.deleteMany({
      where: { newsId: id },
    });

    const newsSetting = await prisma.newsSetting.create({
      data: {
        newsId: id,
        sectorId: sectorId || null,
        duration: duration || null,
        reshare: reshare || 'N',
        functions: functions ? JSON.stringify(functions) : null,
      },
    });

    if (sports && Array.isArray(sports) && sports.length > 0) {
      const validSports = sports.filter(
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

    if (roles && Array.isArray(roles) && roles.length > 0) {
      await prisma.newsSettingRole.createMany({
        data: roles.map((role: string) => ({
          newsSettingId: newsSetting.id,
          role: role as any,
        })),
      });
    }

    if (languages && Array.isArray(languages) && languages.length > 0) {
      await prisma.newsSettingLanguage.createMany({
        data: languages.map((langId: string) => ({
          newsSettingId: newsSetting.id,
          languageId: langId,
        })),
      });
    }

    if (countries && Array.isArray(countries) && countries.length > 0) {
      await prisma.newsSettingCountry.createMany({
        data: countries.map((country: string) => ({
          newsSettingId: newsSetting.id,
          countryCode: country,
        })),
      });
    }

    const createdSettings = await prisma.newsSetting.findUnique({
      where: { id: newsSetting.id },
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
    });

    return NextResponse.json(createdSettings);
  } catch (error: any) {
    console.error('Error saving news settings:', error);
    return NextResponse.json(
      { error: 'Failed to save news settings', details: error.message },
      { status: 500 }
    );
  }
}
