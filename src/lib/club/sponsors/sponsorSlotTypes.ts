import type { SponsorMediaKind } from '@/lib/club/sponsors/sponsorConstants';

/** A sponsor image shown in a section (client-safe). `section` `''` = club presentation. */
export type SponsorSlotItem = {
  id: string;
  name: string;
  section: string;
  kind: SponsorMediaKind;
  imageUrl: string;
  /** Tracked redirect to the landing page; null when the sponsor has no landing URL. */
  clickUrl: string | null;
};
