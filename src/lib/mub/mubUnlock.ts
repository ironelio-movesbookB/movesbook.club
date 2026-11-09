import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import type { NextRequest } from 'next/server';

/**
 * Server-side proof that the caller passed the MUB gear-password gate.
 *
 * `verify-access` issues this after a correct password; every MUB write route
 * requires it. Before this existed the gate lived only in the browser, so any
 * logged-in token could edit MUB pages by calling the API directly.
 *
 * - Signed with a key derived from (not equal to) the login JWT secret, so an
 *   unlock token can never be accepted by `verifyToken` as a login token.
 * - Bound to the login token it was issued for (`afp`): logging out and back in,
 *   or another account in the same tab, invalidates it.
 */
export type MubUnlockAccess = 'user' | 'club' | 'staff';

export const MUB_UNLOCK_HEADER = 'x-mub-unlock';
const MUB_UNLOCK_TTL_SECONDS = 8 * 60 * 60;

function unlockKey(): string {
  const base = process.env.JWT_SECRET || 'movesbook-nextjs-jwt-secret-key-2024';
  return createHash('sha256').update(`${base}:mub-unlock`).digest('hex');
}

function bearerOf(request: NextRequest): string | null {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  return token || null;
}

function authFingerprint(bearer: string): string {
  return createHash('sha256').update(bearer).digest('hex').slice(0, 32);
}

export function issueMubUnlock(
  request: NextRequest,
  userId: string,
  access: MubUnlockAccess,
): { unlockToken: string; expiresAt: number } {
  const bearer = bearerOf(request) ?? '';
  const unlockToken = jwt.sign(
    { sub: userId, access, afp: authFingerprint(bearer), purpose: 'mub-unlock' },
    unlockKey(),
    { algorithm: 'HS256', expiresIn: MUB_UNLOCK_TTL_SECONDS },
  );
  return { unlockToken, expiresAt: Date.now() + MUB_UNLOCK_TTL_SECONDS * 1000 };
}

/** The unlock level the request carries for `userId`, or null when it has none. */
export function getMubUnlockAccess(request: NextRequest, userId: string): MubUnlockAccess | null {
  const raw = request.headers.get(MUB_UNLOCK_HEADER);
  const bearer = bearerOf(request);
  if (!raw || !bearer) return null;
  try {
    const decoded = jwt.verify(raw, unlockKey(), { algorithms: ['HS256'] }) as jwt.JwtPayload;
    if (decoded.purpose !== 'mub-unlock') return null;
    if (decoded.sub !== userId) return null;
    if (decoded.afp !== authFingerprint(bearer)) return null;
    const access = decoded.access;
    return access === 'user' || access === 'club' || access === 'staff' ? access : null;
  } catch {
    return null;
  }
}

export const MUB_UNLOCK_REQUIRED = 'mub_unlock_required';
