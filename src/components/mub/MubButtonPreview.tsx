'use client';

import Image from 'next/image';
import { mubTextColorCss } from '@/lib/mub/constants';
import type { MubIconSource } from '@/lib/mub/types';

type MubButtonPreviewProps = {
  button: {
    buttonColor: string;
    textFont: string;
    textColor: string;
    iconPath: string;
    iconSource?: MubIconSource;
    shortText: string;
    extendedText: string;
  };
  compact?: boolean;
};

export default function MubButtonPreview({ button, compact }: MubButtonPreviewProps) {
  const iconOutside = button.iconSource === 'EXTERNAL' && Boolean(button.iconPath);
  const iconInside = Boolean(button.iconPath) && !iconOutside;

  const icon = button.iconPath ? (
    <Image
      src={button.iconPath}
      alt=""
      width={28}
      height={28}
      className="h-7 w-7 shrink-0 object-cover"
      unoptimized
    />
  ) : null;

  return (
    <div className={`flex min-w-0 items-stretch gap-2 ${compact ? 'max-w-xs' : 'flex-1'}`}>
      <div className="flex shrink-0 items-center gap-1.5">
        {iconOutside ? icon : null}
        <div
          className="relative flex min-w-[10rem] items-center justify-center rounded px-3 py-1.5"
          style={{ backgroundColor: button.buttonColor, fontFamily: button.textFont }}
        >
          {iconInside ? <span className="absolute left-2 top-1/2 -translate-y-1/2">{icon}</span> : null}
          <span
            className={`truncate text-center text-sm font-semibold ${iconInside ? 'px-8' : ''}`}
            style={{ color: mubTextColorCss(button.textColor) }}
          >
            {button.shortText || 'Button'}
          </span>
        </div>
      </div>
      {!compact ? (
        <div className="min-w-0 flex-1 rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700">
          {button.extendedText || '\u00A0'}
        </div>
      ) : null}
    </div>
  );
}
