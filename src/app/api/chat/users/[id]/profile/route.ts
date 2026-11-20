import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { resolveMessageDatabaseUserId } from '@/lib/messages/resolveMessageUserId';
import { calcAge } from '@/lib/club/memberProfileDefaults';
import { formatSportLabel } from '@/lib/profileSports';
import { flagEmojiFromCountryName } from '@/lib/admin/countryFlag';

export const dynamic = 'force-dynamic';

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

/**
 * GET - Public-ish chat peer profile from users_new (for the chat User Info sidebar).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    const decoded = verifyToken(authHeader.replace('Bearer ', ''));
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const myId = await resolveMessageDatabaseUserId(decoded.userId, decoded.userType);
    if (!myId) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const peerId = String(params.id ?? '').trim();
    if (!peerId) {
      return NextResponse.json({ error: 'User id required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: peerId },
      select: {
        id: true,
        name: true,
        firstName: true,
        surname: true,
        username: true,
        telegramAccount: true,
        image: true,
        country: true,
        gender: true,
        birthdate: true,
        userType: true,
        lastSeenAt: true,
        youtubeChannelUrl: true,
        mainSports: {
          select: { sport: true, order: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const birthIso = user.birthdate ? user.birthdate.toISOString().slice(0, 10) : null;
    const isOnline =
      user.lastSeenAt != null && Date.now() - user.lastSeenAt.getTime() < ONLINE_THRESHOLD_MS;
    const sports = user.mainSports.map((s) => formatSportLabel(s.sport));
    const fullName =
      [user.firstName, user.surname].filter((p) => p && String(p).trim()).join(' ').trim() ||
      user.name;

    return NextResponse.json({
      id: user.id,
      name: user.name,
      fullName,
      firstName: user.firstName,
      surname: user.surname,
      username: user.username,
      telegramAccount: user.telegramAccount,
      image: user.image,
      country: user.country,
      countryFlag: flagEmojiFromCountryName(user.country),
      gender: user.gender,
      birthdate: birthIso,
      age: calcAge(birthIso),
      userType: user.userType,
      youtubeChannelUrl: user.youtubeChannelUrl,
      sports,
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      isOnline,
    });
  } catch (error) {
    console.error('Chat peer profile GET:', error);
    return NextResponse.json({ error: 'Failed to load user profile' }, { status: 500 });
  }
}
