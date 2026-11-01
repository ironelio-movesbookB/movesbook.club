'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  isClubOgpAudienceMode,
  type ClubOgpAudienceMode,
  CLUB_AUDIENCE_OPTIONS,
} from '@/lib/clubOgpAudience';

export type { ClubOgpAudienceMode };

export interface OgpVisibilitySettings {
  userTypes: string[];
  countries: string[];
  languages: string[];
  sports: string[];
  expiresAt: string | null; // ISO date string or null
  /** Club OGP News audience radio (only used when showClubAudienceRadios). */
  clubAudienceMode?: ClubOgpAudienceMode | null;
}

const defaultSettings: OgpVisibilitySettings = {
  userTypes: [],
  countries: [],
  languages: [],
  sports: [],
  expiresAt: null,
  clubAudienceMode: null,
};

/** Normalize ISO or date string to YYYY-MM-DD for <input type="date">. */
function toDateInputValue(expiresAt: string | null | undefined): string {
  if (expiresAt == null || expiresAt === '') return '';
  const s = String(expiresAt).trim();
  if (!s) return '';
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return '';
  }
}

interface Option {
  value: string;
  label: string;
}

interface NewsSettingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSettings?: OgpVisibilitySettings | null;
  onSave: (settings: OgpVisibilitySettings) => void;
  onDeleteSettings?: () => void;
  options: {
    userTypes: Option[];
    countries: string[];
    languages: Option[];
    sports: Option[];
  } | null;
  /** Modal heading; defaults to "OGP News Setting". Music section passes "Music Setting". */
  title?: string;
  /**
   * Club OGP News: show audience radios (Only me / club members / members + filters).
   */
  showClubAudienceRadios?: boolean;
  /**
   * Simulation mode (e.g. “visible by this user”): hide “Who can see it?” / Duration,
   * and use a custom primary action label.
   */
  hideWhoCanSeeDuration?: boolean;
  /** Primary action label; defaults to "Save". */
  saveButtonLabel?: string;
}

export default function NewsSettingModal({
  isOpen,
  onClose,
  initialSettings,
  onSave,
  onDeleteSettings,
  options,
  title = 'OGP News Setting',
  showClubAudienceRadios = false,
  hideWhoCanSeeDuration = false,
  saveButtonLabel = 'Save',
}: NewsSettingModalProps) {
  const [userTypes, setUserTypes] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [sports, setSports] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [enableUserTypes, setEnableUserTypes] = useState(false);
  const [enableCountries, setEnableCountries] = useState(false);
  const [enableLanguages, setEnableLanguages] = useState(false);
  const [enableSports, setEnableSports] = useState(false);
  const [clubAudienceMode, setClubAudienceMode] =
    useState<ClubOgpAudienceMode>('me-and-club-members');

  const filtersEnabled =
    !showClubAudienceRadios || clubAudienceMode === 'me-club-members-and-filters';

  useEffect(() => {
    if (isOpen) {
      const s = initialSettings ?? defaultSettings;
      const nextUserTypes = s.userTypes ?? [];
      const nextCountries = s.countries ?? [];
      const nextLanguages = s.languages ?? [];
      const nextSports = s.sports ?? [];
      setUserTypes(nextUserTypes);
      setCountries(nextCountries);
      setLanguages(nextLanguages);
      setSports(nextSports);
      setExpiresAt(toDateInputValue(s.expiresAt ?? null));
      // Masters = "all selected"; partial/manual picks keep them off.
      const userTypeValues = (options?.userTypes ?? []).map((t) => t.value);
      const languageValues = (options?.languages ?? []).map((l) => l.value);
      const sportValues = (options?.sports ?? []).map((sp) => sp.value);
      setEnableUserTypes(
        userTypeValues.length > 0 &&
          nextUserTypes.length === userTypeValues.length &&
          userTypeValues.every((v) => nextUserTypes.includes(v))
      );
      setEnableCountries(
        !!options?.countries.length &&
          nextCountries.length === options.countries.length &&
          options.countries.every((c) => nextCountries.includes(c))
      );
      setEnableLanguages(
        languageValues.length > 0 &&
          nextLanguages.length === languageValues.length &&
          languageValues.every((v) => nextLanguages.includes(v))
      );
      setEnableSports(
        sportValues.length > 0 &&
          nextSports.length === sportValues.length &&
          sportValues.every((v) => nextSports.includes(v))
      );
      setClubAudienceMode(
        isClubOgpAudienceMode(s.clubAudienceMode)
          ? s.clubAudienceMode
          : 'me-and-club-members',
      );
    }
  }, [isOpen, initialSettings, options]);

  const handleSave = () => {
    onSave({
      // Persist whatever is checked (including manual picks while master is off).
      userTypes,
      countries,
      languages,
      sports,
      expiresAt: expiresAt.trim() || null,
      ...(showClubAudienceRadios ? { clubAudienceMode } : {}),
    });
    onClose();
  };

  const syncSportsMaster = (next: string[]) => {
    if (!options) {
      setEnableSports(false);
      return;
    }
    const all = (options.sports ?? []).map((s) => s.value);
    setEnableSports(
      all.length > 0 &&
        next.length === all.length &&
        all.every((v) => next.includes(v))
    );
  };

  const syncUserTypesMaster = (next: string[]) => {
    if (!options) {
      setEnableUserTypes(false);
      return;
    }
    const all = (options.userTypes ?? []).map((t) => t.value);
    setEnableUserTypes(
      all.length > 0 &&
        next.length === all.length &&
        all.every((v) => next.includes(v))
    );
  };

  const syncLanguagesMaster = (next: string[]) => {
    if (!options) {
      setEnableLanguages(false);
      return;
    }
    const all = (options.languages ?? []).map((l) => l.value);
    setEnableLanguages(
      all.length > 0 &&
        next.length === all.length &&
        all.every((v) => next.includes(v))
    );
  };

  const syncCountryMaster = (next: string[]) => {
    if (!options) {
      setEnableCountries(false);
      return;
    }
    setEnableCountries(
      options.countries.length > 0 &&
        next.length === options.countries.length &&
        options.countries.every((c) => next.includes(c))
    );
  };

  const toggleSport = (value: string) => {
    if (!filtersEnabled) return;
    const next = sports.includes(value)
      ? sports.filter((x) => x !== value)
      : [...sports, value];
    setSports(next);
    syncSportsMaster(next);
  };

  const toggleUserType = (value: string) => {
    if (!filtersEnabled) return;
    const next = userTypes.includes(value)
      ? userTypes.filter((x) => x !== value)
      : [...userTypes, value];
    setUserTypes(next);
    syncUserTypesMaster(next);
  };

  const toggleLanguage = (value: string) => {
    if (!filtersEnabled) return;
    const next = languages.includes(value)
      ? languages.filter((x) => x !== value)
      : [...languages, value];
    setLanguages(next);
    syncLanguagesMaster(next);
  };

  const toggleCountry = (value: string) => {
    if (!filtersEnabled) return;
    const next = countries.includes(value)
      ? countries.filter((x) => x !== value)
      : [...countries, value];
    setCountries(next);
    syncCountryMaster(next);
  };

  const handleDeleteSettings = () => {
    onSave({
      ...defaultSettings,
      ...(showClubAudienceRadios
        ? { clubAudienceMode: 'me-and-club-members' as ClubOgpAudienceMode }
        : {}),
    });
    onDeleteSettings?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="news-setting-title"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 id="news-setting-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {onDeleteSettings && (
              <button
                type="button"
                onClick={handleDeleteSettings}
                className="text-sm px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg"
              >
                Delete Settings
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!hideWhoCanSeeDuration && (
            <>
              <p className="text-sm font-medium text-gray-700">Who can see it?</p>

              {showClubAudienceRadios && (
                <fieldset className="space-y-2.5">
                  <legend className="sr-only">Who can see this article in the club</legend>
                  {CLUB_AUDIENCE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-start gap-2.5 cursor-pointer select-none"
                    >
                      <input
                        type="radio"
                        name="club-audience-mode"
                        value={opt.value}
                        checked={clubAudienceMode === opt.value}
                        onChange={() => setClubAudienceMode(opt.value)}
                        className="mt-0.5 h-4 w-4 shrink-0 border-gray-400 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span className="text-sm text-gray-900 leading-snug drop-shadow-sm">
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (expiration date)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setExpiresAt('2099-12-31')}
                    disabled={expiresAt === '2099-12-31'}
                    className="shrink-0 px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600"
                    aria-label="No expiration"
                    title="No expiration"
                  >
                    No Expiration
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  After this date the article is hidden from users. Super admin and admin still see
                  it.
                </p>
              </div>
            </>
          )}

          {options && (
            <div
              className={`space-y-4 ${
                filtersEnabled ? '' : 'opacity-50 pointer-events-none select-none'
              }`}
              aria-disabled={!filtersEnabled}
            >
              {/* Users Sports: master selects/clears all; individuals stay editable when master is off */}
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={enableSports}
                    disabled={!filtersEnabled}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setEnableSports(checked);
                      setSports(checked ? (options.sports ?? []).map((s) => s.value) : []);
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium">Users Sports</span>
                </label>
                <div className="border border-gray-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {(options.sports ?? []).map((s) => (
                      <label key={s.value} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={sports.includes(s.value)}
                          onChange={() => toggleSport(s.value)}
                          disabled={!filtersEnabled}
                          className="rounded border-gray-300"
                        />
                        {s.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Users Type: master selects/clears all; individuals stay editable when master is off */}
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={enableUserTypes}
                    disabled={!filtersEnabled}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setEnableUserTypes(checked);
                      setUserTypes(checked ? (options.userTypes ?? []).map((t) => t.value) : []);
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium">Users Type</span>
                </label>
                <div className="border border-gray-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {(options.userTypes ?? []).map((t) => (
                      <label key={t.value} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={userTypes.includes(t.value)}
                          onChange={() => toggleUserType(t.value)}
                          disabled={!filtersEnabled}
                          className="rounded border-gray-300"
                        />
                        {t.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Language: master selects/clears all; individuals stay editable when master is off */}
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={enableLanguages}
                    disabled={!filtersEnabled}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setEnableLanguages(checked);
                      setLanguages(checked ? (options.languages ?? []).map((l) => l.value) : []);
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium">Language</span>
                </label>
                <div className="border border-gray-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {(options.languages ?? []).map((l) => (
                      <label key={l.value} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={languages.includes(l.value)}
                          onChange={() => toggleLanguage(l.value)}
                          disabled={!filtersEnabled}
                          className="rounded border-gray-300"
                        />
                        {l.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Country: master selects/clears all; individuals stay editable when master is off */}
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={enableCountries}
                    disabled={!filtersEnabled}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setEnableCountries(checked);
                      setCountries(checked ? (options.countries ?? []).slice() : []);
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium">Country</span>
                </label>
                <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <div className="flex flex-col gap-1.5">
                    {(options.countries ?? []).map((c) => (
                      <label key={c} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={countries.includes(c)}
                          onChange={() => toggleCountry(c)}
                          disabled={!filtersEnabled}
                          className="rounded border-gray-300"
                        />
                        {c}
                      </label>
                    ))}
                    {(options.countries ?? []).length === 0 && (
                      <p className="text-xs text-gray-500">No countries available.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium"
          >
            Back as before
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium"
          >
            {saveButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export { defaultSettings };
