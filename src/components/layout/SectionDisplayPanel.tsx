'use client';

import { useState } from 'react';
import { Monitor } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDisplayLayoutOptions, type LayoutModeId } from '@/hooks/useDisplayLayoutOptions';

const MODE_IDS: LayoutModeId[] = ['1', '2', '3'];

export default function SectionDisplayPanel({ onClose }: { onClose?: () => void }) {
  const { t } = useLanguage();
  const layout = useDisplayLayoutOptions();
  const [saveAs, setSaveAs] = useState<LayoutModeId>('1');
  const [notice, setNotice] = useState('');

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 1800);
  };

  return (
    <div className="w-[280px] overflow-hidden rounded-md border border-gray-300 bg-white text-gray-800 shadow-xl">
      <div className="border-b border-gray-200 bg-gray-100 px-3 py-2 text-center text-sm font-medium text-gray-700">
        {t('section_display_title')}
        <p className="mt-0.5 text-[11px] font-normal text-gray-500">{t('section_display_hint')}</p>
      </div>

      <div className="space-y-2 px-3 py-3 text-sm">
        <SectionCheck
          checked={!layout.showSectionsToolbar}
          label={t('section_display_sections_toolbar')}
          onChange={(hidden) => layout.setShowSectionsToolbar(!hidden)}
        />
        <SectionCheck
          checked={!layout.bannerSectionVisible}
          label={t('section_display_banner')}
          onChange={(hidden) => layout.setBannerSection(!hidden)}
        />
        <SectionCheck
          checked={!layout.showMyPageToolbar}
          label={t('section_display_mypage_toolbar')}
          onChange={(hidden) => layout.setShowMyPageToolbar(!hidden)}
        />
        <SectionCheck
          checked={!layout.showRightSidebar}
          label={t('section_display_right_sidebar')}
          onChange={(hidden) => layout.setShowRightSidebar(!hidden)}
        />

        <button
          type="button"
          onClick={layout.cycleCentralToolbar}
          className="flex w-full items-center justify-center gap-2 rounded bg-orange-500 px-2 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          <Monitor className="h-4 w-4" />
          {t('section_display_central_toolbar')}
        </button>
        <p className="text-center text-[11px] leading-snug text-gray-600">
          {t('section_display_cycle_hint')}
        </p>

        <div className="grid grid-cols-3 gap-2 pt-1">
          {MODE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (!layout.modes[id]) {
                  flash(t('section_display_mode_empty'));
                  return;
                }
                layout.loadMode(id);
                flash(t('section_display_mode_loaded').replace('{mode}', id));
              }}
              className="rounded border border-gray-300 bg-gray-100 px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
            >
              {t('section_display_mode').replace('{mode}', id)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <span className="shrink-0 text-xs text-gray-600">{t('section_display_save_as')}</span>
          <select
            value={saveAs}
            onChange={(event) => setSaveAs(event.target.value as LayoutModeId)}
            className="min-w-0 flex-1 rounded border border-orange-500 bg-white px-1 py-1 text-xs text-gray-800"
          >
            {MODE_IDS.map((id) => (
              <option key={id} value={id}>
                {t('section_display_mode').replace('{mode}', id)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              layout.saveMode(saveAs);
              flash(t('section_display_mode_saved').replace('{mode}', saveAs));
            }}
            className="rounded bg-orange-500 px-2 py-1 text-xs font-bold text-white hover:bg-orange-600"
          >
            {t('section_display_ok')}
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            layout.applyCarousel();
            flash(t('section_display_carousel_applied'));
          }}
          className="w-full rounded border border-teal-700 bg-teal-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
        >
          {t('section_display_apply_carousel')}
        </button>

        <button
          type="button"
          onClick={layout.hideAllExceptCentral}
          className="w-full rounded border border-gray-300 bg-gray-50 px-2 py-1.5 text-left text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          {t('section_display_hide_all')}
        </button>
        <button
          type="button"
          onClick={layout.restoreAll}
          className="w-full rounded border border-gray-300 bg-gray-50 px-2 py-1.5 text-left text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          {t('section_display_restore_all')}
        </button>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full pt-1 text-center text-sm text-gray-700 hover:text-gray-900"
          >
            {t('messages_panel_close')}
          </button>
        ) : null}

        {notice ? <p className="text-center text-xs text-teal-700">{notice}</p> : null}
      </div>
    </div>
  );
}

function SectionCheck({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-gray-300"
      />
      <span>{label}</span>
    </label>
  );
}
