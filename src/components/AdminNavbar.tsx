'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Home, 
  User, 
  Users, 
  Shield, 
  Search,
  Settings,
  Globe,
  FileText,
  LogOut,
  Menu,
  X,
  Building2,
  LayoutDashboard,
  History,
  MessageSquare,
} from 'lucide-react';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  navSearchLabelFromScope,
  navSearchScopeFromLabel,
  type NavSearchScope,
} from '@/lib/adminNavUserSearchScope';
import AdminPageTranslate, {
  AdminPageTranslateButton,
} from '@/components/admin/AdminPageTranslate';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  userType: string;
}

interface AdminNavbarProps {
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
}

export default function AdminNavbar({ onToggleLeft, onToggleRight }: AdminNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, currentLanguage, setLanguage, availableLanguages } = useLanguage();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('All Users');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [lastLogin, setLastLogin] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const languageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get admin user from localStorage
    const adminData = localStorage.getItem('adminUser');
    if (adminData) {
      const user = JSON.parse(adminData);
      setAdminUser(user);
      
      // Set last login time
      const now = new Date();
      const loginTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')} ${now.toLocaleDateString('en-US', { month: 'long' })}`;
      const timeAgo = '1 minute ago';
      setLastLogin(`${loginTime}\n${timeAgo}`);
    }

    // Track current admin page
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/admin/')) {
        localStorage.setItem('lastAdminPage', currentPath);
      }
    }
  }, []);

  // Close language dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (languageRef.current && !languageRef.current.contains(event.target as Node)) {
        setShowLanguageDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
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
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminToken');
    router.push('/');
  };

  const isStaff = Boolean(
    adminUser &&
      ((adminUser as { isStaff?: boolean }).isStaff ||
        (adminUser as { staffKind?: string }).staffKind ||
        (adminUser as { userType?: string }).userType?.startsWith('STAFF_')),
  );
  const staffAccountId = isStaff ? adminUser?.id : null;
  /** Operator / co-admin use the same main nav as super admin (Home, Single User, Coaches, …). */
  const useStaffStripNav = false;

  const handleOpenDashboard = async () => {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      alert('Admin session not found. Please log in again.');
      return;
    }
    try {
      const res = await fetch('/api/admin/staff-token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        alert(data.error || 'Could not open dashboard. Please try again.');
        return;
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.open('/athlete/dashboard', '_blank');
    } catch {
      alert('Network error. Could not open dashboard.');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const scope: NavSearchScope = navSearchScopeFromLabel(searchCategory);
    const params = new URLSearchParams();
    params.set('scope', scope);
    const q = searchQuery.trim();
    if (q) params.set('q', q);
    router.push(`/admin/user-search?${params.toString()}`);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    if (pathname !== '/admin/user-search') return;
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const scopeParam = params.get('scope');
    if (scopeParam) {
      setSearchCategory(navSearchLabelFromScope(scopeParam));
    }
    const q = params.get('q');
    if (q != null) setSearchQuery(q);
  }, [pathname]);

  const currentLangDisplay = availableLanguages.find(l => l.code === currentLanguage)?.name || 'English';

  return (
    <div className="w-full">
      {/* Top Red Bar */}
      <div className="bg-gradient-to-r from-red-800 to-red-700 text-white">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-2 sm:py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Logo Section */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href={
                  isStaff && staffAccountId
                    ? `/operators/profile/${staffAccountId}`
                    : '/settings/admin-management'
                }
                className="bg-white p-1 sm:p-1.5 rounded overflow-hidden cursor-pointer"
              >
                <span className="relative block h-7 w-7 sm:h-9 sm:w-9">
                  <Image
                    src="/assets/admin.png"
                    alt="Admin Logo"
                    fill
                    sizes="36px"
                    className="object-contain"
                  />
                </span>
              </Link>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold leading-tight">
                  <span className="text-yellow-400">Moves</span>
                  <span className="text-white">book</span>
                </h1>
                <p className="text-[11px] text-yellow-200 italic hidden lg:block leading-tight">The Global Sport Network, Your Sport Network</p>
              </div>
            </div>

            {/* Admin Title */}
            <div className="hidden lg:block">
              <h2 className="text-xl xl:text-2xl font-bold text-yellow-400 leading-tight">Movesbook Admin</h2>
            </div>

            {/* User Info Section - Desktop */}
            {adminUser && (
              <div className="hidden md:flex items-center gap-2 lg:gap-3">
                <AdminPageTranslateButton />
                <div className="text-right text-xs lg:text-sm leading-tight">
                  <p className="font-semibold text-yellow-200 hidden lg:block">Current Operator</p>
                  <p className="font-bold text-sm lg:text-base">
                    {adminUser.name}{' '}
                    <span className="text-yellow-400">
                      {isStaff
                        ? (adminUser as { staffKind?: string }).staffKind === 'CO_ADMIN'
                          ? '▼ Co-Admin'
                          : '▼ Operator'
                        : '▼ Admin'}
                    </span>
                  </p>
                  <p className="text-xs text-yellow-200 whitespace-pre-line hidden lg:block">{lastLogin}</p>
                </div>
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gray-300 rounded border-2 border-white overflow-hidden">
                  {adminUser.name && (
                    <div className="w-full h-full flex items-center justify-center bg-blue-600 text-white text-lg lg:text-xl font-bold">
                      {adminUser.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                {isStaff && staffAccountId ? (
                  <Link
                    href={`/operators/password-settings/${staffAccountId}`}
                    className="p-2 hover:bg-red-600 rounded-lg transition"
                    title="Account settings"
                  >
                    <Settings className="w-5 h-5" />
                  </Link>
                ) : (
                  <Link
                    href="/settings"
                    className="p-2 hover:bg-red-600 rounded-lg transition"
                    title="Sport settings"
                  >
                    <Settings className="w-5 h-5" />
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="p-2 hover:bg-red-600 rounded-lg transition"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-red-600 rounded-lg transition"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Menu Bar - Desktop */}
      <div className="hidden md:block bg-gray-700 text-white shadow-lg">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6">
          <div className="flex items-center min-h-[2.75rem]">
            {useStaffStripNav ? (
              <nav className="flex items-center flex-nowrap flex-1 min-w-0 overflow-x-auto">
                <Link
                  href={`/operators/profile/${staffAccountId}`}
                  className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 hover:bg-gray-600 transition border-r border-gray-600 text-sm"
                >
                  <User className="w-4 h-4" />
                  <span className="font-medium">Profile</span>
                </Link>
                <Link
                  href={`/operators/password-settings/${staffAccountId}`}
                  className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 hover:bg-gray-600 transition border-r border-gray-600 text-sm"
                >
                  <Settings className="w-4 h-4" />
                  <span className="font-medium">Settings</span>
                </Link>
                <Link
                  href={`/operators/myCustomers/${staffAccountId}`}
                  className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 hover:bg-gray-600 transition border-r border-gray-600 text-sm"
                >
                  <Users className="w-4 h-4" />
                  <span className="font-medium">My Customers</span>
                </Link>
                <Link
                  href={`/operators/logins/${staffAccountId}`}
                  className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 hover:bg-gray-600 transition text-sm"
                >
                  <History className="w-4 h-4" />
                  <span className="font-medium">Logins</span>
                </Link>
              </nav>
            ) : (
              <>
            <nav className="flex items-center flex-nowrap flex-1 min-w-0 overflow-x-auto">
              {/* Left Sidebar Toggle */}
              <button 
                onClick={onToggleLeft}
                className="flex items-center justify-center px-3 lg:px-4 py-2.5 lg:py-3 hover:bg-gray-600 transition border-r border-gray-600"
                title="Toggle Left Sidebar"
              >
                <Menu className="w-4 h-4" />
              </button>

              <Link 
                href="/admin/dashboard"
                className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 hover:bg-gray-600 transition border-r border-gray-600 text-sm"
              >
                <Home className="w-4 h-4" />
                <span className="font-medium">Home</span>
              </Link>

              <Link
                href="/admin/chat"
                className={`flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 transition border-r border-gray-600 text-sm ${
                  pathname?.startsWith('/admin/chat')
                    ? 'bg-yellow-500 hover:bg-yellow-600 border-yellow-600 text-white font-semibold'
                    : 'hover:bg-gray-600'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span className="font-medium">Chat</span>
              </Link>

              <Link 
                href="/admin/all"
                className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 hover:bg-gray-600 transition border-r border-gray-600 text-sm"
              >
                <span className="flex items-center gap-0.5">
                  <User className="w-3.5 h-3.5" />
                  <Shield className="w-3.5 h-3.5" />
                  <Building2 className="w-3.5 h-3.5" />
                </span>
                <span className="font-medium">All</span>
              </Link>
              
              <Link 
                href="/admin/single-user"
                className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 hover:bg-gray-600 transition border-r border-gray-600 text-sm"
              >
                <User className="w-4 h-4" />
                <span className="font-medium hidden lg:inline">Single User</span>
                <span className="font-medium lg:hidden">User</span>
              </Link>

              <Link 
                href="/admin/coaches"
                className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 hover:bg-gray-600 transition border-r border-gray-600 text-sm"
              >
                <Shield className="w-4 h-4" />
                <span className="font-medium">Coaches</span>
              </Link>

              <Link 
                href="/admin/groups"
                className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 hover:bg-gray-600 transition border-r border-gray-600 text-sm"
              >
                <Users className="w-4 h-4" />
                <span className="font-medium">Groups</span>
              </Link>

              <Link 
                href="/admin/teams"
                className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 hover:bg-gray-600 transition border-r border-gray-600 text-sm"
              >
                <Users className="w-4 h-4" />
                <span className="font-medium">Teams</span>
              </Link>

              <Link 
                href="/admin/clubs"
                className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 hover:bg-gray-600 transition border-r border-gray-600 text-sm"
              >
                <Building2 className="w-4 h-4" />
                <span className="font-medium">Clubs</span>
              </Link>

              <Link 
                href="/admin/global-settings"
                className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 hover:bg-gray-600 transition border-r border-gray-600 text-sm"
              >
                <Globe className="w-4 h-4" />
                <span className="font-medium">Global settings</span>
              </Link>

              <Link 
                href="/settings"
                className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 hover:bg-gray-600 transition border-r border-gray-600 text-sm"
              >
                <Settings className="w-4 h-4" />
                <span className="font-medium">Sport settings</span>
              </Link>

              <button
                onClick={handleOpenDashboard}
                className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 hover:bg-yellow-600 bg-yellow-500 transition border-r border-yellow-600 text-sm text-white font-semibold"
                title="Open user dashboard as Movesbook Staff"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="font-medium">Dashboard</span>
              </button>

              {/* Language Dropdown */}
              <div className="relative" ref={languageRef}>
                <button
                  onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                  className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 hover:bg-gray-600 transition border-r border-gray-600 text-sm"
                >
                  <Globe className="w-4 h-4" />
                  <span className="font-medium">{currentLangDisplay}</span>
                </button>

                {showLanguageDropdown && (
                  <div className="absolute top-full left-0 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-2xl rounded-b-lg z-50 min-w-[200px] transition-colors">
                    {availableLanguages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setShowLanguageDropdown(false);
                        }}
                        className={`w-full text-left px-5 py-2 hover:bg-gray-100 transition text-sm ${
                          currentLanguage === lang.code ? 'bg-blue-50 text-blue-700 font-semibold' : ''
                        }`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Link
                href="/settings/language"
                className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 hover:bg-gray-600 transition border-r border-gray-600 text-sm shrink-0"
              >
                <FileText className="w-4 h-4" />
                <span className="font-medium">Language</span>
              </Link>
            </nav>

            <div className="flex items-center gap-2 shrink-0 border-l border-gray-600 pl-2 ml-0.5 py-1">
              <form onSubmit={handleSearch} className="flex items-center gap-2 flex-nowrap">
                  <span className="text-sm text-gray-300 font-bold whitespace-nowrap">Search in</span>
                  <select
                    value={searchCategory}
                    onChange={(e) => setSearchCategory(e.target.value)}
                    className="h-9 box-border border border-gray-300 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-colors leading-none shrink-0"
                  >
                    <option>All Users</option>
                    <option>Athletes</option>
                    <option>Coaches</option>
                    <option>Teams</option>
                    <option>Clubs</option>
                    <option>Groups</option>
                  </select>
                  <div className="relative h-9 w-[min(12rem,22vw)] min-w-[7rem] shrink-0">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      className="w-full h-9 box-border border border-gray-300 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 rounded pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-colors leading-none"
                    />
                    <button 
                      type="submit"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gray-700 p-1 rounded hover:bg-gray-600 transition"
                    >
                      <Search className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </form>

              <button
                onClick={onToggleRight}
                className="p-2 hover:bg-gray-600 rounded transition shrink-0"
                title="Toggle Right Sidebar"
              >
                <Menu className="w-5 h-5 text-white" />
              </button>
            </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-gray-700 text-white shadow-lg">
          <nav className="flex flex-col">
            <Link 
              href="/admin/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-600 transition border-b border-gray-600"
            >
              <Home className="w-5 h-5" />
              <span className="font-medium">Home</span>
            </Link>

            <Link
              href="/admin/chat"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-5 py-3 transition border-b border-gray-600 ${
                pathname?.startsWith('/admin/chat')
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white font-semibold'
                  : 'hover:bg-gray-600'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="font-medium">Chat</span>
            </Link>

            <Link 
              href="/admin/all"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-600 transition border-b border-gray-600"
            >
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <Shield className="w-4 h-4" />
                <Building2 className="w-4 h-4" />
              </span>
              <span className="font-medium">All</span>
            </Link>
            
            <Link 
              href="/admin/single-user"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-600 transition border-b border-gray-600"
            >
              <User className="w-5 h-5" />
              <span className="font-medium">Single User</span>
            </Link>

            <Link 
              href="/admin/coaches"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-600 transition border-b border-gray-600"
            >
              <Shield className="w-5 h-5" />
              <span className="font-medium">Coaches</span>
            </Link>

            <Link 
              href="/admin/groups"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-600 transition border-b border-gray-600"
            >
              <Users className="w-5 h-5" />
              <span className="font-medium">Groups</span>
            </Link>

            <Link 
              href="/admin/teams"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-600 transition border-b border-gray-600"
            >
              <Users className="w-5 h-5" />
              <span className="font-medium">Teams</span>
            </Link>

            <Link 
              href="/admin/clubs"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-600 transition border-b border-gray-600"
            >
              <Building2 className="w-5 h-5" />
              <span className="font-medium">Clubs</span>
            </Link>

            <Link 
              href="/admin/global-settings"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-600 transition border-b border-gray-600"
            >
              <Globe className="w-5 h-5" />
              <span className="font-medium">Global settings</span>
            </Link>

            <Link 
              href="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-600 transition border-b border-gray-600"
            >
              <Settings className="w-5 h-5" />
              <span className="font-medium">Sport settings</span>
            </Link>

            <button
              onClick={() => { void handleOpenDashboard(); setMobileMenuOpen(false); }}
              className="w-full text-left flex items-center gap-3 px-5 py-3 bg-yellow-500 hover:bg-yellow-600 transition border-b border-yellow-600 text-white font-semibold"
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="font-medium">Dashboard</span>
            </button>

            <Link
              href="/settings/language"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-600 transition border-b border-gray-600"
            >
              <FileText className="w-5 h-5" />
              <span className="font-medium">Language</span>
            </Link>

            {/* Language Selection */}
            <div className="border-b border-gray-600">
              <div className="px-6 py-3 bg-gray-600 text-xs font-semibold uppercase text-gray-300">
                Language
              </div>
              {availableLanguages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left flex items-center gap-3 px-6 py-3 hover:bg-gray-600 transition ${
                    currentLanguage === lang.code ? 'bg-gray-600 text-yellow-400 font-semibold' : ''
                  }`}
                >
                  <Globe className="w-5 h-5" />
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>

            {/* Mobile User Actions */}
            {adminUser && (
              <div className="border-b border-gray-600">
                <div className="px-6 py-3 bg-gray-600 text-xs font-semibold uppercase text-gray-300">
                  Account
                </div>
                <div className="px-6 py-3" onClick={() => setMobileMenuOpen(false)}>
                  <AdminPageTranslateButton className="w-full justify-center bg-gray-600 border-gray-500" />
                </div>
                <Link
                  href="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-6 py-4 hover:bg-gray-600 transition"
                >
                  <Settings className="w-5 h-5" />
                  <span className="font-medium">Sport settings</span>
                </Link>
                <button
                  onClick={() => { void handleOpenDashboard(); setMobileMenuOpen(false); }}
                  className="w-full text-left flex items-center gap-3 px-6 py-4 hover:bg-yellow-600 bg-yellow-500 transition text-white font-semibold"
                >
                  <LayoutDashboard className="w-5 h-5" />
                  <span className="font-medium">Dashboard</span>
                </button>
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left flex items-center gap-3 px-6 py-4 hover:bg-gray-600 transition text-red-300"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            )}

            {/* Mobile Search */}
            <div className="p-4">
              <form onSubmit={(e) => { handleSearch(e); setMobileMenuOpen(false); }} className="space-y-3">
                <select
                  value={searchCategory}
                  onChange={(e) => setSearchCategory(e.target.value)}
                  className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  <option>All Users</option>
                  <option>Athletes</option>
                  <option>Coaches</option>
                  <option>Teams</option>
                  <option>Clubs</option>
                  <option>Groups</option>
                </select>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-3 rounded pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  />
                  <button 
                    type="submit"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gray-700 px-3 py-2 rounded hover:bg-gray-600 transition"
                  >
                    <Search className="w-4 h-4 text-white" />
                  </button>
                </div>
              </form>
            </div>
          </nav>
        </div>
      )}

      <AdminPageTranslate />
    </div>
  );
}

