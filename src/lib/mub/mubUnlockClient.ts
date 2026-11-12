/**
 * Browser-side storage for the MUB unlock token issued by `/api/mub/verify-access`.
 *
 * Kept in sessionStorage (per tab) and tied to the login token it was issued for,
 * so a different login in the same tab starts locked. The server checks the same
 * binding; this copy only decides whether to show the password gate.
 */
/** `admin` = Super Admin working from the admin panel (/admin/mub), bound to `adminToken`. */
export type MubUnlockKind = 'edit' | 'staff' | 'admin';

const KEYS: Record<MubUnlockKind, string> = {
  edit: 'mub:unlock:user',
  staff: 'mub:unlock:staff',
  admin: 'mub:unlock:admin',
};

/** localStorage key of the login token each unlock kind is bound to. */
export function mubAuthTokenKey(kind: MubUnlockKind): 'token' | 'adminToken' {
  return kind === 'admin' ? 'adminToken' : 'token';
}

type StoredUnlock = { token: string; expiresAt: number; authTail: string };

function currentAuthTail(kind: MubUnlockKind): string {
  try {
    return (localStorage.getItem(mubAuthTokenKey(kind)) ?? '').slice(-32);
  } catch {
    return '';
  }
}

export function readMubUnlock(kind: MubUnlockKind): string | null {
  try {
    const raw = sessionStorage.getItem(KEYS[kind]);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredUnlock;
    const authTail = currentAuthTail(kind);
    if (!stored.token || !authTail || stored.authTail !== authTail || stored.expiresAt <= Date.now()) {
      sessionStorage.removeItem(KEYS[kind]);
      return null;
    }
    return stored.token;
  } catch {
    return null;
  }
}

export function writeMubUnlock(kind: MubUnlockKind, token: string, expiresAt: number) {
  try {
    const stored: StoredUnlock = { token, expiresAt, authTail: currentAuthTail(kind) };
    sessionStorage.setItem(KEYS[kind], JSON.stringify(stored));
  } catch {
    /* private mode — the user re-enters the password on the next page */
  }
}

export function clearMubUnlock(kind?: MubUnlockKind) {
  try {
    for (const k of kind ? [kind] : (Object.keys(KEYS) as MubUnlockKind[])) {
      sessionStorage.removeItem(KEYS[k]);
    }
    // Pre-token flags from the previous implementation.
    sessionStorage.removeItem('mub:unlocked:user');
    sessionStorage.removeItem('mub:unlocked:staff');
  } catch {
    /* ignore */
  }
}
