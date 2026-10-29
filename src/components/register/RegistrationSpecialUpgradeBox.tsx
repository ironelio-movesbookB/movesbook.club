'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, MousePointerClick, X } from 'lucide-react';
import SpecialOfferLogoImage from '@/components/subscriptions/SpecialOfferLogoImage';
import {
  formatCountryPrice,
  priceForCountry,
  type CountryPriceInfo,
} from '@/lib/countries/countryPriceFormula';

export type PublicSpecialUpgrade = {
  versionId: number;
  versionName: string;
  title: string;
  description: string;
  buttonLabel: string;
  costEuro: number;
  validTo: string;
  daysOfSubscription: number;
  analyzeWithinDays: number;
  expirationYmd: string;
  logoUrl: string;
};

export type SpecialUpgradeSoftwareInfo = {
  company: string;
  version: string;
  expiration: string;
};

type Props = {
  versionId: number | null;
  lang: string;
  confirmed: boolean;
  software: SpecialUpgradeSoftwareInfo;
  onConfirmChange: (confirmed: boolean, software?: SpecialUpgradeSoftwareInfo) => void;
  countryPrice?: CountryPriceInfo | null;
};

function formatDmy(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return y && m && d ? `${d}-${m}-${y}` : ymd;
}

/** Special Upgrade under the selected version on /register. */
export default function RegistrationSpecialUpgradeBox({
  versionId,
  lang,
  confirmed,
  software,
  onConfirmChange,
  countryPrice = null,
}: Props) {
  const [offer, setOffer] = useState<PublicSpecialUpgrade | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [company, setCompany] = useState(software.company);
  const [swVersion, setSwVersion] = useState(software.version);
  const [swExp, setSwExp] = useState(software.expiration);

  useEffect(() => {
    if (!versionId) {
      setOffer(null);
      return;
    }
    let cancelled = false;
    fetch(
      `/api/subscriptions/special-upgrade?versionId=${versionId}&lang=${encodeURIComponent(lang || 'en')}`,
      { cache: 'no-store' },
    )
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setOffer(data.offer || null);
      })
      .catch(() => {
        if (!cancelled) setOffer(null);
      });
    return () => {
      cancelled = true;
    };
  }, [versionId, lang]);

  if (!offer) return null;

  const priceLabel = formatCountryPrice(
    priceForCountry(offer.costEuro, countryPrice?.factor ?? 1),
    countryPrice,
  );

  const confirmSoftware = () => {
    const c = company.trim();
    if (!c) {
      window.alert('The name of the company of the software you currently use is required');
      return;
    }
    onConfirmChange(true, { company: c, version: swVersion.trim(), expiration: swExp.trim() });
    setFormOpen(false);
    setExpanded(true);
  };

  return (
    <div className="mt-2 w-full rounded border border-amber-300 bg-amber-50 p-2 text-left">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-amber-900"
        onClick={() => setExpanded((v) => !v)}
      >
        <span>{offer.title}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-orange-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded ? (
        <div className="mt-2 space-y-2 text-sm text-gray-800">
          <p className="whitespace-pre-wrap">{offer.description}</p>
          {offer.validTo ? <p>Valid until {formatDmy(offer.validTo)}</p> : null}
          <p className="font-semibold">
            Price {priceLabel} Expiration on {formatDmy(offer.expirationYmd)}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border-2 border-red-600 bg-white px-4 py-2 text-xs font-extrabold uppercase text-red-700"
            >
              <MousePointerClick className="h-4 w-4" />
              {offer.buttonLabel || 'CLICK HERE'}
            </button>
            {offer.logoUrl ? (
              <SpecialOfferLogoImage src={offer.logoUrl} className="h-16 w-16 object-contain" />
            ) : null}
          </div>
          {confirmed ? (
            <p className="text-xs font-semibold text-green-700">
              Special upgrade selected — company: {software.company || company}
            </p>
          ) : null}
        </div>
      ) : null}

      {formOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Special Upgrade</h3>
                  <button type="button" onClick={() => setFormOpen(false)} aria-label="Close">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="mb-3 text-sm text-gray-600">
                  Tell us about the software you are upgrading from, then continue to payment at the
                  special price.
                </p>
                <label className="mb-1 block text-xs font-semibold uppercase text-gray-600">
                  Software company *
                </label>
                <input
                  className="mb-3 w-full rounded border px-3 py-2 text-sm"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
                <label className="mb-1 block text-xs font-semibold uppercase text-gray-600">
                  Version (optional)
                </label>
                <input
                  className="mb-3 w-full rounded border px-3 py-2 text-sm"
                  value={swVersion}
                  onChange={(e) => setSwVersion(e.target.value)}
                />
                <label className="mb-1 block text-xs font-semibold uppercase text-gray-600">
                  Expiration date (optional)
                </label>
                <input
                  type="date"
                  className="mb-4 w-full rounded border px-3 py-2 text-sm"
                  value={swExp}
                  onChange={(e) => setSwExp(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => setFormOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white"
                    onClick={confirmSoftware}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
