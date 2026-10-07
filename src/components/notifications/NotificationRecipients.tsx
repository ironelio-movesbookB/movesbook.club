'use client';

import { UserCircle, Network } from 'lucide-react';
import type { NotificationDto } from '@/lib/notifications/notificationService';

type Props = {
  item: NotificationDto;
  /** Show Members / Club Staff icon (club notifications) */
  showAudienceIcon?: boolean;
  fallbackName?: string;
};

/** Right side of a notification row: recipient type icon + logo/name of every recipient club. */
export default function NotificationRecipients({
  item,
  showAudienceIcon = false,
  fallbackName = 'Club',
}: Props) {
  const recipients =
    item.recipientClubs && item.recipientClubs.length > 0
      ? item.recipientClubs
      : [
          {
            id: item.id,
            name: item.senderOfficialName || item.submittedByName || fallbackName,
            logoUrl: item.senderLogoUrl,
          },
        ];
  const isStaff = item.audienceKind === 'staff';

  return (
    <div className="flex items-center gap-3 shrink-0">
      {showAudienceIcon ? (
        <span
          className="text-gray-800"
          title={isStaff ? 'Recipients: Club Staff' : 'Recipients: Members'}
        >
          {isStaff ? (
            <Network className="h-8 w-8" strokeWidth={1.4} />
          ) : (
            <UserCircle className="h-8 w-8" strokeWidth={1.4} />
          )}
        </span>
      ) : null}
      <div className="flex flex-col gap-1">
        {recipients.map((r, idx) => (
          <div key={r.id} className="flex items-center justify-end gap-2">
            <div className="max-w-[10rem] text-right">
              <p className="text-xs font-semibold text-gray-900 leading-snug break-words">{r.name}</p>
              {idx === recipients.length - 1 && item.submittedByUsername ? (
                <p className="text-[11px] text-gray-500 truncate">@{item.submittedByUsername}</p>
              ) : null}
            </div>
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-gray-300 bg-gray-100 flex items-center justify-center">
              {r.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.logoUrl} alt="" className="h-full w-full object-contain" />
              ) : (
                <span className="text-[9px] text-gray-500">N/A</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
