'use client';

import {
  WallMembersLastLoggedSection,
  WallNextEventSection,
} from '@/components/dashboard/wallRightColumn/shared';
import SponsorSlot, { useSectionSponsors } from '@/components/club/sponsors/SponsorSlot';
import type { SponsorSectionKey } from '@/lib/club/sponsors/sponsorConstants';

function MarqueeText({
  text,
  speedSeconds = 26,
}: {
  text: string;
  speedSeconds?: number;
}) {
  const scrollAmount = Math.max(1, Math.round(120 / speedSeconds));
  return (
    <div className="overflow-hidden whitespace-nowrap">
      {/* eslint-disable-next-line jsx-a11y/no-distracting-elements */}
      <marquee
        direction="left"
        behavior="scroll"
        scrollamount={scrollAmount}
        className="block"
      >
        {text}
      </marquee>
    </div>
  );
}

function ClubSocialBlocks() {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between border-t border-gray-300 bg-gray-900 px-3 py-2 text-[11px] font-bold tracking-wide text-white">
        <span>RECENT POST</span>
        <button
          type="button"
          className="cursor-pointer text-[10px] font-semibold text-gray-300 underline"
        >
          Shared Clubs
        </button>
      </div>
      <div className="border-b border-gray-300 bg-white">
        {[
          {
            title: 'Trail Running',
            date: '27.4.2010',
            body: "For all the runners who just love to run where there is no path...",
            meta: '1392 Members, 250549 Movers',
            thumb: 'IMG',
          },
          {
            title: 'Where is the limit',
            date: '18.5.2010',
            body: "We don't know where the limit is, but we know where it's not!!",
            meta: '1017 Members, 138718 Movers',
            thumb: 'IMG',
          },
          {
            title: 'Run for Japan',
            date: '18.3.2011',
            body: 'Now, if even, every Move counts with a death toll in the thousands...',
            meta: '90 Members, 24258 Movers',
            thumb: 'IMG',
          },
        ].map((p, idx) => (
          <div key={`${p.title}-${idx}`} className="border-b border-gray-300 px-3 py-3">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-gray-400 bg-gray-200 text-[10px] text-gray-500">
                {p.thumb}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="truncate text-[11px] font-semibold text-red-600">{p.title}</div>
                  <div className="shrink-0 text-[10px] text-gray-500">{p.date}</div>
                </div>
                <div className="mt-1 text-[10px] leading-snug text-gray-600">{p.body}</div>
                <div className="mt-1 text-[10px] text-gray-500">{p.meta}</div>
              </div>
            </div>
          </div>
        ))}
        <div className="px-3 py-2">
          <button type="button" className="text-[11px] font-semibold text-red-600">
            + More
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between bg-gray-900 px-3 py-2 text-[11px] font-bold tracking-wide text-white">
        <span>RECOMMENDED PAGES</span>
        <button
          type="button"
          className="cursor-pointer text-[10px] font-semibold text-gray-300 underline"
        >
          See All
        </button>
      </div>
      <button
        type="button"
        className="w-full border-b border-gray-300 bg-teal-600 py-2 px-3 text-xs font-semibold text-white transition-colors hover:bg-teal-700"
      >
        Filter option
      </button>
      <div className="border-b border-gray-300 bg-white">
        {[
          {
            name: 'Correre',
            line1: 'Piace a Giusi Circi e ad altri 36 amici.',
            line2: 'Mi piace',
          },
          {
            name: 'Papa Benedetto XVI',
            line1: 'Piace a Chiara Di Palma',
            line2: 'Mi piace',
          },
          {
            name: 'Il Mattino',
            line1: 'Piace a Fabio Manzi e ad altri 27 amici.',
            line2: 'Mi piace',
          },
          {
            name: 'Luca senza sonno',
            line1: 'Piace a Luca Borsacchi.',
            line2: 'Mi piace',
          },
        ].map((p, idx) => (
          <div key={`${p.name}-${idx}`} className="border-b border-gray-300 px-3 py-3">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-gray-400 bg-gray-200 text-[10px] text-gray-500">
                IMG
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-gray-800">{p.name}</div>
                <div className="mt-0.5 text-[10px] text-gray-600">{p.line1}</div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-600">
                  <span className="inline-block h-3 w-3 border border-gray-400 bg-gray-300" />
                  <span>{p.line2}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const MEMBERS_APP_SECTIONS: SponsorSectionKey[] = ['members_app'];

function SponsoredBlock({ clubId }: { clubId?: string | null }) {
  const sponsors = useSectionSponsors(clubId, MEMBERS_APP_SECTIONS);
  if (sponsors.length) {
    return (
      <div className="mt-3">
        <div className="bg-gray-900 px-3 py-2 text-xs font-bold tracking-wide text-white border-t border-gray-300">
          SPONSORED
        </div>
        <SponsorSlot items={sponsors} compact className="border-b border-gray-300 bg-white px-3 py-3" />
      </div>
    );
  }
  return (
    <div className="mt-3">
      <div className="bg-gray-900 px-3 py-2 text-xs font-bold tracking-wide text-white border-t border-gray-300">
        SPONSORED
      </div>
      <div className="border-b border-gray-300 bg-gray-100">
        <div className="px-3 py-3">
          <div className="flex gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-gray-400 bg-gray-200 text-[10px] text-gray-500">
              IMG
            </div>
            <div className="text-[11px] leading-snug text-gray-700">
              Lorem Ipsum has been the industry&apos;s standard dummy text of the printing and
              typesetting industry.
            </div>
          </div>
        </div>
        <div className="border-t border-gray-300 px-3 py-2 text-[11px] leading-snug text-gray-700">
          <MarqueeText text="Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum is simply dummy text of the printing and typesetting industry." />
        </div>
      </div>
    </div>
  );
}

/**
 * Right column for athlete dashboard when "My Club" tab is selected.
 * Reused for CLUB accounts on /club/dashboard and club visitor walls.
 */
export default function AthleteMyClubRightSidebar({
  showSponsoredBlock = true,
  clubId,
}: {
  showSponsoredBlock?: boolean;
  /** Club / team whose "Members app" sponsors fill the SPONSORED block. */
  clubId?: string | null;
}) {
  return (
    <div className="flex flex-col">
      <WallNextEventSection />

      <div className="mt-3">
        <WallMembersLastLoggedSection />
      </div>

      <ClubSocialBlocks />
      {showSponsoredBlock ? <SponsoredBlock clubId={clubId} /> : null}
    </div>
  );
}
