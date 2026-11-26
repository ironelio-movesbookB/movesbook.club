'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import AdminNavbar from '@/components/AdminNavbar';
import AdminLeftSidebar from '@/components/admin/AdminLeftSidebar';
import AdminRightSidebar from '@/components/admin/AdminRightSidebar';
import SystemDashboardSidebar from '@/components/admin/SystemDashboardSidebar';
import ModernFooter from '@/components/ModernFooter';
import { ADMIN_OGP_EXPAND_EVENT } from '@/lib/adminOgpExpand';

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const isGlobalSettings = pathname?.startsWith('/admin/global-settings');
  const isAccessAudioSettings = pathname?.startsWith('/admin/access-audio-settings');
  const isFaqAdmin = pathname?.startsWith('/admin/faqs');
  const useSystemSidebar = isGlobalSettings || isAccessAudioSettings || isFaqAdmin;
  const isChat = pathname?.startsWith('/admin/chat');
  const isStatistics = pathname?.startsWith('/admin/statistics');
  const isLogin = pathname?.startsWith('/admin/login');
  /** Superadmin My Music (Music Tracked panel) — fill the central column at a fixed viewport height. */
  const isMyMusicPanel =
    pathname?.startsWith('/admin/dashboard') && searchParams?.get('panel') === 'music-tracked';
  /** Fill viewport so left/right sidebars and main share one height (no short nested scroll). */
  const fillViewport = isChat || isStatistics || isMyMusicPanel;
  /** OGP News needs the full main column; Current Users sidebar crowds the card grid. */
  const isOgpNewsPage = pathname?.startsWith('/admin/news/links');
  const isGlobalNewsPage = pathname?.startsWith('/admin/news/global');
  const isClubsNewsPage = pathname?.startsWith('/admin/news/clubs');
  const hideRightSidebar = isOgpNewsPage || isGlobalNewsPage || isClubsNewsPage;

  useEffect(() => {
    if (hideRightSidebar) {
      setRightOpen(false);
    }
  }, [hideRightSidebar]);

  useEffect(() => {
    const onExpand = (event: Event) => {
      const expanded = Boolean((event as CustomEvent<{ expanded?: boolean }>).detail?.expanded);
      setLeftOpen(!expanded);
      setRightOpen(!expanded);
    };
    window.addEventListener(ADMIN_OGP_EXPAND_EVENT, onExpand);
    return () => window.removeEventListener(ADMIN_OGP_EXPAND_EVENT, onExpand);
  }, []);

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className={`bg-gray-50 flex flex-col ${fillViewport ? 'h-dvh overflow-hidden' : 'min-h-screen'}`}>
      <AdminNavbar
        onToggleLeft={() => setLeftOpen(!leftOpen)}
        onToggleRight={() => setRightOpen(!rightOpen)}
      />

      <div className="flex min-h-0 w-full max-w-[1920px] flex-1 mx-auto">
        {useSystemSidebar ? (
          <SystemDashboardSidebar isOpen={leftOpen} onToggle={() => setLeftOpen(!leftOpen)} />
        ) : (
          <AdminLeftSidebar isOpen={leftOpen} onToggle={() => setLeftOpen(!leftOpen)} />
        )}

        <main
          className={`flex min-h-0 min-w-0 flex-1 flex-col bg-gray-50 ${
            fillViewport ? 'overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          {children}
        </main>

        {!useSystemSidebar && (
          <AdminRightSidebar isOpen={rightOpen} onToggle={() => setRightOpen(!rightOpen)} />
        )}
      </div>

      {!fillViewport && <ModernFooter />}
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </Suspense>
  );
}
