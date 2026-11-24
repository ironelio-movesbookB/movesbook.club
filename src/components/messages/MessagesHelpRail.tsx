'use client';

import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Clock, FileText, LifeBuoy } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import StaffMessagesExperience, { type MainTab } from '@/components/messages/StaffMessagesExperience';
import styles from './MessagesHelpRail.module.css';

export default function MessagesHelpRail() {
  const { t } = useLanguage();
  const [stripOpen, setStripOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<MainTab>('support');

  const openPanel = (tab: MainTab) => {
    setPanelTab(tab);
    setPanelOpen(true);
  };

  return (
    <>
      <div
        className="fixed right-0 z-[100] flex flex-row items-start pointer-events-none"
        style={{ top: '28%' }}
      >
        <div
          className={`pointer-events-auto flex flex-row items-stretch overflow-hidden rounded-l-md border border-slate-600/80 shadow-lg ${styles.railStripRoot}`}
        >
          <button
            type="button"
            onClick={() => setStripOpen((o) => !o)}
            className={`flex w-9 items-center justify-center bg-[#0f766e] transition-colors hover:bg-[#0d9488] ${styles.railStripToggle}`}
            title={stripOpen ? t('messages_rail_toggle_collapse') : t('messages_rail_toggle_expand')}
            aria-expanded={stripOpen}
          >
            {stripOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>

          <div
            className={`flex flex-col gap-1 bg-slate-800 py-2 px-1.5 transition-all duration-200 ${styles.railStripNav} ${
              stripOpen ? 'w-[52px] opacity-100' : 'w-0 overflow-hidden border-0 p-0 opacity-0'
            }`}
          >
            <RailIconButton label={t('messages_rail_version')} onClick={() => openPanel('version')}>
              <Clock className="h-5 w-5" />
            </RailIconButton>
            <RailIconButton label={t('messages_rail_reviews')} onClick={() => openPanel('review')}>
              <FileText className="h-5 w-5" />
            </RailIconButton>
            <RailIconButton label={t('messages_rail_support')} onClick={() => openPanel('support')}>
              <LifeBuoy className="h-5 w-5" />
            </RailIconButton>
          </div>
        </div>
      </div>

      {panelOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[101] cursor-default border-0 bg-black/50"
            aria-label={t('messages_panel_close')}
            onClick={() => setPanelOpen(false)}
          />
          <div
            className={`staff-messages-panel fixed right-0 top-0 bottom-0 z-[102] flex h-full max-h-screen min-h-0 w-full max-w-5xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl ${styles.railDrawer}`}
            role="dialog"
            aria-modal="true"
            aria-label={t('messages_panel_title')}
          >
            <div className={`flex flex-1 flex-col ${styles.railDrawerInner}`}>
              <StaffMessagesExperience
                key={panelTab}
                variant="drawer"
                initialMainTab={panelTab}
                onClose={() => setPanelOpen(false)}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function RailIconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="flex flex-col items-center justify-center gap-0.5 rounded py-2 hover:bg-slate-700/80"
    >
      {children}
      <span className="max-w-[48px] truncate px-0.5 text-center text-[9px] leading-tight opacity-90">
        {label}
      </span>
    </button>
  );
}
