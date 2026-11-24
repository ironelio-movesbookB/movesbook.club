import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { resolveMessageDatabaseUserId } from '@/lib/messages/resolveMessageUserId';
import { normalizeTelegramAccount } from '@/lib/profileSports';
import {
  assertTelegramAccountAvailable,
  isTelegramAccountTakenError,
  TELEGRAM_ACCOUNT_TAKEN_MESSAGE,
} from '@/lib/telegramAccountUnique';

async function resolveAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;

  const userType = decoded.userType != null ? String(decoded.userType) : undefined;
  return resolveMessageDatabaseUserId(String(decoded.userId), userType);
}

/**
 * GET - Get user's Telegram account
 * Supports normal users and super-admin / staff tokens (resolved to users_new).
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await resolveAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramAccount: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ telegramAccount: user.telegramAccount });
  } catch (error) {
    console.error('Error fetching Telegram account:', error);
    return NextResponse.json({ error: 'Failed to fetch Telegram account' }, { status: 500 });
  }
}

/**
 * POST/PUT - Save or update user's Telegram account
 * Supports normal users and super-admin / staff tokens (resolved to users_new).
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await resolveAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const body = await request.json();
    const telegramAccount = normalizeTelegramAccount(String(body?.telegramAccount ?? ''));

    if (body?.telegramAccount && !telegramAccount) {
      return NextResponse.json(
        {
          error: 'Telegram account is required',
          success: false,
        },
        { status: 400 }
      );
    }

    await assertTelegramAccountAvailable(telegramAccount, userId);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { telegramAccount },
      select: { id: true, telegramAccount: true },
    });

    return NextResponse.json({
      success: true,
      telegramAccount: updatedUser.telegramAccount,
    });
  } catch (error) {
    if (isTelegramAccountTakenError(error)) {
      return NextResponse.json(
        { error: TELEGRAM_ACCOUNT_TAKEN_MESSAGE, success: false },
        { status: 409 }
      );
    }
    // Unique index race (when DB unique is applied)
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: TELEGRAM_ACCOUNT_TAKEN_MESSAGE, success: false },
        { status: 409 }
      );
    }
    console.error('Error saving Telegram account:', error);
    return NextResponse.json(
      {
        error: 'Failed to save Telegram account',
        success: false,
      },
      { status: 500 }
    );
  }
}
