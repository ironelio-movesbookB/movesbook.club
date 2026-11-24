import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const CLUB_ADMIN_TYPES = new Set(['CLUB', 'CLUB_TRAINER']);

export async function requireClubAdmin(
  request: NextRequest,
): Promise<{ userId: string; username: string } | NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = verifyToken(authHeader.slice(7));
  if (!decoded?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, username: true, userType: true },
  });

  if (!user || !CLUB_ADMIN_TYPES.has(user.userType)) {
    return NextResponse.json({ error: 'Club admin only' }, { status: 403 });
  }

  return { userId: user.id, username: user.username };
}

export async function verifyClubAdminPassword(
  userId: string,
  password: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });
  if (!user) return false;
  return verifyPassword(password, user.password);
}

export async function verifyClubOwnership(
  userId: string,
  clubId: string,
): Promise<boolean> {
  const club = await prisma.club.findFirst({
    where: { id: clubId, adminId: userId },
    select: { id: true },
  });
  return Boolean(club);
}

export type { ClubOgpAudienceMode } from '@/lib/clubOgpAudience';
export {
  CLUB_OGP_AUDIENCE_MODES,
  isClubOgpAudienceMode,
  parseJsonStringArray,
  canViewerSeeClubSharedOgp,
  newsSettingsToClubVisibility,
} from '@/lib/clubOgpAudience';

export type ClubSharedFeedItem =
  | {
      kind: 'news';
      id: string;
      shareId: string;
      title: string | null;
      date: string;
      author: string | null;
      /** Creator user id when known (for posted-by filters). */
      posterUserId?: string | null;
      creatorCountry?: string | null;
      expiresAt?: string | null;
      deletedAt?: string | null;
      categoryName: string | null;
      method: string | null;
      image: string | null;
      briefDesc: string | null;
      internetLink: string | null;
      sharedAt: string;
      inClubGlobalNews: boolean;
    }
  | {
      kind: 'ogp';
      id: string;
      shareId: string;
      title: string | null;
      date: string;
      topic: string;
      creatorUsername: string | null;
      /** Creator user id when known (for posted-by filters). */
      posterUserId?: string | null;
      creatorCountry?: string | null;
      expiresAt?: string | null;
      deletedAt?: string | null;
      image: string | null;
      url: string;
      description: string | null;
      customDescription: string | null;
      /** Visibility language codes (for Language filter), empty = all. */
      languages?: string[];
      sharedAt: string;
      inClubGlobalNews: boolean;
    }
  | {
      kind: 'ogp-group';
      id: string;
      shareId: string;
      title: string | null;
      date: string;
      topic: string;
      creatorUsername: string | null;
      /** Creator user id when known (for posted-by filters). */
      posterUserId?: string | null;
      creatorCountry?: string | null;
      expiresAt?: string | null;
      deletedAt?: string | null;
      image: string | null;
      url: string;
      description: string | null;
      customDescription: string | null;
      memberCount: number;
      /** Visibility language codes (for Language filter), empty = all. */
      languages?: string[];
      sharedAt: string;
      inClubGlobalNews: boolean;
    };
