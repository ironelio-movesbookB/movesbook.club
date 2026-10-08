'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, MousePointerClick, X } from 'lucide-react';
import SpecialOfferLogoImage from '@/components/subscriptions/SpecialOfferLogoImage';
import {
  formatCountryPrice,
  priceForCountry,
  type CountryPriceInfo,
} from '@/lib/countries/countryPriceFormula';

export type PublicSpecialOffer = {
  versionId: number;
  versionName: string;
  title: string;
  description: string;
  costEuro: number;
  validTo: string;
  maxSubscriptions: number;
  stillFree: number | null;
  showCounter: boolean;
  logoUrl: string;
};

type Props = {
  versionId: number | null;
  durationDays?: number;
  lang: string;
  confirmed: boolean;
  onConfirmChange: (confirmed: boolean) => void;
  countryPrice?: CountryPriceInfo | null;
};

function formatDmy(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return y && m && d ? `${d}-${m}-${y}` : ymd;
}

function CounterDigits({ value }: { value: number }) {
  const digits = String(Math.max(0, value)).padStart(4, '0').split('');
  return (
    <div className="mt-1 inline-flex gap-0.5 rounded bg-gray-800 p-1">
      {digits.map((d, i) => (
        <span
          key={i}
          className="flex h-7 w-5 items-center justify-center rounded-sm bg-gradient-to-b from-gray-900 to-gray-700 font-mono text-lg font-bold text-white"
        >
          {d}
        </span>
      ))}
    </div>
  );
}

function DefaultOfferBadge() {
  return (
    <div
      className="mx-auto flex h-24 w-24 rotate-[-12deg] items-center justify-center bg-orange-500 text-center text-sm font-extrabold leading-tight text-white shadow"
      style={{
        clipPath:
          'polygon(50% 0%, 61% 12%, 77% 6%, 79% 22%, 95% 25%, 88% 40%, 100% 50%, 88% 60%, 95% 75%, 79% 78%, 77% 94%, 61% 88%, 50% 100%, 39% 88%, 23% 94%, 21% 78%, 5% 75%, 12% 60%, 0% 50%, 12% 40%, 5% 25%, 21% 22%, 23% 6%, 39% 12%)',
      }}
    >
      Special
      <br />
      Offer
    </div>
  );
}

/** Special offer of the selected version on /register (logo, price, validity, counter, purchase popup). */
export default function RegistrationSpecialOfferBox({
  versionId,
  durationDays,
  lang,
  confirmed,
  onConfirmChange,
  countryPrice = null,
}: Props) {
  const formatEuro = (costEuro: number) =>
    formatCountryPrice(priceForCountry(costEuro, countryPrice?.factor ?? 1), countryPrice);
  const [offer, setOffer] = useState<PublicSpecialOffer | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);

  useEffect(() => {
    if (!versionId) {
      setOffer(null);
      return;
    }
    let cancelled = false;
    const qs = new URLSearchParams({ versionId: String(versionId), lang });
    void fetch(`/api/subscriptions/special-offer?${qs}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { offer: null }))
      .then((data) => {
        if (!cancelled) setOffer(data?.offer ?? null);
      })
      .catch(() => {
        if (!cancelled) setOffer(null);
      });
    return () => {
      cancelled = true;
    };
  }, [versionId, lang]);

  const soldOut = offer?.stillFree === 0;

  useEffect(() => {
    if (confirmed && (!offer || soldOut)) onConfirmChange(false);
  }, [confirmed, offer, soldOut, onConfirmChange]);

  if (!offer) return null;

  return (
    <>
      <div className="w-full rounded border border-green-200 bg-[#eef7ec] p-3 text-center">
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-[#7a1f2e]">{offer.title}</div>
        <SpecialOfferLogoImage
          logoUrl={offer.logoUrl}
          alt={offer.title}
          className="mx-auto h-24 w-24 object-contain"
          fallback={<DefaultOfferBadge />}
        />
        <div className="mt-2 text-lg font-semibold text-gray-900">
          {formatEuro(offer.costEuro)}
          {durationDays ? <span className="block text-xs font-normal text-gray-600">{durationDays} days</span> : null}
        </div>

        {confirmed ? (
          <div className="mt-2 space-y-1">
            <div className="inline-flex items-center gap-1 rounded-full bg-green-600 px-3 py-1 text-xs font-bold text-white">
              <Check className="h-3.5 w-3.5" /> Offer selected
            </div>
            <button
              type="button"
              onClick={() => onConfirmChange(false)}
              className="block w-full text-[11px] font-medium text-red-700 hover:underline"
            >
              Cancel the special offer
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={soldOut}
            onClick={() => setPopupOpen(true)}
            className="mt-2 inline-flex items-center gap-1 rounded-full border-2 border-red-600 bg-white px-4 py-1 text-sm font-extrabold text-red-600 shadow hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {soldOut ? 'SOLD OUT' : 'CLICK HERE'}
            {soldOut ? null : <MousePointerClick className="h-4 w-4" />}
          </button>
        )}

        {offer.validTo ? (
          <div className="mt-3 text-sm text-gray-800">
            Valid until
            <div className="text-base font-bold text-red-600">{formatDmy(offer.validTo)}</div>
          </div>
        ) : null}
        {offer.maxSubscriptions > 0 ? (
          <div className="mt-2 text-sm text-gray-800">{offer.maxSubscriptions} available</div>
        ) : null}
        {offer.showCounter && offer.stillFree !== null ? (
          <div className="mt-1 text-sm text-gray-800">
            still free
            <div>
              <CounterDigits value={offer.stillFree} />
            </div>
          </div>
        ) : null}
      </div>

      {popupOpen && typeof document !== 'undefined'
        ? createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPopupOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between rounded-t-lg bg-[#7a1f2e] px-4 py-2.5 text-white">
              <h2 className="text-base font-bold">{offer.title}</h2>
              <button type="button" onClick={() => setPopupOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 p-4 text-sm text-gray-800">
              <div className="flex items-center gap-3">
                <SpecialOfferLogoImage logoUrl={offer.logoUrl} className="h-16 w-16 object-contain" />
                <div>
                  <div className="font-semibold">{offer.versionName}</div>
                  <div className="text-lg font-bold text-[#8b2942]">{formatEuro(offer.costEuro)}</div>
                  {offer.validTo ? (
                    <div className="text-xs text-gray-600">Valid until {formatDmy(offer.validTo)}</div>
                  ) : null}
                </div>
              </div>
              {offer.description ? <p className="whitespace-pre-wrap">{offer.description}</p> : null}
            </div>
            <div className="flex justify-end gap-2 border-t px-4 py-3">
              <button
                type="button"
                onClick={() => setPopupOpen(false)}
                className="rounded border border-gray-300 px-4 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirmChange(true);
                  setPopupOpen(false);
                }}
                className="rounded bg-red-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-red-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
        : null}
    </>
  );
}
