'use client';

import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { PcuAlertProvider } from '@/contexts/PcuAlertContext';
import { getCurrentTheme } from '@/lib/theme';
import MemberNotePopupHost from '@/components/club/memberProfile/MemberNotePopupHost';
import SubscriptionExpiryHost from '@/components/subscriptions/SubscriptionExpiryHost';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const theme = getCurrentTheme();
  return (
    <ThemeProvider mode={theme}>
      <LanguageProvider>
        <SettingsProvider>
          <PcuAlertProvider>
            {children}
            <MemberNotePopupHost />
            <SubscriptionExpiryHost />
          </PcuAlertProvider>
        </SettingsProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
