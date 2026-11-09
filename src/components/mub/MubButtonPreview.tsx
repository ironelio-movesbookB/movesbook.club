'use client';

import Image from 'next/image';
import { mubTextColorCss } from '@/lib/mub/constants';
import type { MubIconSource } from '@/lib/mub/types';
import type { MubButtonSize } from '@/components/mub/MubPreviewModeToggle';

/**
 * Pixel sizes for the S / M / L display sizes (client mock-up, Nov 2026):
 * S is the original button, M and L are the two larger boxes drawn under it.
 * The description box keeps at least the button's height and wraps long text.
 */
export const MUB_SIZE_STYLES: Record<
  MubButtonSize,
  { buttonWidth: number; height: number; fontSize: number; descWidth: number; descFontSize: number; icon: number }
> = {
  1: { buttonWidth: 160, height: 32, fontSize: 14, descWidth: 190, descFontSize: 14, icon: 22 },
  2: { buttonWidth: 235, height: 66, fontSize: 18, descWidth: 280, descFontSize: 16, icon: 34 },
  3: { buttonWidth: 340, height: 95, fontSize: 24, descWidth: 455, descFontSize: 18, icon: 46 },
};

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
  /** Display size; the editor preview uses S. */
  size?: MubButtonSize;
};

export default function MubButtonPreview({ button, compact, size = 1 }: MubButtonPreviewProps) {
  const dims = MUB_SIZE_STYLES[size];
  const iconOutside = button.iconSource === 'EXTERNAL' && Boolean(button.iconPath);
  const iconInside = Boolean(button.iconPath) && !iconOutside;

  const icon = button.iconPath ? (
    <Image
      src={button.iconPath}
      alt=""
      width={dims.icon}
      height={dims.icon}
      className="shrink-0 object-cover"
      draggable={false}
      style={{ width: dims.icon, height: dims.icon }}
      unoptimized
    />
  ) : null;

  return (
    <div className="flex min-w-0 max-w-full items-stretch gap-2">
      <div className="flex min-w-0 shrink-0 items-center gap-1.5" style={{ maxWidth: '100%' }}>
        {iconOutside ? icon : null}
        <div
          className="relative flex min-w-0 items-center justify-center rounded px-3"
          style={{
            backgroundColor: button.buttonColor,
            fontFamily: button.textFont,
            width: dims.buttonWidth,
            height: dims.height,
          }}
        >
          {iconInside ? <span className="absolute left-2 top-1/2 flex -translate-y-1/2">{icon}</span> : null}
          <span
            className="truncate text-center font-semibold"
            style={{
              color: mubTextColorCss(button.textColor),
              fontSize: dims.fontSize,
              ...(iconInside ? { paddingLeft: dims.icon + 8, paddingRight: dims.icon + 8 } : {}),
            }}
          >
            {button.shortText || 'Button'}
          </span>
        </div>
      </div>
      {!compact ? (
        <div
          className="flex min-w-0 items-center break-words rounded border border-gray-300 bg-gray-100 px-3 py-1 text-gray-700"
          style={{ width: dims.descWidth, maxWidth: '100%', minHeight: dims.height, fontSize: dims.descFontSize }}
        >
          {button.extendedText || ' '}
        </div>
      ) : null}
    </div>
  );
}
