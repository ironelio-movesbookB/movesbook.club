'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckRow,
  Field,
  Row2,
  Row4,
  SectionCard,
  TextInput,
  TextSelect,
} from '@/components/club/memberProfile/FormBits';
import type { ClubMemberScopedData } from '@/lib/club/memberProfileTypes';
import {
  ATHLETIC_LEVEL_OPTIONS,
  FOLLOW_UP_NOTIFICATION_OPTIONS,
  MAIN_SPORTS,
  SHARING_DEFAULT_OPTIONS,
  TEAM_ATHLETE_STATUS_OPTIONS,
  TEAM_FOOTBALL_PAYMENT_METHOD_OPTIONS,
} from '@/lib/club/memberProfileTypes';
import { getAuthHeaders, withSelectedClubId } from '@/lib/club/servicePurchasesClient';
import {
  ENTITY_SPORT_OPTIONS,
  isFootballSport,
  normalizeEntitySport,
} from '@/lib/sport/entitySportOptions';
import {
  emptySportDropdownCatalog,
  normalizeSportDropdownCatalog,
  optionsForSportParameter,
  parameterLabelForLanguage,
  type SportDropdownCatalog,
} from '@/lib/sport/sportDropdownParameters';
import {
  MAX_DEFAULT_PAYMENT_METHODS,
  PAYMENT_STATUS_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  sanitizeDefaultPaymentMethods,
} from '@/lib/procedures/payModes';
import { useLanguage } from '@/contexts/LanguageContext';

type MemberTypeOption = {
  id: string;
  name: string;
  discountSubscription: string;
  discountServices: string;
  discountRest: string;
  discountSupplement: string;
  discountClothing: string;
  discountOutfit: string;
};

type Props = {
  clubId: string;
  entitySportDefault: string;
  /** Club archive vs Team archive — drives TEAM fields labels. */
  workspaceKind?: 'club' | 'team';
  club: ClubMemberScopedData;
  setClub: (
    next: ClubMemberScopedData | ((prev: ClubMemberScopedData) => ClubMemberScopedData),
  ) => void;
  readOnlyClub: boolean;
  showVisibility: boolean;
  canEditPaymentDefaults: boolean;
  saving: boolean;
  message: string;
  onSave: () => void;
};

type InstallmentKey = 'firstPayment' | 'secondPayment' | 'thirdPayment';

export default function MemberProfileSettingsTab({
  clubId,
  entitySportDefault,
  workspaceKind = 'club',
  club,
  setClub,
  readOnlyClub,
  showVisibility,
  canEditPaymentDefaults,
  saving,
  message,
  onSave,
}: Props) {
  const { currentLanguage } = useLanguage();
  const lang = (currentLanguage || 'en').toLowerCase().split('-')[0] || 'en';
  const s = club.settings;
  const ac = s.accessControl;
  const ss = s.secondaryScreen;
  const [sportDropdownCatalog, setSportDropdownCatalog] = useState<SportDropdownCatalog>(
    emptySportDropdownCatalog(),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/admin/sport-dropdown-parameters', {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          setSportDropdownCatalog(normalizeSportDropdownCatalog(json.catalog));
        }
      } catch {
        /* keep empty catalog */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const teamSportKey = normalizeEntitySport(
    s.teamSport || entitySportDefault || 'Football',
  );

  const categoryOptions = useMemo(
    () => optionsForSportParameter(sportDropdownCatalog, teamSportKey, 'category', lang),
    [sportDropdownCatalog, teamSportKey, lang],
  );
  const positionOptions = useMemo(
    () => optionsForSportParameter(sportDropdownCatalog, teamSportKey, 'position', lang),
    [sportDropdownCatalog, teamSportKey, lang],
  );
  const specialtyOptions = useMemo(
    () => optionsForSportParameter(sportDropdownCatalog, teamSportKey, 'specialty', lang),
    [sportDropdownCatalog, teamSportKey, lang],
  );

  const categoryLabel = parameterLabelForLanguage(
    sportDropdownCatalog,
    teamSportKey,
    'category',
    lang,
    'Category',
  );
  const positionLabel = parameterLabelForLanguage(
    sportDropdownCatalog,
    teamSportKey,
    'position',
    lang,
    'Position',
  );
  const specialtyLabel = parameterLabelForLanguage(
    sportDropdownCatalog,
    teamSportKey,
    'specialty',
    lang,
    'Specialty',
  );
  const [memberTypes, setMemberTypes] = useState<MemberTypeOption[]>([]);
  const [memberTypesLoading, setMemberTypesLoading] = useState(true);
  const [defaultPaymentMethods, setDefaultPaymentMethods] = useState<string[]>([]);
  const [defaultsMessage, setDefaultsMessage] = useState('');

  useEffect(() => {
    if (!clubId) {
      setMemberTypes([]);
      setMemberTypesLoading(false);
      return;
    }
    let cancelled = false;
    async function loadMemberTypes() {
      setMemberTypesLoading(true);
      try {
        const res = await fetch(
          withSelectedClubId(
            `/api/club/settings/tables/member-types?scope=profile&clubId=${encodeURIComponent(clubId)}`,
          ),
          {
            headers: getAuthHeaders(),
          },
        );
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const items = Array.isArray(json.items) ? json.items : [];
        setMemberTypes(
          items
            .map(
              (row: {
                id?: string;
                name?: string;
                discountSubscription?: string;
                discountServices?: string;
                discountRest?: string;
                discountSupplement?: string;
                discountClothing?: string;
                discountOutfit?: string;
              }) => ({
                id: String(row.id || ''),
                name: String(row.name || '').trim(),
                discountSubscription: String(row.discountSubscription || ''),
                discountServices: String(row.discountServices || ''),
                discountRest: String(row.discountRest || ''),
                discountSupplement: String(row.discountSupplement || ''),
                discountClothing: String(row.discountClothing || ''),
                discountOutfit: String(row.discountOutfit || ''),
              }),
            )
            .filter((row: MemberTypeOption) => row.id && row.name),
        );
      } catch {
        if (!cancelled) setMemberTypes([]);
      } finally {
        if (!cancelled) setMemberTypesLoading(false);
      }
    }
    void loadMemberTypes();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/clubs/${encodeURIComponent(clubId)}/payment-method-defaults`,
          { headers: getAuthHeaders() },
        );
        const json = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        setDefaultPaymentMethods(sanitizeDefaultPaymentMethods(json.defaultPaymentMethods));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const patchSettings = (
    patch: (prev: ClubMemberScopedData['settings']) => ClubMemberScopedData['settings'],
  ) => {
    setClub((c) => ({ ...c, settings: patch(c.settings) }));
  };

  const patchInstallment = (
    key: InstallmentKey,
    field: 'amount' | 'date' | 'status',
    value: string,
  ) => {
    patchSettings((prev) => ({
      ...prev,
      football: {
        ...prev.football,
        [key]: { ...prev.football[key], [field]: value },
      },
    }));
  };

  const toggleDefaultPaymentMethod = (methodId: string) => {
    setDefaultPaymentMethods((prev) => {
      if (prev.includes(methodId)) return prev.filter((id) => id !== methodId);
      if (prev.length >= MAX_DEFAULT_PAYMENT_METHODS) return prev;
      return [...prev, methodId];
    });
    setDefaultsMessage('');
  };

  const sportMode =
    s.sportMode ?? (s.teamFootballEnabled && !s.clubGymEnabled ? 'TEAM-FOOTBALL' : 'CLUB-GYM');
  const memberSettingKind: 'club' | 'team' =
    s.memberSettingKind ?? (sportMode === 'TEAM-FOOTBALL' ? 'team' : 'club');
  const accessFunctionsEnabled = Boolean(s.accessFunctionsEnabled);
  const accessFieldsDisabled = readOnlyClub || !accessFunctionsEnabled;
  const selectedTeamSport = normalizeEntitySport(
    s.teamSport || entitySportDefault || 'Football',
  );
  const showFootballFields = memberSettingKind === 'team' && isFootballSport(selectedTeamSport);

  const applyMemberType = (memberTypeId: string) => {
    const selected = memberTypes.find((item) => item.id === memberTypeId);
    patchSettings((prev) => ({
      ...prev,
      memberTypeId,
      discounts: selected
        ? {
            subscript: selected.discountSubscription,
            service: selected.discountServices,
            barRest: selected.discountRest,
            supply: selected.discountSupplement,
            clothing: selected.discountClothing,
            outfit: selected.discountOutfit,
          }
        : prev.discounts,
    }));
  };

  const handleSave = async () => {
    if (canEditPaymentDefaults && clubId) {
      try {
        const res = await fetch(
          `/api/clubs/${encodeURIComponent(clubId)}/payment-method-defaults`,
          {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ defaultPaymentMethods }),
          },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setDefaultsMessage(json.error || 'Failed to save payment method defaults');
        } else {
          setDefaultPaymentMethods(
            sanitizeDefaultPaymentMethods(json.defaultPaymentMethods ?? defaultPaymentMethods),
          );
          setDefaultsMessage('');
        }
      } catch {
        setDefaultsMessage('Failed to save payment method defaults');
      }
    }
    onSave();
  };

  const installmentRows: Array<{ key: InstallmentKey; label: string }> = [
    { key: 'firstPayment', label: 'First payment' },
    { key: 'secondPayment', label: 'Second payment' },
    { key: 'thirdPayment', label: 'Third payment' },
  ];

  return (
    <div>
      {showVisibility ? (
        <SectionCard title="Member visibility" tone="purple">
          <CheckRow
            label="Allow member to read Settings"
            checked={club.visibility.settings}
            disabled={readOnlyClub}
            onChange={(v) =>
              setClub((c) => ({
                ...c,
                visibility: { ...c.visibility, settings: v },
              }))
            }
          />
        </SectionCard>
      ) : null}

      <SectionCard title="Preferences">
        <p className="mb-3 text-sm font-semibold text-gray-800">Default assigned</p>
        <Field label="Member type">
          <TextSelect
            disabled={readOnlyClub || memberTypesLoading}
            value={s.memberTypeId}
            onChange={(e) => applyMemberType(e.target.value)}
          >
            <option value="">
              {memberTypesLoading
                ? 'Loading…'
                : memberTypes.length === 0
                  ? 'No member types yet'
                  : 'Select'}
            </option>
            {memberTypes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
            {s.memberTypeId && !memberTypes.some((item) => item.id === s.memberTypeId) ? (
              <option value={s.memberTypeId}>Saved type #{s.memberTypeId}</option>
            ) : null}
          </TextSelect>
          {!memberTypesLoading && memberTypes.length === 0 ? (
            <p className="mt-1 text-xs text-gray-500">
              Add types under{' '}
              <a
                href="/club/settings/tables/member_type"
                className="text-blue-800 underline"
                target="_blank"
                rel="noreferrer"
              >
                Club management → Administration → General settings → Tables → Member type
              </a>
              . Choosing a type fills Discount % automatically.
            </p>
          ) : null}
        </Field>
        <p className="mb-2 mt-3 text-sm font-semibold text-gray-800">Discount %</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-100">
                {(
                  [
                    ['subscript', 'Subscript'],
                    ['service', 'Service'],
                    ['barRest', 'Bar/Rest'],
                    ['supply', 'Supply'],
                    ['clothing', 'Clothing'],
                    ['outfit', 'Outfit'],
                  ] as const
                ).map(([key, label]) => (
                  <th key={key} className="border border-gray-300 px-2 py-1.5 text-left">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {(
                  ['subscript', 'service', 'barRest', 'supply', 'clothing', 'outfit'] as const
                ).map((key) => (
                  <td key={key} className="border border-gray-300 p-1">
                    <TextInput
                      disabled={readOnlyClub}
                      value={s.discounts[key]}
                      maxLength={2}
                      onChange={(e) =>
                        patchSettings((prev) => ({
                          ...prev,
                          discounts: { ...prev.discounts, [key]: e.target.value },
                        }))
                      }
                      className="bg-[#fffde7]"
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Maximum permitted total debt at the time of the purchases">
        <Field label="Debt purchases">
          <TextInput
            disabled={readOnlyClub}
            inputMode="numeric"
            maxLength={4}
            value={s.debtPurchases}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
              if (digits === '') {
                patchSettings((prev) => ({ ...prev, debtPurchases: '' }));
                return;
              }
              const n = Math.min(9999, Math.max(0, Number.parseInt(digits, 10)));
              patchSettings((prev) => ({
                ...prev,
                debtPurchases: Number.isFinite(n) ? String(n) : '',
              }));
            }}
          />
        </Field>
      </SectionCard>

      <SectionCard title="Other settings">
        <Row2>
          <Field label="Heart rate">
            <TextInput
              disabled={readOnlyClub}
              inputMode="numeric"
              maxLength={3}
              value={s.heartRate}
              placeholder="heart rate min"
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 3);
                if (digits === '') {
                  patchSettings((prev) => ({ ...prev, heartRate: '' }));
                  return;
                }
                let n = Number.parseInt(digits, 10);
                if (!Number.isFinite(n)) {
                  patchSettings((prev) => ({ ...prev, heartRate: '' }));
                  return;
                }
                if (n > 199) n = 199;
                // Allow typing below 30 until the value is complete (3 digits).
                if (digits.length >= 3 && n < 30) n = 30;
                patchSettings((prev) => ({
                  ...prev,
                  heartRate: String(n),
                }));
              }}
              onBlur={() => {
                const raw = String(s.heartRate || '').replace(/\D/g, '');
                if (!raw) return;
                let n = Number.parseInt(raw, 10);
                if (!Number.isFinite(n)) return;
                n = Math.min(199, Math.max(30, n));
                if (String(n) !== s.heartRate) {
                  patchSettings((prev) => ({ ...prev, heartRate: String(n) }));
                }
              }}
            />
          </Field>
          <Field label="Athletic level">
            <TextSelect
              disabled={readOnlyClub}
              value={s.athleticLevel}
              onChange={(e) =>
                patchSettings((prev) => ({ ...prev, athleticLevel: e.target.value }))
              }
            >
              <option value="">—</option>
              {ATHLETIC_LEVEL_OPTIONS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field label="Sharing default">
            <TextSelect
              disabled={readOnlyClub}
              value={s.sharingDefault}
              onChange={(e) =>
                patchSettings((prev) => ({ ...prev, sharingDefault: e.target.value }))
              }
            >
              {SHARING_DEFAULT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field label="Receive follow ups notifications and mails">
            <TextSelect
              disabled={readOnlyClub}
              value={s.followUpNotifications}
              onChange={(e) =>
                patchSettings((prev) => ({
                  ...prev,
                  followUpNotifications: e.target.value,
                }))
              }
            >
              {FOLLOW_UP_NOTIFICATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </TextSelect>
          </Field>
        </Row2>
        <CheckRow
          label="Information and updates"
          disabled={readOnlyClub}
          checked={s.informationUpdates}
          onChange={(v) => patchSettings((prev) => ({ ...prev, informationUpdates: v }))}
        />
      </SectionCard>

      <SectionCard title="The settings if the member…" tone="red">
        <div className="space-y-3 text-sm text-gray-800">
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="member-setting-kind"
              disabled={readOnlyClub}
              checked={memberSettingKind === 'club'}
              onChange={() =>
                patchSettings((prev) => ({
                  ...prev,
                  memberSettingKind: 'club',
                  clubGymEnabled: true,
                  teamFootballEnabled: false,
                  sportMode: 'CLUB-GYM',
                }))
              }
              className="mt-1"
            />
            <span>
              The settings if the member is member of a <strong>Club</strong>
            </span>
          </label>

          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="member-setting-kind"
              disabled={readOnlyClub}
              checked={memberSettingKind === 'team'}
              onChange={() =>
                patchSettings((prev) => ({
                  ...prev,
                  memberSettingKind: 'team',
                  clubGymEnabled: false,
                  teamFootballEnabled: true,
                  sportMode: 'TEAM-FOOTBALL',
                  teamSport: normalizeEntitySport(
                    prev.teamSport || entitySportDefault || 'Football',
                  ),
                }))
              }
              className="mt-1"
            />
            <span>
              The settings if the member is member of a <strong>Team</strong>
            </span>
          </label>

          {memberSettingKind === 'team' ? (
            <Field label="Type of team">
              <TextSelect
                disabled={readOnlyClub}
                value={normalizeEntitySport(s.teamSport || entitySportDefault)}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    teamSport: e.target.value,
                  }))
                }
              >
                {ENTITY_SPORT_OPTIONS.map((sport) => (
                  <option key={sport} value={sport}>
                    {sport}
                  </option>
                ))}
              </TextSelect>
              <p className="mt-1 text-xs text-gray-500">
                Default from Team/Club profile: {entitySportDefault || 'Football'}
              </p>
            </Field>
          ) : null}
        </div>
      </SectionCard>

      {memberSettingKind === 'club' ? (
        <>
      <SectionCard title="Access & display functions">
        <CheckRow
          label="Enable Access control, debt at access, and secondary screen functions"
          disabled={readOnlyClub}
          checked={accessFunctionsEnabled}
          onChange={(v) =>
            patchSettings((prev) => ({ ...prev, accessFunctionsEnabled: v }))
          }
        />
        {!accessFunctionsEnabled ? (
          <p className="mt-2 text-xs text-gray-500">
            Uncheck to disable access control, debt-at-access, and secondary screen for this club member.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title="Access control about the member">
            <p className="mb-2 text-sm font-semibold text-gray-800">
              Type of control enabled on this member
            </p>
            <div className={`space-y-3 text-sm ${accessFieldsDisabled ? 'opacity-60' : ''}`}>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  disabled={accessFieldsDisabled}
                  checked={ac.activeBlockAccess === 'analyzes_all'}
                  onChange={() =>
                    patchSettings((prev) => ({
                      ...prev,
                      accessControl: {
                        ...prev.accessControl,
                        activeBlockAccess: 'analyzes_all',
                      },
                    }))
                  }
                  className="mt-1"
                />
                <span>
                  <strong>Analyzes all the parameters for the access</strong> (default status)
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    disabled={accessFieldsDisabled}
                    checked={ac.activeBlockAccess === 'free_access'}
                    onChange={() =>
                      patchSettings((prev) => ({
                        ...prev,
                        accessControl: {
                          ...prev.accessControl,
                          activeBlockAccess: 'free_access',
                        },
                      }))
                    }
                  />
                  <strong>
                    Authorized to <span className="text-green-700">free access</span> until
                  </strong>
                </label>
                <TextInput
                  type="date"
                  disabled={accessFieldsDisabled || ac.activeBlockAccess !== 'free_access'}
                  value={ac.freeAccessDate}
                  onChange={(e) =>
                    patchSettings((prev) => ({
                      ...prev,
                      accessControl: {
                        ...prev.accessControl,
                        freeAccessDate: e.target.value,
                      },
                    }))
                  }
                  className="max-w-[11rem]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    disabled={accessFieldsDisabled}
                    checked={ac.activeBlockAccess === 'access_from'}
                    onChange={() =>
                      patchSettings((prev) => ({
                        ...prev,
                        accessControl: {
                          ...prev.accessControl,
                          activeBlockAccess: 'access_from',
                        },
                      }))
                    }
                  />
                  <strong className="text-red-700">Active block access from</strong>
                </label>
                <TextInput
                  type="date"
                  disabled={accessFieldsDisabled || ac.activeBlockAccess !== 'access_from'}
                  value={ac.activeBlockAccessFrom}
                  onChange={(e) =>
                    patchSettings((prev) => ({
                      ...prev,
                      accessControl: {
                        ...prev.accessControl,
                        activeBlockAccessFrom: e.target.value,
                      },
                    }))
                  }
                  className="max-w-[11rem]"
                />
                <strong className="text-red-700">to</strong>
                <TextInput
                  type="date"
                  disabled={accessFieldsDisabled || ac.activeBlockAccess !== 'access_from'}
                  value={ac.activeBlockAccessTo}
                  onChange={(e) =>
                    patchSettings((prev) => ({
                      ...prev,
                      accessControl: {
                        ...prev.accessControl,
                        activeBlockAccessTo: e.target.value,
                      },
                    }))
                  }
                  className="max-w-[11rem]"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Maximum permitted total debt at the time of access">
            <Field label="Debt max">
              <TextInput
                disabled={accessFieldsDisabled}
                value={ac.debtMax}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    accessControl: { ...prev.accessControl, debtMax: e.target.value },
                  }))
                }
              />
            </Field>
          </SectionCard>

          <SectionCard title="Personal setting for secondary screen">
            <CheckRow
              label="Personal setting for secondary screen"
              disabled={accessFieldsDisabled}
              checked={ss.enabled}
              onChange={(v) =>
                patchSettings((prev) => ({
                  ...prev,
                  secondaryScreen: { ...prev.secondaryScreen, enabled: v },
                }))
              }
            />
            <p className="mb-2 text-sm text-gray-700">
              Permission to display &amp; playback in the access control
            </p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {(
                [
                  ['memberName', "Member's name"],
                  ['expSubscription', 'Expiration of subscription'],
                  ['memberPhoto', "Member's photo"],
                  ['outcomeAccess', 'Outcome of the access'],
                  ['residualDebt', 'Residual debt'],
                  ['audioMessages', "Audio messages by club's staff"],
                  ['birthDay', 'Birth day'],
                  ['otherManagementData', 'Other management data'],
                  ['msgFromOtherMember', 'Messages from other members'],
                ] as const
              ).map(([key, label]) => (
                <CheckRow
                  key={key}
                  label={label}
                  disabled={accessFieldsDisabled || !ss.enabled}
                  checked={ss[key]}
                  onChange={(v) =>
                    patchSettings((prev) => ({
                      ...prev,
                      secondaryScreen: { ...prev.secondaryScreen, [key]: v },
                    }))
                  }
                />
              ))}
            </div>
          </SectionCard>
        </>
      ) : null}

      <SectionCard title="Type of payments — method default" tone="red">
        <p className="mb-3 text-xs text-gray-600">
          Tag up to {MAX_DEFAULT_PAYMENT_METHODS} payment types shown first on payment forms.
          Operators can choose <strong>Others</strong> to see the remaining types.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PAYMENT_TYPE_OPTIONS.map((method) => {
            const checked = defaultPaymentMethods.includes(method.value);
            const disableNew =
              !checked && defaultPaymentMethods.length >= MAX_DEFAULT_PAYMENT_METHODS;
            return (
              <label
                key={method.value}
                className={`inline-flex items-center gap-2 text-sm ${
                  disableNew ? 'text-gray-400' : 'text-gray-800'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!canEditPaymentDefaults || readOnlyClub || disableNew}
                  checked={checked}
                  onChange={() => toggleDefaultPaymentMethod(method.value)}
                />
                <span>{method.label}</span>
              </label>
            );
          })}
        </div>
        {defaultsMessage ? (
          <p className="mt-2 text-xs text-red-600">{defaultsMessage}</p>
        ) : (
          <p className="mt-2 text-xs text-gray-500">
            Selected: {defaultPaymentMethods.length}/{MAX_DEFAULT_PAYMENT_METHODS}
          </p>
        )}
      </SectionCard>

      {showFootballFields ? (
        <SectionCard title={`TEAM fields — ${selectedTeamSport}`}>
          <Row2>
            <Field label="Membership number">
              <TextInput
                disabled={readOnlyClub}
                value={s.football.membershipNumber}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, membershipNumber: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Expiring date">
              <TextInput
                type="date"
                disabled={readOnlyClub}
                value={s.football.expiringDate}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, expiringDate: e.target.value },
                  }))
                }
              />
            </Field>
          </Row2>

          <Field label="Annual membership fee">
            <TextInput
              disabled={readOnlyClub}
              value={s.football.annualMembershipFee}
              onChange={(e) =>
                patchSettings((prev) => ({
                  ...prev,
                  football: { ...prev.football, annualMembershipFee: e.target.value },
                }))
              }
            />
          </Field>

          <div className="mt-3 space-y-3">
            <p className="text-sm font-semibold text-gray-800">Payments</p>
            {installmentRows.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-1 gap-2 md:grid-cols-2 md:items-end">
                <Field label={`${label} date`}>
                  <TextInput
                    type="date"
                    disabled={readOnlyClub}
                    value={s.football[key].date}
                    onChange={(e) => patchInstallment(key, 'date', e.target.value)}
                  />
                </Field>
                <Field label={`${label} amount`}>
                  <TextInput
                    disabled={readOnlyClub}
                    value={s.football[key].amount}
                    onChange={(e) => patchInstallment(key, 'amount', e.target.value)}
                  />
                </Field>
              </div>
            ))}
          </div>

          <Row2>
            <Field label="Payment method">
              <TextSelect
                disabled={readOnlyClub}
                value={s.football.paymentMethod}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, paymentMethod: e.target.value },
                  }))
                }
              >
                <option value="">—</option>
                {TEAM_FOOTBALL_PAYMENT_METHOD_OPTIONS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <Field label="Payment status">
              <TextSelect
                disabled={readOnlyClub}
                value={s.football.paymentStatus}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, paymentStatus: e.target.value },
                  }))
                }
              >
                <option value="">—</option>
                {PAYMENT_STATUS_OPTIONS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </TextSelect>
            </Field>
          </Row2>

          <div className="mt-4">
            <Field label="Athlete status">
              <div className="flex flex-wrap gap-4">
                {TEAM_ATHLETE_STATUS_OPTIONS.map((status) => (
                  <label
                    key={status}
                    className="inline-flex items-center gap-2 text-sm text-gray-800"
                  >
                    <input
                      type="radio"
                      name="settingsAthleteStatus"
                      disabled={readOnlyClub}
                      checked={s.football.athleteStatus === status}
                      onChange={() =>
                        patchSettings((prev) => ({
                          ...prev,
                          football: { ...prev.football, athleteStatus: status },
                        }))
                      }
                      className="border-gray-400"
                    />
                    {status}
                  </label>
                ))}
              </div>
            </Field>
          </div>

          <Row2>
            <Field
              label={workspaceKind === 'team' ? 'Team names' : 'Club names'}
              labelClassName="text-lg"
            >
              <TextInput
                disabled={readOnlyClub}
                value={s.football.teamNames}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, teamNames: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Previous club">
              <TextInput
                disabled={readOnlyClub}
                value={s.football.previousClub}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, previousClub: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Release date">
              <TextInput
                type="date"
                disabled={readOnlyClub}
                value={s.football.releaseDate}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, releaseDate: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Player registration">
              <TextSelect
                disabled={readOnlyClub}
                value={s.football.playerRegistration}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, playerRegistration: e.target.value },
                  }))
                }
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </TextSelect>
            </Field>
            <Field label="Sports season">
              <TextInput
                disabled={readOnlyClub}
                value={s.football.sportsSeason}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, sportsSeason: e.target.value },
                  }))
                }
              />
            </Field>
          </Row2>

          <Row2>
            <Field label={`${categoryLabel} **`}>
              <TextSelect
                disabled={readOnlyClub || categoryOptions.length === 0}
                value={s.football.category}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, category: e.target.value },
                  }))
                }
              >
                <option value="">—</option>
                {categoryOptions.map((o) => (
                  <option key={o.id} value={o.label}>
                    {o.label}
                  </option>
                ))}
                {s.football.category &&
                !categoryOptions.some((o) => o.label === s.football.category) ? (
                  <option value={s.football.category}>{s.football.category}</option>
                ) : null}
              </TextSelect>
              {categoryOptions.length === 0 ? (
                <p className="mt-1 text-xs text-gray-500">
                  Options from Super Admin → Sport settings → Tools Settings → Dropdown
                  parameters for sport ({teamSportKey}).
                </p>
              ) : null}
            </Field>
            <Field label={`${positionLabel} **`}>
              <TextSelect
                disabled={readOnlyClub || positionOptions.length === 0}
                value={s.football.position}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, position: e.target.value },
                  }))
                }
              >
                <option value="">—</option>
                {positionOptions.map((o) => (
                  <option key={o.id} value={o.label}>
                    {o.label}
                  </option>
                ))}
                {s.football.position &&
                !positionOptions.some((o) => o.label === s.football.position) ? (
                  <option value={s.football.position}>{s.football.position}</option>
                ) : null}
              </TextSelect>
              {positionOptions.length === 0 ? (
                <p className="mt-1 text-xs text-gray-500">
                  Options from Super Admin → Sport settings → Tools Settings → Dropdown
                  parameters for sport ({teamSportKey}).
                </p>
              ) : null}
            </Field>
            <Field label={`${specialtyLabel} **`}>
              <TextSelect
                disabled={readOnlyClub || specialtyOptions.length === 0}
                value={s.football.specialty}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, specialty: e.target.value },
                  }))
                }
              >
                <option value="">—</option>
                {specialtyOptions.map((o) => (
                  <option key={o.id} value={o.label}>
                    {o.label}
                  </option>
                ))}
                {s.football.specialty &&
                !specialtyOptions.some((o) => o.label === s.football.specialty) ? (
                  <option value={s.football.specialty}>{s.football.specialty}</option>
                ) : null}
              </TextSelect>
              {specialtyOptions.length === 0 ? (
                <p className="mt-1 text-xs text-gray-500">
                  Options from Super Admin → Sport settings → Tools Settings → Dropdown
                  parameters for sport ({teamSportKey}).
                </p>
              ) : null}
            </Field>
          </Row2>

          <Row2>
            <Field label="Foot/Hand">
              <TextSelect
                disabled={readOnlyClub}
                value={s.football.footHand}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, footHand: e.target.value },
                  }))
                }
              >
                <option value="">—</option>
                {['Right', 'Left', 'Ambidextrous'].map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <Field label="Jersey number">
              <TextInput
                disabled={readOnlyClub}
                value={s.football.jerseyNumber}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, jerseyNumber: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Jersey size (alphanumeric, max 5)">
              <TextInput
                disabled={readOnlyClub}
                maxLength={5}
                inputMode="text"
                autoComplete="off"
                value={s.football.jerseySize}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: {
                      ...prev.football,
                      jerseySize: e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5),
                    },
                  }))
                }
              />
            </Field>
            <Field label="Shorts size (alphanumeric, max 5)">
              <TextInput
                disabled={readOnlyClub}
                maxLength={5}
                inputMode="text"
                autoComplete="off"
                value={s.football.shortsSize}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: {
                      ...prev.football,
                      shortsSize: e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5),
                    },
                  }))
                }
              />
            </Field>
            <Field label="Shoe size (00.0)">
              <TextInput
                disabled={readOnlyClub}
                inputMode="decimal"
                autoComplete="off"
                placeholder="00.0"
                value={s.football.shoeSize}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^\d.]/g, '');
                  const parts = cleaned.split('.');
                  const whole = (parts[0] || '').slice(0, 2);
                  const frac = (parts[1] || '').slice(0, 1);
                  const shoeSize = parts.length > 1 ? `${whole}.${frac}` : whole;
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, shoeSize },
                  }));
                }}
              />
            </Field>
          </Row2>

          <Row2>
            <Field label="Shoes number">
              <TextSelect
                disabled={readOnlyClub}
                value={s.football.shoesNumber}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, shoesNumber: e.target.value },
                  }))
                }
              >
                <option value="">—</option>
                {Array.from({ length: 21 }, (_, i) => String(30 + i)).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <div />
          </Row2>

          <Row4>
            <Field label="Weight">
              <TextInput
                disabled={readOnlyClub}
                value={s.football.weight}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, weight: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Height">
              <TextInput
                disabled={readOnlyClub}
                value={s.football.height}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, height: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Reaction time">
              <TextInput
                disabled={readOnlyClub}
                value={s.football.reactionTime}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, reactionTime: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Vertical jump">
              <TextInput
                disabled={readOnlyClub}
                value={s.football.verticalJump}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, verticalJump: e.target.value },
                  }))
                }
              />
            </Field>
          </Row4>

          <Row2>
            <Field label="Coach">
              <TextInput
                disabled={readOnlyClub}
                value={s.football.coach}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, coach: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Start date with this team">
              <TextInput
                type="date"
                disabled={readOnlyClub}
                value={s.football.startDateWithTeam}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    football: { ...prev.football, startDateWithTeam: e.target.value },
                  }))
                }
              />
            </Field>
          </Row2>
          <div className="mt-3 flex flex-wrap gap-4">
            <CheckRow
              label="Receipt issued"
              disabled={readOnlyClub}
              checked={s.football.receiptIssued}
              onChange={(v) =>
                patchSettings((prev) => ({
                  ...prev,
                  football: { ...prev.football, receiptIssued: v },
                }))
              }
            />
            <CheckRow
              label="Image release"
              disabled={readOnlyClub}
              checked={s.football.imageRelease}
              onChange={(v) =>
                patchSettings((prev) => ({
                  ...prev,
                  football: { ...prev.football, imageRelease: v },
                }))
              }
            />
            <CheckRow
              label="Travel authorization"
              disabled={readOnlyClub}
              checked={s.football.travelAuthorization}
              onChange={(v) =>
                patchSettings((prev) => ({
                  ...prev,
                  football: { ...prev.football, travelAuthorization: v },
                }))
              }
            />
          </div>
          <Field label="Sports played">
            <div className="flex flex-wrap gap-3">
              {MAIN_SPORTS.map((sp) => (
                <CheckRow
                  key={sp}
                  label={sp}
                  disabled={readOnlyClub}
                  checked={s.football.sportsPlayed.includes(sp)}
                  onChange={(v) =>
                    patchSettings((prev) => ({
                      ...prev,
                      football: {
                        ...prev.football,
                        sportsPlayed: v
                          ? [...prev.football.sportsPlayed, sp]
                          : prev.football.sportsPlayed.filter((x) => x !== sp),
                      },
                    }))
                  }
                />
              ))}
            </div>
          </Field>
        </SectionCard>
      ) : memberSettingKind === 'team' ? (
        <SectionCard title={`TEAM fields — ${selectedTeamSport}`}>
          <p className="text-sm text-gray-600">
            Sport-specific fields for <strong>{selectedTeamSport}</strong> will appear here.
            Football fields are shown when the type of team is Football.
          </p>
        </SectionCard>
      ) : null}

      {!readOnlyClub ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {message ? <span className="text-sm text-gray-700">{message}</span> : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-500">View only for your role on this section.</p>
      )}
    </div>
  );
}
