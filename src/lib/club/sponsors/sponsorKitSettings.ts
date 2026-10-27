import type { CSSProperties } from 'react';

/** Sponsor kit / report header and report cadence settings (client-safe). */

export type SponsorKitSettings = {
  /** Use the club / team banner behind the header of the kit and the report. */
  useBanner: boolean;
  gradientFrom: string;
  gradientTo: string;
  /** Days after the last submission before a new report is sent; 0 = never automatically. */
  reportIntervalDays: number;
};

export const DEFAULT_GRADIENT_FROM = '#0f172a';
export const DEFAULT_GRADIENT_TO = '#1e40af';
export const SPONSOR_REPORT_MAX_INTERVAL_DAYS = 365;

export const DEFAULT_SPONSOR_KIT_SETTINGS: SponsorKitSettings = {
  useBanner: true,
  gradientFrom: DEFAULT_GRADIENT_FROM,
  gradientTo: DEFAULT_GRADIENT_TO,
  reportIntervalDays: 0,
};

/** The part of the settings the public pages need to draw their header. */
export type SponsorHeaderStyle = Pick<SponsorKitSettings, 'useBanner' | 'gradientFrom' | 'gradientTo'>;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function cleanHexColor(value: unknown, fallback: string): string {
  const v = typeof value === 'string' ? value.trim() : '';
  return HEX_COLOR.test(v) ? v.toLowerCase() : fallback;
}

/** Inline style of a kit / report header: club banner when enabled and available, else the gradient. */
export function sponsorHeaderBackground(
  header: SponsorHeaderStyle | undefined,
  bannerUrl: string | null,
  overlay = 'linear-gradient(rgba(15,23,42,.82), rgba(30,58,138,.85))',
): CSSProperties {
  const from = header?.gradientFrom || DEFAULT_GRADIENT_FROM;
  const to = header?.gradientTo || DEFAULT_GRADIENT_TO;
  if ((header?.useBanner ?? true) && bannerUrl) {
    return {
      backgroundImage: `${overlay}, url(${bannerUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  return { backgroundImage: `linear-gradient(135deg, ${from}, ${to})` };
}
