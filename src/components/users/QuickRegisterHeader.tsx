'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getQuickRegisterStrings,
  normalizeQuickRegisterLang,
  QUICK_REGISTER_LANG_OPTIONS,
} from '@/lib/users/quickRegisterI18n';

export default function QuickRegisterHeader() {
  const { currentLanguage, setLanguage } = useLanguage();
  const searchParams = useSearchParams();
  const t = getQuickRegisterStrings(currentLanguage);

  useEffect(() => {
    const langParam = searchParams?.get('lang')?.trim();
    if (!langParam) return;
    const normalized = normalizeQuickRegisterLang(langParam);
    setLanguage(normalized);
  }, [searchParams, setLanguage]);

  return (
    <header className="quick-register-top-header">
      <div className="quick-register-header-inner" style={{ position: 'relative' }}>
        <div className="logo">
          <Link href="/">
            <Image src="/img/logo.png" alt="Movesbook" width={335} height={86} priority />
          </Link>
        </div>
        <div
          className="quick-register-lang"
          style={{
            position: 'absolute',
            top: 16,
            right: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            color: '#555',
          }}
        >
          <label htmlFor="quick-register-lang">{t.language}</label>
          <select
            id="quick-register-lang"
            value={normalizeQuickRegisterLang(currentLanguage)}
            onChange={(e) => setLanguage(e.target.value)}
            style={{ padding: '4px 8px', border: '1px solid #ccc', background: '#fff' }}
          >
            {QUICK_REGISTER_LANG_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="clear" />
      </div>
    </header>
  );
}
