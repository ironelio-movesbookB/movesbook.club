'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, Eye, Pencil, Trash2 } from 'lucide-react';
import { CountryEditModal, type CountryRow } from './CountryEditModal';
import type { CountryEditSavePayload } from './countryEditTypes';
import {
  CountriesFilterModal,
  DEFAULT_COUNTRIES_FILTER,
  type CountriesFilterState,
} from './CountriesFilterModal';
import {
  COUNTRIES_DASHBOARD_ROWS,
  COUNTRIES_PAGE_SIZE,
} from '@/constants/countriesDashboard.constants';
import { countryFlagSrc } from '@/lib/countries/countryFlag';
import { getAdminBearerToken } from '@/lib/admin/clientAdminAuth';
import type {
  CountryPricingHeader,
  CountryPricingSettings,
} from '@/lib/countries/countryPriceFormula';

function applyPricingToRow(row: CountryRow, pricing: CountryPricingSettings | undefined): CountryRow {
  if (!pricing) return row;
  return {
    ...row,
    currencyCode: pricing.currencyCode || row.currencyCode,
    eurRate: pricing.eurToLocal ?? row.eurRate,
    usdRate: pricing.usdToLocal ?? row.usdRate,
  };
}

function amountText(value: number): string {
  return value > 0 ? String(value) : '';
}

function parseHeaderAmount(value: string): number {
  const n = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function rowMatchesCountriesFilter(row: CountryRow, f: CountriesFilterState): boolean {
  if (f.continent !== 'All' && row.continent !== f.continent) return false;
  const q = f.officialLanguage.trim().toLowerCase();
  if (q && !row.officialLanguage.toLowerCase().includes(q)) return false;
  if (f.primaryLanguage !== 'All' && row.primaryLanguage !== f.primaryLanguage) return false;
  if (f.secondaryLanguage !== 'All' && row.secondaryLanguage !== f.secondaryLanguage) return false;
  const done = row.settingCompleted === true;
  if (f.settingCompleted === 'yes' && !done) return false;
  if (f.settingCompleted === 'no' && done) return false;
  return true;
}

type OrderMode =
  | 'reset'
  | 'continent'
  | 'primary_lang'
  | 'secondary_lang'
  | 'setting_completed'
  | 'setting_not_completed';

const ORDER_OPTIONS: { value: OrderMode; label: string }[] = [
  { value: 'reset', label: 'Reset ordering' },
  { value: 'continent', label: 'Continent' },
  { value: 'primary_lang', label: 'Primary language' },
  { value: 'secondary_lang', label: 'Secondary language' },
  { value: 'setting_completed', label: 'Setting completed' },
  { value: 'setting_not_completed', label: 'Setting not completed' },
];

function sortCountries(rows: CountryRow[], mode: OrderMode): CountryRow[] {
  const copy = [...rows];
  if (mode === 'reset') {
    copy.sort((a, b) => a.id - b.id);
    return copy;
  }
  if (mode === 'continent') {
    copy.sort((a, b) => a.continent.localeCompare(b.continent) || a.name.localeCompare(b.name));
    return copy;
  }
  if (mode === 'primary_lang') {
    copy.sort(
      (a, b) => a.primaryLanguage.localeCompare(b.primaryLanguage) || a.name.localeCompare(b.name),
    );
    return copy;
  }
  if (mode === 'secondary_lang') {
    copy.sort(
      (a, b) =>
        a.secondaryLanguage.localeCompare(b.secondaryLanguage) || a.name.localeCompare(b.name),
    );
    return copy;
  }
  if (mode === 'setting_completed') {
    copy.sort((a, b) => {
      const ad = a.settingCompleted === true ? 1 : 0;
      const bd = b.settingCompleted === true ? 1 : 0;
      if (bd !== ad) return bd - ad;
      return a.name.localeCompare(b.name);
    });
    return copy;
  }
  if (mode === 'setting_not_completed') {
    copy.sort((a, b) => {
      const ad = a.settingCompleted === true ? 1 : 0;
      const bd = b.settingCompleted === true ? 1 : 0;
      if (ad !== bd) return ad - bd;
      return a.name.localeCompare(b.name);
    });
    return copy;
  }
  return copy;
}

function buildPaginationItems(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items: (number | 'ellipsis')[] = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) items.push('ellipsis');
  for (let page = windowStart; page <= windowEnd; page += 1) items.push(page);
  if (windowEnd < totalPages - 1) items.push('ellipsis');
  items.push(totalPages);
  return items;
}

export default function CountriesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<CountryRow[]>(COUNTRIES_DASHBOARD_ROWS);
  const [editingCountry, setEditingCountry] = useState<CountryRow | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [appliedFilter, setAppliedFilter] = useState<CountriesFilterState>(DEFAULT_COUNTRIES_FILTER);
  const [draftFilter, setDraftFilter] = useState<CountriesFilterState>(DEFAULT_COUNTRIES_FILTER);

  const filterSelectOptions = useMemo(() => {
    const continents = Array.from(new Set(countries.map((r) => r.continent))).sort();
    const primary = Array.from(new Set(countries.map((r) => r.primaryLanguage))).sort();
    const secondary = Array.from(new Set(countries.map((r) => r.secondaryLanguage))).sort();
    return { continents, primary, secondary };
  }, [countries]);

  const filteredCountries = useMemo(
    () => countries.filter((row) => rowMatchesCountriesFilter(row, appliedFilter)),
    [countries, appliedFilter],
  );

  const [orderingSelect, setOrderingSelect] = useState<OrderMode>('reset');
  const [appliedOrderMode, setAppliedOrderMode] = useState<OrderMode>('reset');
  const [currentPage, setCurrentPage] = useState(1);
  const [annualIncomeEur, setAnnualIncomeEur] = useState('');
  const [costVirtualProduct, setCostVirtualProduct] = useState('');
  const [usdEurField, setUsdEurField] = useState('');
  const [pricingHeader, setPricingHeader] = useState<CountryPricingHeader>({
    ourAnnualIncomeEur: 0,
    costVirtualProduct: 0,
    usdToEur: 0,
  });
  const [pricingByCountry, setPricingByCountry] = useState<Record<string, CountryPricingSettings>>({});
  const [headerStatus, setHeaderStatus] = useState<string | null>(null);

  const displayedCountries = useMemo(
    () => sortCountries(filteredCountries, appliedOrderMode),
    [filteredCountries, appliedOrderMode],
  );

  const totalPages = Math.max(1, Math.ceil(displayedCountries.length / COUNTRIES_PAGE_SIZE));

  const paginatedCountries = useMemo(() => {
    const start = (currentPage - 1) * COUNTRIES_PAGE_SIZE;
    return displayedCountries.slice(start, start + COUNTRIES_PAGE_SIZE);
  }, [displayedCountries, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilter, appliedOrderMode]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    const adminData = localStorage.getItem('adminUser');
    if (!adminData) {
      router.push('/');
      return;
    }
    try {
      JSON.parse(adminData);
      setLoading(false);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('adminUser');
      localStorage.removeItem('adminToken');
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    const token = getAdminBearerToken();
    if (!token) return;
    let cancelled = false;
    void fetch('/api/admin/country-pricing', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { header: CountryPricingHeader; countries: Record<string, CountryPricingSettings> } | null) => {
        if (cancelled || !data) return;
        setPricingHeader(data.header);
        setAnnualIncomeEur(amountText(data.header.ourAnnualIncomeEur));
        setCostVirtualProduct(amountText(data.header.costVirtualProduct));
        setUsdEurField(amountText(data.header.usdToEur));
        setPricingByCountry(data.countries ?? {});
        setCountries((prev) =>
          prev.map((row) => applyPricingToRow(row, data.countries?.[row.name.toLowerCase()])),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCountrySave = (
    countryId: number,
    payload: CountryEditSavePayload,
    pricing: CountryPricingSettings,
  ) => {
    setPricingByCountry((prev) => ({ ...prev, [pricing.countryName.toLowerCase()]: pricing }));
    setCountries((prev) =>
      prev.map((row) =>
        row.id === countryId
          ? {
              ...row,
              settingCompleted: payload.settingCompleted,
              iso2: payload.iso2,
              population: payload.population,
              continent: payload.continent,
              officialLanguage: payload.officialLanguage,
              primaryLanguage: payload.primaryLanguage,
              secondaryLanguage: payload.secondaryLanguage,
              currencyCode: payload.currencyCode,
              eurRate: payload.eurRate,
              usdRate: payload.usdRate,
              regions: payload.regions,
            }
          : row,
      ),
    );
  };

  const handleRegionsCountChange = (countryId: number, regionsCount: number) => {
    setCountries((prev) =>
      prev.map((row) => (row.id === countryId ? { ...row, regions: regionsCount } : row)),
    );
  };

  const handleSaveGlobalSettings = async () => {
    const token = getAdminBearerToken();
    if (!token) {
      setHeaderStatus('Not authenticated');
      return;
    }
    setHeaderStatus('Saving…');
    try {
      const res = await fetch('/api/admin/country-pricing', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          header: {
            ourAnnualIncomeEur: parseHeaderAmount(annualIncomeEur),
            costVirtualProduct: parseHeaderAmount(costVirtualProduct),
            usdToEur: parseHeaderAmount(usdEurField),
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setPricingHeader(data.header);
      setHeaderStatus('Saved');
    } catch (e) {
      setHeaderStatus(e instanceof Error ? e.message : 'Save failed');
    }
  };

  if (loading) return null;

  return (
    <div className="h-full flex flex-col bg-gray-100">
      <div className="bg-[#a51d2d] text-white py-2 font-bold text-center text-xl uppercase shadow-md relative z-10 border-b-4 border-[#800000]">
        System Dashboard
      </div>

      <div className="flex flex-1 max-w-[1920px] mx-auto w-full">
        <div className="flex-1 bg-white border-x border-[#c53030] border-b flex flex-col min-w-0">
          <div className="bg-[#5b9bd5] text-white font-bold text-base md:text-lg px-4 py-2.5 shrink-0">
            Countries
          </div>

          <div className="px-3 md:px-4 py-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm border-b border-gray-100">
            <button
              type="button"
              className="bg-[#222] hover:bg-black text-white px-3 py-1.5 rounded-md font-bold inline-flex items-center gap-1.5 border border-black/20"
              onClick={() => {
                setDraftFilter(appliedFilter);
                setFilterOpen(true);
              }}
            >
              Filter
              <ChevronDown className="w-4 h-4 text-white shrink-0" aria-hidden />
            </button>
            <div className="relative">
              <select
                value={orderingSelect}
                onChange={(e) => setOrderingSelect(e.target.value as OrderMode)}
                className="appearance-none bg-white border border-gray-400 px-3 py-1.5 pr-8 rounded-md text-gray-800 min-w-[180px] text-sm"
              >
                {ORDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button
              type="button"
              className="bg-[#d9534f] hover:bg-[#c9302c] text-white px-3 py-1.5 rounded-md font-bold border border-[#a02622]"
              onClick={() => setAppliedOrderMode(orderingSelect)}
            >
              Proceed
            </button>
            <button
              type="button"
              className="bg-[#222] hover:bg-black text-white px-3 py-1.5 rounded-md font-bold border border-black/20"
              onClick={() => window.print()}
            >
              Print
            </button>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 ml-auto justify-end">
              <label className="flex items-center gap-1.5 text-gray-700 text-xs whitespace-nowrap">
                <span>Our annual income EUR</span>
                <input
                  type="text"
                  value={annualIncomeEur}
                  onChange={(e) => setAnnualIncomeEur(e.target.value)}
                  className="border border-gray-400 rounded-sm bg-white px-1.5 py-1 w-[4.5rem] text-xs text-gray-900"
                />
              </label>
              <label className="flex items-center gap-1.5 text-gray-700 text-xs whitespace-nowrap">
                <span>Cost virtual product</span>
                <input
                  type="text"
                  value={costVirtualProduct}
                  onChange={(e) => setCostVirtualProduct(e.target.value)}
                  className="border border-gray-400 rounded-sm bg-white px-1.5 py-1 w-[4.5rem] text-xs text-gray-900"
                />
              </label>
              <label className="flex items-center gap-1.5 text-gray-700 text-xs whitespace-nowrap">
                <span>USD-€</span>
                <input
                  type="text"
                  value={usdEurField}
                  onChange={(e) => setUsdEurField(e.target.value)}
                  className="border border-gray-400 rounded-sm bg-white px-1.5 py-1 w-14 text-xs text-gray-900"
                />
              </label>
              <button
                type="button"
                className="bg-[#222] hover:bg-black text-white px-3 py-1 text-xs font-bold rounded-md border border-black/20"
                onClick={() => void handleSaveGlobalSettings()}
              >
                Save
              </button>
              {headerStatus ? <span className="text-xs text-gray-600">{headerStatus}</span> : null}
              <Link
                href="/operators"
                className="inline-flex items-center justify-center bg-[#222] hover:bg-black text-white px-3 py-2 text-xs font-bold rounded-md border border-black/20 text-center max-w-[220px] leading-tight self-end mt-0.5 sm:mt-0"
              >
                Operators & Agents of whole world
              </Link>
            </div>
          </div>

          <div className="px-3 md:px-4 py-4 flex-1 min-w-0">
          <div className="mb-2">
            <div className="bg-[#d6e4ff] text-gray-900 font-bold text-sm py-2 px-3 border border-gray-300 border-b-0">
              Parameters about the nations
            </div>
            <div className="overflow-x-auto border border-gray-300">
              <table className="w-full text-xs min-w-[1100px]">
                <thead>
                  <tr className="bg-[#e8e0f0] text-gray-800 border-b border-gray-300">
                    <th className="py-2 px-2 w-10 text-left font-bold border-r border-gray-200">
                      <input type="checkbox" aria-label="Select all" className="align-middle" />
                    </th>
                    <th className="py-2 px-2 text-left font-bold border-r border-gray-200 whitespace-nowrap">
                      Country
                    </th>
                    <th className="py-2 px-2 text-center font-bold border-r border-gray-200 w-14">
                      Flag
                    </th>
                    <th className="py-2 px-2 text-left font-bold border-r border-gray-200 whitespace-nowrap">
                      Continent
                    </th>
                    <th className="py-2 px-2 text-right font-bold border-r border-gray-200 whitespace-nowrap">
                      Population
                    </th>
                    <th className="py-2 px-2 text-left font-bold border-r border-gray-200 whitespace-nowrap">
                      Official language
                    </th>
                    <th className="py-2 px-2 text-left font-bold border-r border-gray-200 whitespace-nowrap">
                      Primary language
                    </th>
                    <th className="py-2 px-2 text-left font-bold border-r border-gray-200 whitespace-nowrap">
                      Secondary language
                    </th>
                    <th className="py-2 px-2 text-right font-bold border-r border-gray-200 whitespace-nowrap">
                      Currency 1EUR
                    </th>
                    <th className="py-2 px-2 text-right font-bold border-r border-gray-200 whitespace-nowrap">
                      Currency 1USD
                    </th>
                    <th className="py-2 px-2 text-center font-bold border-r border-gray-200">Curr</th>
                    <th className="py-2 px-2 text-right font-bold border-r border-gray-200">Regions</th>
                    <th className="py-2 px-2 text-center font-bold whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCountries.map((row, index) => (
                    <tr
                      key={row.id}
                      className={`border-b border-gray-200 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-[#f7f7fb]'
                      } hover:bg-amber-50/40`}
                    >
                      <td className="py-1.5 px-2 border-r border-gray-100">
                        <input type="checkbox" aria-label={`Select ${row.name}`} />
                      </td>
                      <td className="py-1.5 px-2 border-r border-gray-100 text-gray-800">{row.name}</td>
                      <td className="py-1.5 px-2 border-r border-gray-100 text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={countryFlagSrc(row.iso2)}
                          alt=""
                          width={24}
                          height={18}
                          className="inline-block border border-gray-200"
                          loading="lazy"
                        />
                      </td>
                      <td className="py-1.5 px-2 border-r border-gray-100 text-gray-700">
                        {row.continent}
                      </td>
                      <td className="py-1.5 px-2 border-r border-gray-100 text-right text-gray-800">
                        {row.population.toLocaleString('en-US')}
                      </td>
                      <td className="py-1.5 px-2 border-r border-gray-100 text-gray-700">
                        {row.officialLanguage}
                      </td>
                      <td className="py-1.5 px-2 border-r border-gray-100 text-gray-700">
                        {row.primaryLanguage}
                      </td>
                      <td className="py-1.5 px-2 border-r border-gray-100 text-gray-700">
                        {row.secondaryLanguage}
                      </td>
                      <td className="py-1.5 px-2 border-r border-gray-100 text-right tabular-nums">
                        {row.eurRate.toFixed(row.eurRate < 10 ? 4 : 2)}
                      </td>
                      <td className="py-1.5 px-2 border-r border-gray-100 text-right tabular-nums">
                        {row.usdRate.toFixed(row.usdRate < 10 ? 4 : 2)}
                      </td>
                      <td className="py-1.5 px-2 border-r border-gray-100 text-center font-medium">
                        {row.currencyCode}
                      </td>
                      <td className="py-1.5 px-2 border-r border-gray-100 text-right tabular-nums">
                        {row.regions}
                      </td>
                      <td className="py-1.5 px-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            className="p-1 rounded text-[#333] hover:bg-gray-200"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1 rounded text-[#333] hover:bg-gray-200"
                            title="Edit"
                            onClick={() => setEditingCountry(row)}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1 rounded text-[#333] hover:bg-gray-200"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 mt-3 text-xs">
            <button
              type="button"
              disabled={currentPage <= 1}
              className="px-2 py-1 border border-gray-300 bg-white hover:bg-gray-100 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            {buildPaginationItems(currentPage, totalPages).map((item, index) =>
              item === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="px-1 text-gray-500">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`px-2 py-1 border rounded-sm ${
                    item === currentPage
                      ? 'bg-[#a51d2d] text-white border-[#800000]'
                      : 'border-gray-300 bg-white hover:bg-gray-100'
                  }`}
                  onClick={() => setCurrentPage(item)}
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              className="px-2 py-1 border border-gray-300 bg-white hover:bg-gray-100 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
            <span className="ml-2 text-gray-600">
              {displayedCountries.length} countries · page {currentPage} of {totalPages}
            </span>
          </div>
          </div>
        </div>
      </div>

      <CountryEditModal
        row={editingCountry}
        header={pricingHeader}
        pricing={editingCountry ? pricingByCountry[editingCountry.name.toLowerCase()] ?? null : null}
        onClose={() => setEditingCountry(null)}
        onSave={handleCountrySave}
        onRegionsCountChange={handleRegionsCountChange}
      />

      <CountriesFilterModal
        open={filterOpen}
        draft={draftFilter}
        onDraftChange={setDraftFilter}
        continentOptions={filterSelectOptions.continents}
        primaryLanguageOptions={filterSelectOptions.primary}
        secondaryLanguageOptions={filterSelectOptions.secondary}
        onOk={() => {
          setAppliedFilter(draftFilter);
          setFilterOpen(false);
        }}
        onExit={() => setFilterOpen(false)}
      />
    </div>
  );
}
