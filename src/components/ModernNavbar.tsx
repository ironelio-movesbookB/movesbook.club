'use client';

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Home, 
  User, 
  Users, 
  Phone,
  Mail,
  Facebook,
  Linkedin,
  Instagram,
  Twitter,
  Menu,
  X,
  Globe,
  Dumbbell,
  LogOut,
  User as UserIcon,
  Shield,
  Trophy,
  Briefcase,
  UserCircle,
  Users2,
  Building2,
  MessageCircle,
  Newspaper,
  ShoppingCart,
  Megaphone,
  ShoppingBag,
  Search,
  Music,
  ListMusic
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePcuAlert } from '@/contexts/PcuAlertContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  fetchPcuAlert,
  shouldShowPcuAtLogin,
  storePendingPcuAlert,
} from '@/lib/user/pcuAlertClient';
import { getDashboardPathForUserType, isClubAccountUserType } from '@/utils/dashboardRouting';
import { clearClubWorkspaceSessionOnLogout } from '@/lib/club/clearClubWorkspaceSession';
import SuggestMovesbookLoginPrompt from '@/components/promocodes/SuggestMovesbookLoginPrompt';
import { persistAdminLoginSession } from '@/lib/panelSession';
import QuickMenuButton from '@/app/my-page/components/QuickMenuButton';

// Map language codes to flag file names
const getFlagFileName = (code: string): string => {
  const flagMap: Record<string, string> = {
    'en': 'en.png',
    'fr': 'fr.png',
    'de': 'de.png',
    'it': 'it.png',
    'es': 'es.png',
    'pt': 'por.png',
    'ru': 'rus.png',
    'hi': 'ind.png',
    'zh': 'chin.png',
    'ar': 'arab.png',
    'ja': 'jap.png',      // Japanese flag
    'id': 'id.png',       // Indonesian flag
  };
  return flagMap[code] || 'en.png';
};

interface ModernNavbarProps {
  onLoginClick?: () => void;
  onAdminClick?: () => void;
  /** Hide content nav, network search, and login/user actions (e.g. public OGP group share page). */
  hideContentNav?: boolean;
}

type NetworkSearchResultItem = {
  kind: 'user' | 'team' | 'club';
  id: string;
  title: string;
  username: string | null;
  categoryLabel: string;
  lines: string[];
  image: string | null;
};

function networkSearchVisitorHref(
  item: NetworkSearchResultItem,
  source?: 'mainpage'
): string {
  const slug =
    item.kind === 'user'
      ? (item.username?.trim() || item.id)
      : item.title.trim() || item.id;
  const base = `/searchresults/search/${encodeURIComponent(slug)}`;
  return source === 'mainpage' ? `${base}?source=mainpage` : base;
}

export default function ModernNavbar({ onLoginClick, onAdminClick, hideContentNav = false }: ModernNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAuthenticated, requireAuth, login } = useAuth();
  const { showAlert } = usePcuAlert();
  const { currentLanguage, setLanguage, t, availableLanguages } = useLanguage();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'username' | 'question' | 'reset'>('username');
  const [forgotPasswordUsername, setForgotPasswordUsername] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotPasswordError, setForgotPasswordError] = useState('');
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState('');

  const [networkSearchScope, setNetworkSearchScope] = useState<
    'single_user' | 'coach' | 'team' | 'club'
  >('single_user');
  const [networkSearchQuery, setNetworkSearchQuery] = useState('');
  const [networkSearchModalOpen, setNetworkSearchModalOpen] = useState(false);
  const [networkSearchLoading, setNetworkSearchLoading] = useState(false);
  const [networkSearchError, setNetworkSearchError] = useState<string | null>(null);
  const [networkSearchItems, setNetworkSearchItems] = useState<NetworkSearchResultItem[]>([]);
  const [networkSearchTotal, setNetworkSearchTotal] = useState(0);
  const [networkSearchActiveQuery, setNetworkSearchActiveQuery] = useState('');
  const [networkSearchPopoverAnchor, setNetworkSearchPopoverAnchor] = useState<'desktop' | 'mobile'>(
    'desktop'
  );
  const [networkSearchPopoverStyle, setNetworkSearchPopoverStyle] = useState<React.CSSProperties | null>(
    null
  );

  const languageDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const networkSearchDesktopInputWrapRef = useRef<HTMLDivElement>(null);
  const networkSearchMobileInputWrapRef = useRef<HTMLDivElement>(null);
  /** Captured when opening from mobile menu so layout survives menu close (input unmounts). */
  const networkSearchMobileRectSnapshotRef = useRef<DOMRect | null>(null);

  // Check if admin is logged in
  useEffect(() => {
    const checkAdminStatus = () => {
      const adminData = localStorage.getItem('adminUser');
      if (adminData) {
        setIsAdmin(true);
        setAdminUser(JSON.parse(adminData));
      } else {
        setIsAdmin(false);
        setAdminUser(null);
      }
    };
    
    checkAdminStatus();
    
    // Listen for storage changes
    window.addEventListener('storage', checkAdminStatus);
    return () => window.removeEventListener('storage', checkAdminStatus);
  }, []);

  // Track last visited page for each user type
  useEffect(() => {
    if (typeof window !== 'undefined' && pathname) {
      // Save last visited page for each user type
      if (pathname.startsWith('/admin/')) {
        localStorage.setItem('lastAdminPage', pathname);
      } else if (pathname.startsWith('/athlete/')) {
        localStorage.setItem('lastAthletePage', pathname);
      } else if (pathname.startsWith('/coach/')) {
        localStorage.setItem('lastCoachPage', pathname);
      } else if (pathname.startsWith('/team/')) {
        localStorage.setItem('lastTeamPage', pathname);
      } else if (pathname.startsWith('/group/')) {
        localStorage.setItem('lastGroupPage', pathname);
      } else if (pathname.startsWith('/club/')) {
        localStorage.setItem('lastClubPage', pathname);
      }
    }
  }, [pathname]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setIsLanguageDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /** CLUB accounts use their own dashboard; athlete URL would redirect them away from OGP/News. */
  const navNewsHref =
    user && isClubAccountUserType(user.userType)
      ? '/club/dashboard?open=news'
      : '/athlete/dashboard?open=news';

  const isOpenNewsNavHref = (href: string) =>
    href === '/athlete/dashboard?open=news' || href === '/club/dashboard?open=news';

  /** Open My Music in the athlete dashboard middle area (same pattern as News). */
  const navMusicHref =
    user && isClubAccountUserType(user.userType)
      ? '/music-panel'
      : '/athlete/dashboard?open=music';

  const isOpenMusicNavHref = (href: string) =>
    href === '/athlete/dashboard?open=music' || href === '/music-panel';

  /** Open Music OGP editor (same as "Add/edit my music" on My Music panel). */
  const navAddSongsHref =
    user && isClubAccountUserType(user.userType)
      ? '/add-songs'
      : '/athlete/dashboard?open=add-songs';

  const isOpenAddSongsNavHref = (href: string) =>
    href === '/athlete/dashboard?open=add-songs' || href === '/add-songs';

  const menuItems = useMemo(
    () => [
      { href: '/', label: t('nav_home'), icon: Home },
      // Removed non-existent routes: /athletes, /coaches, /teams, /groups, /clubs
      { href: '/testimonials', label: t('nav_testimonials'), icon: MessageCircle },
      { href: '/blog', label: t('nav_blog'), icon: MessageCircle },
      { href: navNewsHref, label: t('nav_news'), icon: Newspaper },
      { href: '/news-by-movesbook', label: t('nav_news_by_movesbook'), icon: Newspaper },
      { href: '/sell-buy', label: t('nav_sell_buy_short'), icon: ShoppingCart },
      { href: '/job-offers', label: t('nav_jobs_short'), icon: Briefcase },
      { href: '/promote-yourself', label: t('nav_promote_short'), icon: Megaphone },
      { href: '/our-shop', label: t('nav_shop_short'), icon: ShoppingBag },
      { href: navAddSongsHref, label: t('nav_songs_short'), icon: ListMusic },
      { href: navMusicHref, label: t('nav_music_short'), icon: Music },
    ],
    [navNewsHref, navAddSongsHref, navMusicHref, t]
  );

  const socialLinks = [
    { icon: Facebook, href: '#', label: 'Facebook', color: 'hover:text-blue-400' },
    { icon: Linkedin, href: '#', label: 'LinkedIn', color: 'hover:text-blue-500' },
    { icon: Instagram, href: '#', label: 'Instagram', color: 'hover:text-pink-500' },
    { icon: Twitter, href: '#', label: 'Twitter', color: 'hover:text-blue-400' },
  ];

  // Get current language display code
  const currentLangDisplay = currentLanguage.toUpperCase();

  const handleLogout = async () => {
    setIsUserDropdownOpen(false);
    setIsMobileMenuOpen(false);
    const lang = user?.language || currentLanguage || 'en';
    const alert = await fetchPcuAlert('logout', lang);
    // Do not navigate here — useAuth.logout() waits for logout notices, then redirects.
    if (alert) {
      showAlert(alert, () => logout());
    } else {
      logout();
    }
  };

  const networkSearchScopeLabel = useMemo(() => {
    switch (networkSearchScope) {
      case 'single_user':
        return t('nav_search_scope_single_user');
      case 'coach':
        return t('nav_search_scope_coach');
      case 'team':
        return t('nav_search_scope_team');
      case 'club':
        return t('nav_search_scope_club');
      default:
        return networkSearchScope;
    }
  }, [networkSearchScope, t]);

  const runNetworkSearch = useCallback(async (anchor: 'desktop' | 'mobile' = 'desktop') => {
    setNetworkSearchPopoverAnchor(anchor);
    if (anchor === 'mobile' && networkSearchMobileInputWrapRef.current) {
      networkSearchMobileRectSnapshotRef.current =
        networkSearchMobileInputWrapRef.current.getBoundingClientRect();
    } else if (anchor === 'desktop') {
      networkSearchMobileRectSnapshotRef.current = null;
    }
    const q = networkSearchQuery.trim();
    setNetworkSearchModalOpen(true);
    setNetworkSearchError(null);
    setNetworkSearchItems([]);
    setNetworkSearchTotal(0);
    setNetworkSearchActiveQuery(q);

    if (!q) {
      setNetworkSearchLoading(false);
      setNetworkSearchError(t('nav_network_search_query_required'));
      return;
    }

    setNetworkSearchLoading(true);
    try {
      const res = await fetch(
        `/api/network-search?q=${encodeURIComponent(q)}&scope=${encodeURIComponent(networkSearchScope)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNetworkSearchError(
          typeof data?.error === 'string' ? data.error : t('nav_network_search_error')
        );
        return;
      }
      setNetworkSearchItems(Array.isArray(data.items) ? data.items : []);
      setNetworkSearchTotal(typeof data.total === 'number' ? data.total : 0);
    } catch {
      setNetworkSearchError(t('nav_network_search_error'));
    } finally {
      setNetworkSearchLoading(false);
    }
  }, [networkSearchQuery, networkSearchScope, t]);

  const handleNetworkSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const anchor =
      e.currentTarget.dataset.searchAnchor === 'mobile' ? 'mobile' : 'desktop';
    void runNetworkSearch(anchor);
    setIsMobileMenuOpen(false);
  };

  useLayoutEffect(() => {
    if (!networkSearchModalOpen) {
      networkSearchMobileRectSnapshotRef.current = null;
      setNetworkSearchPopoverStyle(null);
      return;
    }

    const position = () => {
      let r: DOMRect | null = null;
      if (networkSearchPopoverAnchor === 'mobile') {
        r =
          networkSearchMobileInputWrapRef.current?.getBoundingClientRect() ??
          networkSearchMobileRectSnapshotRef.current;
      } else {
        r = networkSearchDesktopInputWrapRef.current?.getBoundingClientRect() ?? null;
      }
      if (!r) {
        setNetworkSearchPopoverStyle({
          position: 'fixed',
          top: 88,
          left: 16,
          width: 384,
          maxHeight: 400,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        });
        return;
      }
      const minW = 280;
      const maxW = 448;
      const width = Math.min(maxW, Math.max(minW, r.width));
      let left = r.right - width;
      left = Math.min(Math.max(8, left), window.innerWidth - width - 8);
      const top = r.bottom + 6;
      const maxHeight = Math.max(200, Math.min(512, window.innerHeight - top - 12));
      setNetworkSearchPopoverStyle({
        position: 'fixed',
        top,
        left,
        width,
        maxHeight,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      });
    };

    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [networkSearchModalOpen, networkSearchPopoverAnchor]);

  useEffect(() => {
    if (!networkSearchModalOpen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setNetworkSearchModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [networkSearchModalOpen]);

  const handleAdminLogout = async () => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      try {
        await fetch('/api/auth/admin/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        /* continue clearing local session */
      }
    }
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setIsAdmin(false);
    setAdminUser(null);
    setIsUserDropdownOpen(false);
    setIsMobileMenuOpen(false);

    router.push('/');
  };

  const handleProtectedLinkClick = (href: string, event: React.MouseEvent) => {
    // All navigation items are now public - no protection needed
    setIsMobileMenuOpen(false);
  };

  const handleForgotPasswordClick = () => {
    setShowForgotPasswordModal(true);
    setForgotPasswordStep('username');
    setForgotPasswordUsername('');
    setSecurityQuestion('');
    setSecurityAnswer('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotPasswordError('');
    setForgotPasswordSuccess('');
    setIsMobileMenuOpen(false);
  };

  const handleForgotPasswordSubmit = async () => {
    setForgotPasswordError('');
    setForgotPasswordSuccess('');

    if (forgotPasswordStep === 'username') {
      if (!forgotPasswordUsername.trim()) {
        setForgotPasswordError('Please enter your username or email');
        return;
      }

      try {
        const response = await fetch('/api/auth/get-security-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: forgotPasswordUsername })
        });

        const data = await response.json();

        if (response.ok && data.question) {
          setSecurityQuestion(data.question);
          setForgotPasswordStep('question');
        } else {
          setForgotPasswordError(data.error || 'User not found or no security question set');
        }
      } catch (error) {
        setForgotPasswordError('Failed to retrieve security question');
      }
    } else if (forgotPasswordStep === 'question') {
      if (!securityAnswer.trim()) {
        setForgotPasswordError('Please answer the security question');
        return;
      }

      try {
        const response = await fetch('/api/auth/verify-security-answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: forgotPasswordUsername,
            answer: securityAnswer
          })
        });

        const data = await response.json();

        if (response.ok && data.verified) {
          setForgotPasswordStep('reset');
        } else {
          setForgotPasswordError(data.error || 'Incorrect answer');
        }
      } catch (error) {
        setForgotPasswordError('Failed to verify answer');
      }
    } else if (forgotPasswordStep === 'reset') {
      if (!newPassword || !confirmPassword) {
        setForgotPasswordError('Please fill in both password fields');
        return;
      }

      if (newPassword.length < 6) {
        setForgotPasswordError('Password must be at least 6 characters');
        return;
      }

      if (newPassword !== confirmPassword) {
        setForgotPasswordError('Passwords do not match');
        return;
      }

      try {
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: forgotPasswordUsername,
            answer: securityAnswer,
            newPassword: newPassword
          })
        });

        const data = await response.json();

        if (response.ok) {
          setForgotPasswordSuccess('Password reset successfully! You can now login.');
          setTimeout(() => {
            setShowForgotPasswordModal(false);
          }, 2000);
        } else {
          setForgotPasswordError(data.error || 'Failed to reset password');
        }
      } catch (error) {
        setForgotPasswordError('Failed to reset password');
      }
    }
  };

  const handleAdminClick = () => {
    // If admin is already logged in, redirect to last admin page or dashboard
    if (isAdmin) {
      const lastAdminPage = localStorage.getItem('lastAdminPage');
      router.push(lastAdminPage || '/admin/dashboard');
      setIsMobileMenuOpen(false);
    } else {
      // Show admin login modal
      if (onAdminClick) {
        onAdminClick();
      }
      setIsMobileMenuOpen(false);
    }
  };

  const handleDashboardClick = () => {
    // Close dropdowns
    setIsUserDropdownOpen(false);
    setIsMobileMenuOpen(false);
    
    // Redirect to appropriate dashboard based on user type
    if (user) {
      router.push(getDashboardPathForUserType(user.userType));
    } else {
      // Fallback: redirect to home if user is not available
      router.push('/');
    }
  };

  const handleInlineLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError('Please enter both username and password');
      return;
    }

    // Auto-cleanup old tokens before login
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('superAdminUser');
    clearClubWorkspaceSessionOnLogout();

    setIsLoggingIn(true);
    setLoginError('');

    try {
      // Check if this looks like an admin login attempt (common admin usernames/emails)
      const isLikelyAdmin = loginUsername.toLowerCase() === 'admin' || 
                           loginUsername.toLowerCase() === 'admin@movesbook.com' ||
                           loginUsername.toLowerCase().includes('admin');
      
      let response;
      let data;
      
      if (isLikelyAdmin) {
        // Try admin login first to avoid 401 noise
        response = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: loginUsername,
          password: loginPassword
        })
      });

        data = await response.json();

        if (response.ok && data.user) {
          persistAdminLoginSession(data.token, data.user);
          setLoginUsername('');
          setLoginPassword('');
          setLoginError('');
          if (data.user.isStaff) {
            router.push(`/operators/profile/${data.user.id}`);
          } else {
            router.push('/admin/dashboard');
          }
          return;
        }
      }

      // Try regular user login
      response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: loginUsername,
          password: loginPassword
        })
      });

      data = await response.json();

      // If regular login fails and we haven't tried admin yet, try admin login
      if (!response.ok && !isLikelyAdmin) {
        response = await fetch('/api/auth/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: loginUsername,
            password: loginPassword
          })
        });

        data = await response.json();

        if (response.ok && data.user) {
          persistAdminLoginSession(data.token, data.user);
          setLoginUsername('');
          setLoginPassword('');
          setLoginError('');
          if (data.user.isStaff) {
            router.push(`/operators/profile/${data.user.id}`);
          } else {
            router.push('/admin/dashboard');
          }
          return;
        }
      }

      if (response.ok && data.user) {
        // Regular user login successful
        const redirectTo =
          typeof data.redirectTo === 'string' && data.redirectTo.trim()
            ? data.redirectTo.trim()
            : null;
        if (redirectTo && typeof window !== 'undefined') {
          const path = redirectTo.split('?')[0] ?? '';
          const clubMatch = redirectTo.match(/[?&]clubId=([^&]+)/);
          const groupIdMatch = redirectTo.match(/[?&]groupId=([^&]+)/);
          const teamMatch = redirectTo.match(/[?&]teamId=([^&]+)/);
          if (clubMatch?.[1]) {
            localStorage.setItem('selectedClub', decodeURIComponent(clubMatch[1]));
          }
          if (groupIdMatch?.[1]) {
            const id = decodeURIComponent(groupIdMatch[1]);
            if (path.includes('my-coaching-group') || path.includes('/coach/dashboard')) {
              localStorage.setItem('selectedCoachingGroup', id);
            } else if (path.includes('my-group') || path.includes('/group/dashboard')) {
              localStorage.setItem('selectedGroup', id);
            }
          }
          if (teamMatch?.[1]) {
            localStorage.setItem('selectedTeam', decodeURIComponent(teamMatch[1]));
          }
        }
        const entityAccessMode =
          typeof data.entityAccessMode === 'string'
            ? data.entityAccessMode
            : typeof data.clubAccessMode === 'string'
              ? data.clubAccessMode
              : undefined;
        const entityKind =
          typeof data.entityKind === 'string' ? data.entityKind : undefined;
        const entityId =
          typeof data.entityId === 'string'
            ? data.entityId
            : typeof data.clubId === 'string'
              ? data.clubId
              : undefined;
        if (
          data.pcuAlert &&
          (data.pcuAlert.bodyHtml?.trim() || data.pcuAlert.title?.trim()) &&
          shouldShowPcuAtLogin(data.user.userType, entityAccessMode)
        ) {
          storePendingPcuAlert({
            title: data.pcuAlert.title ?? '',
            bodyHtml: data.pcuAlert.bodyHtml ?? '',
          });
        }
        login(data.token, data.user, redirectTo, {
          entityAccessMode,
          entityKind: entityKind as
            | 'club'
            | 'team'
            | 'group'
            | 'coach'
            | undefined,
          entityId,
          clubAccessMode: entityAccessMode,
          clubId: entityKind === 'club' ? entityId : undefined,
        });
        
        // Clear form
        setLoginUsername('');
        setLoginPassword('');
        setLoginError('');
      } else {
        setLoginError(data.error || 'Invalid username or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('An error occurred. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <>
      {/* Premium Main Navigation */}
      <nav className="bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 shadow-2xl border-b border-purple-600 sticky top-0 z-50" style={{ overflow: 'visible' }}>
        <div className="max-w-full px-4 sm:px-6 lg:px-8" style={{ overflow: 'visible' }}>
          {/* Top Bar with Contact Info & Language */}
          <div className="flex justify-between items-center py-3 border-b border-cyan-500 border-opacity-30" style={{ overflow: 'visible' }}>
            {/* Contact Information */}
            <div className="hidden md:flex items-center space-x-6 text-cyan-100">
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4" />
                <span className="font-medium text-xs sm:text-sm">+1 (555) 123-4567</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4" />
                <span className="font-medium text-xs sm:text-sm">info@movesbook.com</span>
              </div>
            </div>

            {/* Top Navigation Links - Left and Right Groups */}
            <div className="hidden xl:flex items-center flex-1 justify-between mx-8  text-cyan-100">
              {/* Left Group */}
              <div className="flex items-center gap-6">
                <Link href="/why-movesbook" className="hover:text-white transition-colors duration-200 font-semibold whitespace-nowrap px-2 py-1">
                  {t('nav_why_movesbook')}
                </Link>
                <Link href="/dealers" className="hover:text-white transition-colors duration-200 font-semibold whitespace-nowrap px-2 py-1">
                  {t('nav_dealers')}
                </Link>
                <Link href="/subscribe-newsletter" className="hover:text-white transition-colors duration-200 font-semibold whitespace-nowrap px-2 py-1">
                  {t('nav_subscribe_newsletter')}
                </Link>
                <Link href="/references" className="hover:text-white transition-colors duration-200 font-semibold whitespace-nowrap px-2 py-1">
                  {t('nav_references')}
                </Link>
                <Link href="/about-us" className="hover:text-white transition-colors duration-200 font-semibold whitespace-nowrap px-2 py-1">
                  {t('nav_about')}
                </Link>
              </div>

              {/* Right Group */}
              <div className="flex items-center gap-6">
                <Link href="/support" className="hover:text-white transition-colors duration-200 font-semibold whitespace-nowrap px-2 py-1">
                  {t('nav_support')}
                </Link>
                <Link href="/forum" className="hover:text-white transition-colors duration-200 font-semibold whitespace-nowrap px-2 py-1">
                  {t('nav_forum')}
                </Link>
                <Link href="/blog" className="hover:text-white transition-colors duration-200 font-semibold whitespace-nowrap px-2 py-1">
                  {t('nav_blog')}
                </Link>
              </div>
            </div>

            {/* Language & Social */}
            <div className="flex items-center space-x-4">
              {/* Language Selector */}
              <div className="relative" ref={languageDropdownRef} style={{ zIndex: 150 }}>
                <button
                  onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                  className="flex items-center space-x-2 text-cyan-100 hover:text-white transition-all duration-200 px-3 py-1 rounded-lg hover:bg-white hover:bg-opacity-10"
                >
                  <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0 relative">
                    <Image 
                      src={`/flags/${getFlagFileName(currentLanguage)}`}
                      alt={`${currentLangDisplay} flag`}
                      fill
                      sizes="20px"
                      className="object-cover"
                    />
                  </div>
                  <span className="font-medium">{currentLangDisplay}</span>
                </button>
                
                {isLanguageDropdownOpen && (
                  <div 
                    className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 transition-colors"
                    style={{ 
                      zIndex: 9999,
                      position: 'absolute'
                    }}
                  >
                    <div className="p-2">
                      <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700 mb-1">
                        Select Language
                      </div>
                      {availableLanguages.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setLanguage(lang.code);
                            setIsLanguageDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 font-medium flex items-center gap-3 ${
                            currentLanguage === lang.code ? 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' : 'text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          <div className="w-7 h-7 rounded overflow-hidden flex-shrink-0 relative">
                            <Image 
                              src={`/flags/${getFlagFileName(lang.code)}`}
                              alt={`${lang.name} flag`}
                              fill
                              sizes="28px"
                              className="object-cover"
                            />
                          </div>
                          <span className="flex-1">{lang.name}</span>
                          {currentLanguage === lang.code && (
                            <span className="text-cyan-600 font-bold">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Social Media Links */}
              <div className="flex items-center space-x-3 border-l border-cyan-500 border-opacity-30 pl-4">
                {socialLinks.map((social) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.label}
                      href={social.href}
                      className={`text-cyan-100 ${social.color} transition-all duration-200 hover:opacity-80`}
                      aria-label={social.label}
                    >
                      <Icon className="w-4 h-4" />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Navigation Bar */}
          <div className="flex justify-between items-center h-20 relative" style={{ overflow: 'visible' }}>
            {/* Logo */}
            <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
              <div className="relative">
                <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center">
                  <Image
                    src="/sidelogo.png"
                    alt="Movesbook Logo"
                    width={64}
                    height={64}
                    className="object-contain scale-x-[-1] w-full h-full"
                    priority
                  />
                </div>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  Movesbook
                </h1>
                <p className="text-cyan-200 text-xs font-light">Elite Training Platform</p>
              </div>
            </div>

            {/* Desktop: nav links + network search (legacy “Search in …”) */}
            {!hideContentNav && (
            <div className="hidden lg:flex min-w-0 flex-1 items-center gap-1.5 overflow-visible mx-1 lg:mx-2">
              <div className="flex min-w-0 flex-1 items-center gap-0 overflow-x-auto scrollbar-hide">
                {menuItems.map((item, index) => {
                  const isActive = pathname === item.href;
                  const isHome = item.href === '/';
                  const isPublicRoute =
                    isHome ||
                    item.href === '/testimonials' ||
                    isOpenNewsNavHref(item.href) ||
                    item.href === '/sell-buy' ||
                    item.href === '/job-offers' ||
                    item.href === '/promote-yourself' ||
                    item.href === '/our-shop' ||
                    item.href === '/news-by-movesbook' ||
                    isOpenAddSongsNavHref(item.href) ||
                    isOpenMusicNavHref(item.href);
                  const canAccess = isPublicRoute || isAuthenticated;
                  
                  return (
                    <Link
                      key={`${item.label}-${item.href}`}
                      href={canAccess ? item.href : '#'}
                      onClick={(e) => {
                        if (!canAccess) {
                          e.preventDefault();
                          handleProtectedLinkClick(item.href, e);
                        } else {
                          handleProtectedLinkClick(item.href, e);
                        }
                      }}
                      className={`shrink-0 px-1.5 lg:px-2 py-1.5 rounded-lg text-[11px] lg:text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-2xl'
                          : canAccess
                          ? 'text-cyan-100 hover:bg-white hover:bg-opacity-10 hover:text-white'
                          : 'text-cyan-100 opacity-60'
                      }`}
                      style={canAccess ? {} : { cursor: 'default' }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>

              <form
                onSubmit={handleNetworkSearchSubmit}
                data-search-anchor="desktop"
                className="flex shrink-0 items-center gap-1"
                role="search"
                aria-label={t('nav_search_network_form_aria')}
              >
                <span className="hidden text-[11px] font-semibold text-white 2xl:inline">
                  {t('nav_search_in')}
                </span>
                <label htmlFor="navbar-network-search-scope" className="sr-only">
                  {t('nav_search_scope_label')}
                </label>
                <div className="flex h-8 max-w-[4.25rem] shrink-0 items-center rounded-md bg-white shadow-sm ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-cyan-400/70">
                  <select
                    id="navbar-network-search-scope"
                    value={networkSearchScope}
                    onChange={(e) =>
                      setNetworkSearchScope(e.target.value as typeof networkSearchScope)
                    }
                    className="h-full min-h-0 w-full cursor-pointer border-0 bg-transparent py-0 pl-1.5 pr-1 text-[11px] font-medium leading-none text-zinc-900 focus:outline-none focus:ring-0"
                  >
                    <option value="single_user">{t('nav_search_scope_single_user')}</option>
                    <option value="coach">{t('nav_search_scope_coach')}</option>
                    <option value="team">{t('nav_search_scope_team')}</option>
                    <option value="club">{t('nav_search_scope_club')}</option>
                  </select>
                </div>
                <div
                  ref={networkSearchDesktopInputWrapRef}
                  className="relative flex h-8 w-24 shrink-0 items-center rounded-md bg-white shadow-sm ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-cyan-400/70 xl:w-28"
                >
                  <label htmlFor="navbar-network-search-query" className="sr-only">
                    {t('nav_search_placeholder')}
                  </label>
                  <input
                    id="navbar-network-search-query"
                    type="search"
                    value={networkSearchQuery}
                    onChange={(e) => setNetworkSearchQuery(e.target.value)}
                    placeholder={t('nav_search_placeholder')}
                    autoComplete="off"
                    className="h-full min-h-0 w-full border-0 bg-transparent py-0 pl-2 pr-7 text-[11px] leading-none text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0"
                  />
                  <button
                    type="button"
                    onClick={() => void runNetworkSearch('desktop')}
                    className="absolute right-0.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                    aria-label={t('nav_search_submit')}
                  >
                    <Search className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </form>
            </div>
            )}

            {/* User Actions */}
            {!hideContentNav && (
            <div className="hidden lg:flex items-center gap-2 flex-shrink-0" style={{ overflow: 'visible', position: 'relative', zIndex: 100 }}>
              {isAdmin ? (
                /* Admin Logged In - Show Admin Button and Logout */
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleAdminClick}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-500 bg-opacity-10 hover:bg-opacity-20 rounded-xl border border-red-500 border-opacity-30 transition-all duration-300 cursor-pointer"
                  >
                    <Shield className="w-5 h-5 text-red-400" />
                    <span className="text-white font-medium">{adminUser?.name || 'Admin'}</span>
                  </button>
                  <button
                    onClick={handleAdminLogout}
                    className="flex items-center space-x-2 px-4 py-3 bg-red-500 bg-opacity-20 hover:bg-opacity-30 text-white rounded-xl transition-all duration-300 font-semibold"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{t('btn_logout')}</span>
                  </button>
                </div>
              ) : isAuthenticated ? (
                /* User Dropdown */
                <div className="relative" ref={userDropdownRef} style={{ zIndex: 150 }}>
                  <button
                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                    className="flex items-center space-x-2 p-2 rounded-2xl hover:bg-white hover:bg-opacity-10 transition-all duration-300"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-full flex items-center justify-center">
                      <UserIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white truncate max-w-32">
                        {user?.name}
                      </p>
                    </div>
                  </button>

                  {isUserDropdownOpen && (
                    <div 
                      className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 transition-colors"
                      style={{ 
                        zIndex: 9999,
                        position: 'absolute',
                        overflow: 'visible'
                      }}
                    >
                      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                        <p className="font-semibold text-gray-900 dark:text-white">{user?.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
                      </div>
                      
                      <div className="p-2">
                        <button
                          onClick={handleDashboardClick}
                          className="w-full flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <Home className="w-4 h-4 mr-3" />
                          Dashboard
                        </button>

                        <button
                          onClick={() => {
                            router.push('/profile');
                            setIsUserDropdownOpen(false);
                          }}
                          className="w-full flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <User className="w-4 h-4 mr-3" />
                          Profile
                        </button>
                        
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <LogOut className="w-4 h-4 mr-3" />
                          {t('nav_logout')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Inline Login Form */
                <div className="flex flex-col items-end gap-1">
                  <form onSubmit={handleInlineLogin} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Username"
                      value={loginUsername}
                      onChange={(e) => {
                        setLoginUsername(e.target.value);
                        setLoginError('');
                      }}
                      className="h-10 w-40 rounded-md border border-cyan-500 border-opacity-30 bg-white bg-opacity-10 px-3 text-sm text-white placeholder-cyan-200 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      disabled={isLoggingIn}
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        setLoginError('');
                      }}
                      className="h-10 w-40 rounded-md border border-cyan-500 border-opacity-30 bg-white bg-opacity-10 px-3 text-sm text-white placeholder-cyan-200 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      disabled={isLoggingIn}
                      onKeyPress={(e) => e.key === 'Enter' && handleInlineLogin()}
                    />
                  <button
                      type="submit"
                      disabled={isLoggingIn}
                      className="h-10 whitespace-nowrap rounded-md bg-cyan-600 px-6 text-sm font-semibold text-white transition-all duration-300 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                      {isLoggingIn ? '...' : 'Login'}
                  </button>
                  </form>
                  {loginError && (
                    <span className="text-xs text-red-300">{loginError}</span>
                  )}
                  <div className="flex items-center gap-3 pr-1">
                    <Link
                      href="/register"
                      className="text-xs text-green-300 hover:text-green-100 font-semibold underline transition-colors"
                    >
                      Sign up Free
                    </Link>
                    <span className="text-gray-500">•</span>
                  <button
                      onClick={handleForgotPasswordClick}
                      className="text-xs text-cyan-200 hover:text-white underline transition-colors"
                  >
                      Forgot Password?
                  </button>
                  </div>
                </div>
              )}
              {isAuthenticated && (
                <QuickMenuButton onLogout={handleLogout} />
              )}
            </div>
            )}

            {/* Mobile Menu Button */}
            {!hideContentNav && (
            <div className="lg:hidden flex-shrink-0 flex items-center gap-2">
              {isAuthenticated && (
                <QuickMenuButton onLogout={handleLogout} />
              )}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-3 bg-white bg-opacity-10 rounded-2xl hover:bg-opacity-20 transition-all duration-300 text-white"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
            )}
          </div>

          {/* Mobile Menu */}
          {!hideContentNav && isMobileMenuOpen && (
            <div className="lg:hidden py-6 border-t border-cyan-500 border-opacity-30">
              <div className="flex flex-col space-y-3">
                {menuItems.map((item) => {
                  const isActive = pathname === item.href;
                  const isHome = item.href === '/';
                  const isPublicRoute =
                    isHome ||
                    item.href === '/testimonials' ||
                    isOpenNewsNavHref(item.href) ||
                    item.href === '/sell-buy' ||
                    item.href === '/job-offers' ||
                    item.href === '/promote-yourself' ||
                    item.href === '/our-shop' ||
                    item.href === '/news-by-movesbook' ||
                    isOpenAddSongsNavHref(item.href) ||
                    isOpenMusicNavHref(item.href);
                  const canAccess = isPublicRoute || isAuthenticated;
                  
                  return (
                    <Link
                      key={`${item.label}-${item.href}`}
                      href={canAccess ? item.href : '#'}
                      onClick={(e) => {
                        if (!canAccess) {
                          e.preventDefault();
                          handleProtectedLinkClick(item.href, e);
                        } else {
                          handleProtectedLinkClick(item.href, e);
                        }
                      }}
                      className={`text-center px-6 py-4 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-2xl'
                          : canAccess
                          ? 'text-cyan-100 hover:bg-white hover:bg-opacity-10'
                          : 'text-cyan-100 opacity-60'
                      }`}
                      style={canAccess ? {} : { cursor: 'default' }}
                    >
                      {item.label}
                    </Link>
                  );
                })}

                <form
                  onSubmit={handleNetworkSearchSubmit}
                  data-search-anchor="mobile"
                  className="flex flex-col gap-2 px-4 pt-2"
                  role="search"
                  aria-label={t('nav_search_network_form_aria')}
                >
                  <span className="text-xs font-semibold text-white">{t('nav_search_in')}</span>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex h-10 w-full shrink-0 items-center rounded-md bg-white shadow-sm ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-cyan-400/70 sm:max-w-[11rem]">
                      <select
                        value={networkSearchScope}
                        onChange={(e) =>
                          setNetworkSearchScope(e.target.value as typeof networkSearchScope)
                        }
                        className="h-full min-h-0 w-full cursor-pointer border-0 bg-transparent py-0 pl-3 pr-1 text-sm font-medium leading-none text-zinc-900 focus:outline-none focus:ring-0"
                        aria-label={t('nav_search_scope_label')}
                      >
                        <option value="single_user">{t('nav_search_scope_single_user')}</option>
                        <option value="coach">{t('nav_search_scope_coach')}</option>
                        <option value="team">{t('nav_search_scope_team')}</option>
                        <option value="club">{t('nav_search_scope_club')}</option>
                      </select>
                    </div>
                    <div
                      ref={networkSearchMobileInputWrapRef}
                      className="relative flex h-10 min-w-0 flex-1 items-center rounded-md bg-white shadow-sm ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-cyan-400/70"
                    >
                      <input
                        type="search"
                        value={networkSearchQuery}
                        onChange={(e) => setNetworkSearchQuery(e.target.value)}
                        placeholder={t('nav_search_placeholder')}
                        autoComplete="off"
                        className="h-full min-h-0 w-full border-0 bg-transparent py-0 pl-3 pr-10 text-sm leading-none text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0"
                      />
                      <button
                        type="button"
                        onClick={() => void runNetworkSearch('mobile')}
                        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                        aria-label={t('nav_search_submit')}
                      >
                        <Search className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    <button
                      type="submit"
                      className="h-10 shrink-0 self-stretch rounded bg-cyan-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-cyan-500 sm:self-center sm:w-auto"
                    >
                      {t('nav_search_submit')}
                    </button>
                  </div>
                </form>
                
                <div className="pt-4 border-t border-cyan-500 border-opacity-30 space-y-3">
                  {isAdmin ? (
                    /* Admin Logged In - Mobile View */
                    <>
                      <button
                        onClick={handleAdminClick}
                        className="w-full px-6 py-3 bg-red-500 bg-opacity-10 hover:bg-opacity-20 rounded-2xl border border-red-500 border-opacity-30 transition-all duration-300"
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <Shield className="w-4 h-4 text-red-400" />
                          <p className="text-white font-semibold text-sm">{t('nav_admin_access')}</p>
                        </div>
                        <p className="text-white font-semibold text-sm">{adminUser?.name}</p>
                        <p className="text-red-200 text-xs">{adminUser?.email}</p>
                      </button>
                      <button
                        onClick={handleAdminLogout}
                        className="w-full flex items-center px-6 py-4 text-red-300 hover:bg-red-500 hover:bg-opacity-20 rounded-2xl transition-all duration-300 font-semibold"
                      >
                        <LogOut className="w-5 h-5 mr-3" />
                        {t('nav_admin_logout')}
                      </button>
                    </>
                  ) : isAuthenticated ? (
                    <>
                      <div className="px-6 py-3 bg-white bg-opacity-10 rounded-2xl">
                        <p className="text-white font-semibold text-sm">{user?.name}</p>
                        <p className="text-cyan-200 text-xs">{user?.email}</p>
                      </div>
                      <button
                        onClick={handleDashboardClick}
                        className="w-full flex items-center px-6 py-4 text-cyan-100 hover:bg-white hover:bg-opacity-10 rounded-2xl transition-all duration-300 font-semibold"
                      >
                        <Home className="w-5 h-5 mr-3" />
                        Dashboard
                      </button>
                      <button
                        onClick={() => {
                          router.push('/profile');
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full flex items-center px-6 py-4 text-cyan-100 hover:bg-white hover:bg-opacity-10 rounded-2xl transition-all duration-300 font-semibold"
                      >
                        <User className="w-5 h-5 mr-3" />
                        Profile
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center px-6 py-4 text-red-400 hover:bg-red-500 hover:bg-opacity-20 rounded-2xl transition-all duration-300 font-semibold"
                      >
                        <LogOut className="w-5 h-5 mr-3" />
                        {t('nav_logout')}
                      </button>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <form onSubmit={handleInlineLogin} className="space-y-3">
                        <input
                          type="text"
                          placeholder="Username"
                          value={loginUsername}
                          onChange={(e) => {
                            setLoginUsername(e.target.value);
                            setLoginError('');
                          }}
                          className="w-full px-4 py-3 bg-white bg-opacity-10 border border-cyan-500 border-opacity-30 rounded-xl text-white placeholder-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
                          disabled={isLoggingIn}
                        />
                        <input
                          type="password"
                          placeholder="Password"
                          value={loginPassword}
                          onChange={(e) => {
                            setLoginPassword(e.target.value);
                            setLoginError('');
                          }}
                          className="w-full px-4 py-3 bg-white bg-opacity-10 border border-cyan-500 border-opacity-30 rounded-xl text-white placeholder-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
                          disabled={isLoggingIn}
                        />
                        {loginError && (
                          <p className="text-sm text-red-300 px-2">{loginError}</p>
                        )}
                      <button
                          type="submit"
                          disabled={isLoggingIn}
                          className="w-full px-6 py-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          {isLoggingIn ? 'Logging in...' : 'Login'}
                      </button>
                      </form>
                      
                      {/* Links below Login */}
                      <div className="flex items-center justify-center gap-3 px-2">
                        <Link
                          href="/register"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="text-sm text-green-300 hover:text-green-100 font-semibold underline transition-colors"
                        >
                          Sign up Free
                        </Link>
                        <span className="text-gray-500">•</span>
                      <button
                          onClick={handleForgotPasswordClick}
                          className="text-sm text-cyan-200 hover:text-white underline transition-colors"
                      >
                          Forgot Password?
                      </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Forgot Password Modal */}
      {networkSearchModalOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[199] bg-black/35"
            aria-label={t('nav_network_search_close')}
            onClick={() => setNetworkSearchModalOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="network-search-modal-title"
            className="fixed z-[250] rounded-lg border border-zinc-200 bg-white shadow-2xl"
            style={
              networkSearchPopoverStyle ?? {
                position: 'fixed',
                top: 88,
                left: 16,
                width: 384,
                maxHeight: 400,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }
            }
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3">
              <div className="min-w-0">
                <h2
                  id="network-search-modal-title"
                  className="text-sm font-semibold text-zinc-900 sm:text-base"
                >
                  {t('nav_network_search_modal_title')}
                </h2>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  {networkSearchScopeLabel}
                  {networkSearchActiveQuery ? (
                    <>
                      {' · '}
                      <span className="font-medium text-zinc-700">&ldquo;{networkSearchActiveQuery}&rdquo;</span>
                    </>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNetworkSearchModalOpen(false)}
                className="shrink-0 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                aria-label={t('nav_network_search_close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
              {networkSearchLoading ? (
                <p className="py-8 text-center text-sm text-zinc-500">{t('nav_network_search_loading')}</p>
              ) : networkSearchError ? (
                <p className="py-6 text-center text-sm text-red-600">{networkSearchError}</p>
              ) : networkSearchItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">{t('nav_network_search_empty')}</p>
              ) : (
                <ul className="space-y-4">
                  {networkSearchItems.map((item) => (
                    <li key={`${item.kind}-${item.id}`} className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0">
                      <div className="mb-2 flex items-center gap-2 rounded bg-zinc-100 px-2 py-1 text-xs font-semibold text-blue-700">
                        <span className="inline-block h-2 w-2 shrink-0 rounded-sm bg-blue-600" aria-hidden />
                        {item.categoryLabel}
                      </div>
                      <div className="flex gap-3">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-zinc-200">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt=""
                              className="h-full w-full object-cover"
                              width={56}
                              height={56}
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] font-medium uppercase leading-tight text-zinc-500">
                              —
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={networkSearchVisitorHref(
                              item,
                              !isAuthenticated && pathname === '/' ? 'mainpage' : undefined
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                            onClick={() => setNetworkSearchModalOpen(false)}
                          >
                            {item.title}
                          </Link>
                          {item.lines.map((line, idx) => (
                            <p key={`${item.id}-line-${idx}`} className="text-xs text-zinc-600">
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="shrink-0 border-t border-zinc-100 bg-zinc-50 px-4 py-3">
              {networkSearchActiveQuery.trim() ? (
                <Link
                  href={`/users/searchList/${encodeURIComponent(networkSearchActiveQuery)}/1?source=${
                    networkSearchScope === 'club' ? 'myclub' : 'mypage'
                  }`}
                  onClick={() => setNetworkSearchModalOpen(false)}
                  className="block text-center text-sm font-medium text-red-600 hover:text-red-700 hover:underline"
                >
                  {t('nav_network_search_see_other').replace('{query}', networkSearchActiveQuery)}
                </Link>
              ) : null}
              {!networkSearchLoading && networkSearchItems.length > 0 ? (
                <p className="mt-1 text-center text-xs text-zinc-500">
                  {t('nav_network_search_displayed').replace(
                    '{count}',
                    String(networkSearchItems.length)
                  )}
                  {networkSearchTotal > networkSearchItems.length
                    ? ` (${networkSearchTotal} total)`
                    : ''}
                </p>
              ) : null}
            </div>
          </div>
        </>
      )}

      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Forgot Password</h2>
              <button
                onClick={() => setShowForgotPasswordModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            {forgotPasswordError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {forgotPasswordError}
              </div>
            )}

            {forgotPasswordSuccess && (
              <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
                {forgotPasswordSuccess}
              </div>
            )}

            {forgotPasswordStep === 'username' && (
              <div>
                <p className="text-gray-600 mb-4">
                  Enter your username or email to retrieve your security question.
                </p>
                <input
                  type="text"
                  value={forgotPasswordUsername}
                  onChange={(e) => setForgotPasswordUsername(e.target.value)}
                  placeholder="Username or Email"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent mb-4"
                  onKeyPress={(e) => e.key === 'Enter' && handleForgotPasswordSubmit()}
                />
                <button
                  onClick={handleForgotPasswordSubmit}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Next
                </button>
              </div>
            )}

            {forgotPasswordStep === 'question' && (
              <div>
                <p className="text-gray-600 mb-2">Security Question:</p>
                <div className="mb-4 p-3 bg-gray-100 rounded-lg">
                  <p className="font-semibold text-gray-800">{securityQuestion}</p>
                </div>
                <input
                  type="text"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  placeholder="Your Answer"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent mb-4"
                  onKeyPress={(e) => e.key === 'Enter' && handleForgotPasswordSubmit()}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setForgotPasswordStep('username')}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleForgotPasswordSubmit}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    Verify
                  </button>
                </div>
              </div>
            )}

            {forgotPasswordStep === 'reset' && (
              <div>
                <p className="text-gray-600 mb-4">
                  Enter your new password.
                </p>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent mb-3"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm New Password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent mb-4"
                  onKeyPress={(e) => e.key === 'Enter' && handleForgotPasswordSubmit()}
                />
                <button
                  onClick={handleForgotPasswordSubmit}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Reset Password
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <SuggestMovesbookLoginPrompt />
    </>
  );
}
