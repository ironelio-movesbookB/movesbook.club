import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getDashboardPathForUserType } from '@/utils/dashboardRouting';
import {
  clearEntityCompanyLoginSession,
  clearEntityDirectAccessLock,
  setEntityCompanyLoginSession,
  setEntityDirectAccessLock,
} from '@/lib/entity/entityDirectAccessSession';
import type { EntityDirectAccessKind } from '@/lib/entity/entityDirectAccessMeta';
import { clearClubWorkspaceSessionOnLogout } from '@/lib/club/clearClubWorkspaceSession';
import {
  MEMBER_NOTE_LOGIN_EVENT,
  MEMBER_NOTE_LOGIN_FLAG,
  MEMBER_NOTE_LOGOUT_DONE_EVENT,
  MEMBER_NOTE_LOGOUT_EVENT,
} from '@/components/club/memberProfile/MemberNotePopupHost';

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  userType: string;
  country?: string | null;
  image?: string | null;
  language?: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [redirectAfterLogin, setRedirectAfterLogin] = useState<string | null>(null);
  const router = useRouter();
  const logoutInFlight = useRef(false);

  const finishLogout = useCallback(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        void fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => undefined);
      }
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      clearEntityDirectAccessLock();
      clearEntityCompanyLoginSession();
      clearClubWorkspaceSessionOnLogout();
    }
    setUser(null);
    logoutInFlight.current = false;
    router.push('/');
  }, [router]);

  const logout = useCallback(() => {
    if (typeof window === 'undefined') {
      finishLogout();
      return;
    }
    if (logoutInFlight.current) return;
    logoutInFlight.current = true;

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallbackTimer);
      window.removeEventListener(MEMBER_NOTE_LOGOUT_DONE_EVENT, onDone);
      finishLogout();
    };

    const onDone = () => settle();
    window.addEventListener(MEMBER_NOTE_LOGOUT_DONE_EVENT, onDone);
    window.dispatchEvent(new Event(MEMBER_NOTE_LOGOUT_EVENT));

    // Fallback if host does not respond (e.g. no docs / fetch hang).
    const fallbackTimer = window.setTimeout(() => {
      if (logoutInFlight.current) settle();
    }, 8000);
  }, [finishLogout]);

  const checkAuth = useCallback(async () => {
    try {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');

        if (token && userData) {
          setUser(JSON.parse(userData));
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      finishLogout();
    } finally {
      setLoading(false);
    }
  }, [finishLogout]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = (
    token: string,
    userData: AuthUser,
    redirectPath?: string | null,
    options?: {
      entityAccessMode?: string;
      entityKind?: EntityDirectAccessKind;
      entityId?: string;
      /** @deprecated Use entityAccessMode + entityKind + entityId */
      clubAccessMode?: string;
      clubId?: string;
    },
  ) => {
    if (typeof window !== 'undefined') {
      // Drop previous account's workspace hints before binding a new session.
      clearClubWorkspaceSessionOnLogout();
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      sessionStorage.setItem(MEMBER_NOTE_LOGIN_FLAG, 'login');
      window.dispatchEvent(new Event(MEMBER_NOTE_LOGIN_EVENT));
      const mode = options?.entityAccessMode ?? options?.clubAccessMode;
      const kind = options?.entityKind ?? (options?.clubId ? 'club' : undefined);
      const entityId = options?.entityId ?? options?.clubId;
      if (mode === 'direct-access-only' && kind && entityId) {
        setEntityDirectAccessLock(kind, entityId);
      } else if (mode === 'company-password' && kind && entityId) {
        clearEntityDirectAccessLock();
        setEntityCompanyLoginSession(kind, entityId);
      } else {
        clearEntityDirectAccessLock();
        clearEntityCompanyLoginSession();
      }
    }
    setUser(userData);
    setShowLoginModal(false);

    let destination = redirectPath?.trim() || null;
    if (!destination && userData.userType === 'ADMIN' && redirectAfterLogin) {
      destination = redirectAfterLogin;
      setRedirectAfterLogin(null);
    }
    if (!destination) {
      destination = getDashboardPathForUserType(userData.userType);
    }

    router.push(destination);
  };

  const requireAuth = (redirectPath: string) => {
    if (!user) {
      setRedirectAfterLogin(redirectPath);
      setShowLoginModal(true);
      return false;
    }
    return true;
  };

  return {
    user,
    loading,
    login,
    logout,
    showLoginModal,
    setShowLoginModal,
    requireAuth,
    redirectAfterLogin,
    isAuthenticated: !!user
  };
}
