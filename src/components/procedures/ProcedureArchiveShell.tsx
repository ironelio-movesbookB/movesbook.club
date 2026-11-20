'use client';
import Image from 'next/image';

import { resolvePublicImageUrl } from '@/lib/profileImageUrl';
import ProcedureArchiveTabs from './ProcedureArchiveTabs';
import type { ProcedureArchiveShellProps } from './types';

export default function ProcedureArchiveShell({
  title,
  activeTab,
  tabs,
  headerAction,
  tabsTrailing,
  tabActions,
  error,
  footerHint,
  children,
  pagination,
  member,
}: ProcedureArchiveShellProps) {
  const memberImageUrl = member?.image ? resolvePublicImageUrl(member.image) : null;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center bg-teal-800 text-white px-4 py-3 rounded-t-lg">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold whitespace-nowrap">{title}</h1>
          {member && (
            <div className="flex items-center gap-2 border-l border-teal-700 pl-3">
              <span className="text-sm font-medium text-teal-100 italic">of</span>
              <span className="text-lg font-bold text-[#d3f07b]">{member.name}</span>
              {memberImageUrl && (
                <div className="h-8 w-8 overflow-hidden rounded-full border border-teal-700 bg-teal-900/50">
                  <Image
                    src={memberImageUrl}
                    alt={member.name}
                    width={32}
                    height={32}
                    className="h-full w-full object-cover"
                    unoptimized
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        {headerAction}
      </div>
      <div className="bg-white border border-gray-200 rounded-b-lg p-4">
        {tabActions ? (
          <div className="flex items-center gap-1 border-b border-gray-200 mb-3">
            {tabActions}
            {tabsTrailing && <div className="ml-auto pb-2">{tabsTrailing}</div>}
          </div>
        ) : (
          tabs.length > 0 && (
            <ProcedureArchiveTabs tabs={tabs} activeTab={activeTab} trailing={tabsTrailing} />
          )
        )}
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        {children}
        {pagination}
        {footerHint && <p className="text-xs text-gray-500 mt-2">{footerHint}</p>}
      </div>
    </div>
  );
}
