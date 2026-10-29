'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import ModernNavbar from '@/components/ModernNavbar';
import Sidebar from '@/components/our-shop/Sidebar';
import { ShopVisitor } from '@/components/our-shop/ShopVisitor';
import { shopFetch } from '@/lib/shop/browser';

type Gate =
  | { state: 'loading' }
  | { state: 'manager' }
  | { state: 'visitor'; signedIn: boolean; shops: { slug: string; name: string }[] };

function isPublicShop(pathname: string | null) {
  return Boolean(pathname?.startsWith('/our-shop/shop/'));
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const publicShop = isPublicShop(pathname);
  const [leftOpen, setLeftOpen] = useState(false);
  const [gate, setGate] = useState<Gate>({ state: 'loading' });

  useEffect(() => {
    const handleResize = () => {
      setLeftOpen(window.innerWidth >= 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (publicShop) return;
    let cancelled = false;
    shopFetch('/api/club/shop/context')
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (cancelled) return;
        if (response.ok && data?.canManage) {
          setGate({ state: 'manager' });
          return;
        }
        setGate({
          state: 'visitor',
          signedIn: response.ok,
          shops: Array.isArray(data?.memberShops) ? data.memberShops : [],
        });
      })
      .catch(() => {
        if (!cancelled) setGate({ state: 'visitor', signedIn: false, shops: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [publicShop]);

  if (publicShop) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  if (gate.state !== 'manager') {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <ModernNavbar />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          {gate.state === 'loading' ? (
            <p className="px-2 py-10 text-sm text-slate-500">Opening the shop...</p>
          ) : (
            <ShopVisitor signedIn={gate.signedIn} shops={gate.shops} />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <ModernNavbar />
      <div className="relative flex h-[calc(100vh-64px)] w-full flex-1 overflow-hidden">
        {leftOpen && (
          <div className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden" onClick={() => setLeftOpen(false)} />
        )}
        <div
          className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
            leftOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar isOpen={leftOpen} onToggle={() => setLeftOpen(!leftOpen)} />
        </div>
        <main className="w-full flex-1 overflow-y-auto bg-gray-50">
          <div className="sticky top-0 z-30 border-b border-gray-200 bg-gray-50 px-3 py-3 sm:px-4 md:px-6 lg:hidden">
            <button
              type="button"
              onClick={() => setLeftOpen(!leftOpen)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              aria-label="Toggle sidebar"
            >
              {leftOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              <span>{leftOpen ? 'Close Menu' : 'Menu'}</span>
            </button>
          </div>
          <div className="p-3 sm:p-4 md:p-6">
            <div className="space-y-4 md:space-y-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
