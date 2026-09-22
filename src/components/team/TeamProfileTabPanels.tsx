'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { COUNTRIES } from '@/lib/news/countries';
import { getRegionsForCountry } from '@/constants/countryRegions.constants';
import type { TeamProfileFormPayload } from '@/lib/team/teamProfileTypes';
import {
  CheckRow,
  Field,
  Row2,
  Row3,
  SectionCard,
  TextInput,
  TextSelect,
} from '@/components/club/memberProfile/FormBits';
import { useLanguage } from '@/contexts/LanguageContext';
import { normalizeEntitySport } from '@/lib/sport/entitySportOptions';
import {
  emptySportDropdownCatalog,
  normalizeSportDropdownCatalog,
  optionsForSportParameter,
  TEAM_PROFILE_PARAM_KEY_BY_FIELD,
  type SportDropdownCatalog,
} from '@/lib/sport/sportDropdownParameters';

type PanelProps = {
  form: TeamProfileFormPayload;
  setForm: React.Dispatch<React.SetStateAction<TeamProfileFormPayload>>;
  readOnly?: boolean;
};

function useSportDropdownCatalog() {
  const [catalog, setCatalog] = useState<SportDropdownCatalog>(emptySportDropdownCatalog());
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/admin/sport-dropdown-parameters', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setCatalog(normalizeSportDropdownCatalog(json.catalog));
      } catch {
        /* empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return catalog;
}

/** Dropdown fed by Super Admin → Dropdown parameters for sport. */
function SportParamSelect({
  label,
  paramKey,
  sport,
  catalog,
  value,
  onChange,
  disabled,
}: {
  label: string;
  paramKey: string;
  sport: string;
  catalog: SportDropdownCatalog;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { currentLanguage } = useLanguage();
  const sportKey = normalizeEntitySport(sport || 'Football');
  const options = useMemo(
    () =>
      optionsForSportParameter(
        catalog,
        sportKey,
        paramKey,
        currentLanguage || 'eng',
      ),
    [catalog, sportKey, paramKey, currentLanguage],
  );
  const empty = options.length === 0;

  return (
    <Field
      label={`${label} **`}
      hint={
        empty
          ? `Options from Super Admin → Tools Settings → Dropdown parameters for sport (${sportKey}).`
          : undefined
      }
    >
      <TextSelect
        value={value}
        disabled={disabled || empty}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.id} value={o.label}>
            {o.label}
          </option>
        ))}
        {value && !options.some((o) => o.label === value) ? (
          <option value={value}>{value}</option>
        ) : null}
      </TextSelect>
    </Field>
  );
}

function GridField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(140px,180px)_1fr] items-center gap-2 text-sm">
      <span className="font-medium text-gray-800">{label}</span>
      {children}
    </div>
  );
}

export function TeamProfileMainTab({ form, setForm, readOnly }: PanelProps) {
  const patchMain = (patch: Partial<TeamProfileFormPayload['mainData']>) =>
    setForm((f) => ({ ...f, mainData: { ...f.mainData, ...patch } }));

  const patchLegal = (patch: Partial<TeamProfileFormPayload['legalSite']>) =>
    setForm((f) => ({ ...f, legalSite: { ...f.legalSite, ...patch } }));

  const catalog = useSportDropdownCatalog();
  const sport = form.sport || form.sports?.[0] || 'Football';

  const regionOptions = form.legalSite.country.trim()
    ? getRegionsForCountry(form.legalSite.country)
    : [];

  return (
    <div className="space-y-4">
      <SectionCard title="Main data" tone="red">
        <Field label="Team username">
          <TextInput
            value={form.username}
            disabled={readOnly}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          />
        </Field>
        <Field label="Team short name">
          <TextInput
            value={form.mainData.shortName}
            disabled={readOnly}
            onChange={(e) => patchMain({ shortName: e.target.value })}
          />
        </Field>
        <Field label="Official whole team name">
          <TextInput
            value={form.officialName}
            disabled={readOnly}
            onChange={(e) => setForm((f) => ({ ...f, officialName: e.target.value }))}
          />
        </Field>
        <SportParamSelect
          label="Company type"
          paramKey={TEAM_PROFILE_PARAM_KEY_BY_FIELD.companyType}
          sport={sport}
          catalog={catalog}
          value={form.mainData.companyType}
          disabled={readOnly}
          onChange={(v) => patchMain({ companyType: v })}
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <SportParamSelect
            label="Federation name"
            paramKey={TEAM_PROFILE_PARAM_KEY_BY_FIELD.federationName}
            sport={sport}
            catalog={catalog}
            value={form.mainData.federationName}
            disabled={readOnly}
            onChange={(v) => patchMain({ federationName: v })}
          />
          <Field label="Federation registration number">
            <TextInput
              value={form.federal.registrationNumber}
              disabled={readOnly}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  federal: { ...f.federal, registrationNumber: e.target.value },
                }))
              }
            />
          </Field>
        </div>
        <Field label="Whole federation name">
          <TextInput
            value={form.mainData.wholeFederationName}
            disabled={readOnly}
            onChange={(e) => patchMain({ wholeFederationName: e.target.value })}
          />
        </Field>
        <Field label="Entity">
          <TextInput
            value={form.mainData.entity}
            disabled={readOnly}
            onChange={(e) => patchMain({ entity: e.target.value })}
          />
        </Field>
        <Row3>
          <SportParamSelect
            label="Registered at"
            paramKey={TEAM_PROFILE_PARAM_KEY_BY_FIELD.registeredAt}
            sport={sport}
            catalog={catalog}
            value={form.mainData.registeredAt}
            disabled={readOnly}
            onChange={(v) => patchMain({ registeredAt: v })}
          />
          <Field label="ID Number">
            <TextInput
              value={form.mainData.idNumber}
              disabled={readOnly}
              onChange={(e) => patchMain({ idNumber: e.target.value })}
            />
          </Field>
          <Field label="Foundation date">
            <TextInput
              type="date"
              value={form.mainData.foundationDate}
              disabled={readOnly}
              onChange={(e) => patchMain({ foundationDate: e.target.value })}
            />
          </Field>
        </Row3>
        <Field label="Fiscal code">
          <TextInput
            value={form.mainData.fiscalCode}
            disabled={readOnly}
            onChange={(e) =>
              patchMain({
                fiscalCode: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(),
              })
            }
          />
        </Field>
        <Field label="Social colors">
          <TextInput
            value={form.mainData.socialColors}
            disabled={readOnly}
            onChange={(e) => patchMain({ socialColors: e.target.value })}
          />
        </Field>
      </SectionCard>

      <SectionCard title="Legal site and location" tone="blue">
        <Field label="Office address">
          <TextInput
            value={form.legalSite.officeAddress}
            disabled={readOnly}
            onChange={(e) => patchLegal({ officeAddress: e.target.value })}
          />
        </Field>
        <Field label="Location">
          <TextInput
            value={form.legalSite.location}
            disabled={readOnly}
            onChange={(e) => patchLegal({ location: e.target.value })}
          />
        </Field>
        <Field label="ZIP">
          <TextInput
            inputMode="numeric"
            value={form.legalSite.zipCode}
            disabled={readOnly}
            onChange={(e) =>
              patchLegal({ zipCode: e.target.value.replace(/[^\d]/g, '') })
            }
          />
        </Field>
        <Field label="Province">
          <TextInput
            value={form.legalSite.province}
            disabled={readOnly}
            onChange={(e) => patchLegal({ province: e.target.value })}
          />
        </Field>
        <Field label="Country">
          <TextSelect
            value={form.legalSite.country}
            disabled={readOnly}
            onChange={(e) => patchLegal({ country: e.target.value, region: '' })}
          >
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </TextSelect>
        </Field>
        <Field label="Region">
          <TextSelect
            value={form.legalSite.region}
            disabled={readOnly}
            onChange={(e) => patchLegal({ region: e.target.value })}
          >
            <option value="">
              {form.legalSite.country.trim() ? 'Select region' : 'Select country first'}
            </option>
            {regionOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            {form.legalSite.region && !regionOptions.includes(form.legalSite.region) ? (
              <option value={form.legalSite.region}>{form.legalSite.region}</option>
            ) : null}
          </TextSelect>
        </Field>
        <Field label="Geographic coordinate">
          <TextInput
            placeholder="45.4642, 9.1900"
            value={form.legalSite.geo ?? ''}
            disabled={readOnly}
            onChange={(e) => patchLegal({ geo: e.target.value })}
          />
        </Field>
        <Field label="Main playing field">
          <TextInput
            value={form.legalSite.mainPlayingField}
            disabled={readOnly}
            onChange={(e) => patchLegal({ mainPlayingField: e.target.value })}
          />
        </Field>
        <Field label="Address">
          <TextInput
            value={form.legalSite.fieldAddress}
            disabled={readOnly}
            onChange={(e) => patchLegal({ fieldAddress: e.target.value })}
          />
        </Field>
        <SportParamSelect
          label="Field type"
          paramKey={TEAM_PROFILE_PARAM_KEY_BY_FIELD.fieldType}
          sport={sport}
          catalog={catalog}
          value={form.legalSite.fieldType}
          disabled={readOnly}
          onChange={(v) => patchLegal({ fieldType: v })}
        />
        <CheckRow
          label={'Approval check yes\\no'}
          checked={form.legalSite.approvalCheck}
          disabled={readOnly}
          onChange={(v) => patchLegal({ approvalCheck: v })}
        />
        <Field label="Capacity">
          <TextInput
            inputMode="numeric"
            value={form.legalSite.capacity}
            disabled={readOnly}
            onChange={(e) =>
              patchLegal({ capacity: e.target.value.replace(/[^\d]/g, '') })
            }
          />
        </Field>
        <Field label="Sports scoreboards">
          <TextInput
            value={form.legalSite.sportsScoreboards}
            disabled={readOnly}
            onChange={(e) => patchLegal({ sportsScoreboards: e.target.value })}
          />
        </Field>
        <Field label={'Baskets & Nets'}>
          <TextInput
            value={form.legalSite.basketsAndNets}
            disabled={readOnly}
            onChange={(e) => patchLegal({ basketsAndNets: e.target.value })}
          />
        </Field>
      </SectionCard>
    </div>
  );
}

export function TeamPasswordsTab({
  form,
  setForm,
  mode,
  repeatPassword,
  setRepeatPassword,
  readOnly,
}: PanelProps & {
  mode: 'create' | 'edit';
  repeatPassword: string;
  setRepeatPassword: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionCard title="My Team password" tone="red">
        <p className="text-xs text-gray-600 mb-3">
          {mode === 'edit'
            ? 'Leave blank to keep the current team login password.'
            : 'Used with the team username on the login page to open this team profile directly.'}
        </p>
        <Row2>
          <GridField label={mode === 'create' ? 'My Password' : 'New Password'}>
            <TextInput
              type="password"
              autoComplete="new-password"
              placeholder="Direct login password"
              value={form.teamPassword}
              disabled={readOnly}
              onChange={(e) => setForm((f) => ({ ...f, teamPassword: e.target.value }))}
            />
          </GridField>
          <GridField label="Repeat Pass.">
            <TextInput
              type="password"
              autoComplete="new-password"
              value={repeatPassword}
              disabled={readOnly}
              onChange={(e) => setRepeatPassword(e.target.value)}
            />
          </GridField>
        </Row2>
      </SectionCard>

      <SectionCard title="Direct Access">
        <Field label="Direct Access">
          <TextInput
            value={form.directAccess}
            disabled={readOnly}
            onChange={(e) => setForm((f) => ({ ...f, directAccess: e.target.value }))}
          />
        </Field>
      </SectionCard>

      <SectionCard title="Direct Registration Code" tone="slate">
        <p className="text-xs text-gray-600 mb-3">
          Password to be typed by users who register at Movesbook by themselves to send an
          authorized request to become member of the team.
        </p>
        <Field label="Direct Registration code">
          <TextInput
            placeholder="Magiccode"
            value={form.directRegistrationCode}
            disabled={readOnly}
            onChange={(e) =>
              setForm((f) => ({ ...f, directRegistrationCode: e.target.value }))
            }
          />
        </Field>
      </SectionCard>
    </div>
  );
}

export function TeamContactsTab({ form, setForm, readOnly }: PanelProps) {
  const patch = (patch: Partial<TeamProfileFormPayload['contacts']>) =>
    setForm((f) => ({ ...f, contacts: { ...f.contacts, ...patch } }));

  return (
    <SectionCard title="Team contacts" tone="blue">
      <Field label="Website">
        <TextInput
          value={form.contacts.website}
          disabled={readOnly}
          onChange={(e) => patch({ website: e.target.value })}
        />
      </Field>
      <Field label="Email">
        <TextInput
          type="email"
          value={form.contacts.email}
          disabled={readOnly}
          onChange={(e) => patch({ email: e.target.value })}
        />
      </Field>
      <Field label={'PEC\\Registered mail'}>
        <TextInput
          value={form.contacts.pec}
          disabled={readOnly}
          onChange={(e) => patch({ pec: e.target.value })}
        />
      </Field>
      <Field label="Phone 1">
        <TextInput
          value={form.contacts.phone1}
          disabled={readOnly}
          onChange={(e) => patch({ phone1: e.target.value })}
        />
      </Field>
      <Field label="Phone 2">
        <TextInput
          value={form.contacts.phone2}
          disabled={readOnly}
          onChange={(e) => patch({ phone2: e.target.value })}
        />
      </Field>
      <Field label="Facebook">
        <TextInput
          value={form.contacts.facebook}
          disabled={readOnly}
          onChange={(e) => patch({ facebook: e.target.value })}
        />
      </Field>
      <Field label="Instagram">
        <TextInput
          value={form.contacts.instagram}
          disabled={readOnly}
          onChange={(e) => patch({ instagram: e.target.value })}
        />
      </Field>
      <Field label="Whatsapp">
        <TextInput
          value={form.contacts.whatsapp}
          disabled={readOnly}
          onChange={(e) => patch({ whatsapp: e.target.value })}
        />
      </Field>
      <Field label="Telegram">
        <TextInput
          value={form.contacts.telegram}
          disabled={readOnly}
          onChange={(e) => patch({ telegram: e.target.value })}
        />
      </Field>
    </SectionCard>
  );
}

export function TeamFederalTab({ form, setForm, readOnly }: PanelProps) {
  const patch = (patch: Partial<TeamProfileFormPayload['federal']>) =>
    setForm((f) => ({ ...f, federal: { ...f.federal, ...patch } }));

  return (
    <SectionCard title="Federal membership" tone="purple">
      <Field label="Federation">
        <TextInput
          value={form.federal.federation}
          disabled={readOnly}
          onChange={(e) => patch({ federation: e.target.value })}
        />
      </Field>
      <Field label="Sports league">
        <TextInput
          value={form.federal.sportsLeague}
          disabled={readOnly}
          onChange={(e) => patch({ sportsLeague: e.target.value })}
        />
      </Field>
      <Field label="Regional Committee">
        <TextInput
          value={form.federal.regionalCommittee}
          disabled={readOnly}
          onChange={(e) => patch({ regionalCommittee: e.target.value })}
        />
      </Field>
      <Field label="Provincial Delegation">
        <TextInput
          value={form.federal.provincialDelegation}
          disabled={readOnly}
          onChange={(e) => patch({ provincialDelegation: e.target.value })}
        />
      </Field>
      <Field label="Federation registration number">
        <TextInput
          value={form.federal.registrationNumber}
          disabled={readOnly}
          onChange={(e) => patch({ registrationNumber: e.target.value })}
        />
      </Field>
      <Field label="Affiliation date">
        <TextInput
          type="date"
          value={form.federal.affiliationDate}
          disabled={readOnly}
          onChange={(e) => patch({ affiliationDate: e.target.value })}
        />
      </Field>
      <Field label="Affiliation expiry date">
        <TextInput
          type="date"
          value={form.federal.affiliationExpiry}
          disabled={readOnly}
          onChange={(e) => patch({ affiliationExpiry: e.target.value })}
        />
      </Field>
      <Field label="Promotional body">
        <TextInput
          value={form.federal.promotionalBody}
          disabled={readOnly}
          onChange={(e) => patch({ promotionalBody: e.target.value })}
        />
      </Field>
      <Field label="CIO code">
        <TextInput
          value={form.federal.cioCode}
          disabled={readOnly}
          onChange={(e) => patch({ cioCode: e.target.value })}
        />
      </Field>
    </SectionCard>
  );
}

export function TeamSubteamsTab({ form, setForm, readOnly }: PanelProps) {
  const patch = (patch: Partial<TeamProfileFormPayload['federal']>) =>
    setForm((f) => ({ ...f, federal: { ...f.federal, ...patch } }));
  const catalog = useSportDropdownCatalog();
  const sport = form.sport || form.sports?.[0] || 'Football';

  return (
    <SectionCard title="Subteams and Categories" tone="blue">
      <SportParamSelect
        label="Main category"
        paramKey={TEAM_PROFILE_PARAM_KEY_BY_FIELD.mainCategory}
        sport={sport}
        catalog={catalog}
        value={form.federal.mainCategory}
        disabled={readOnly}
        onChange={(v) => patch({ mainCategory: v })}
      />
      <Field label="Group">
        <TextInput
          value={form.federal.group}
          disabled={readOnly}
          onChange={(e) => patch({ group: e.target.value })}
        />
      </Field>
      <Field label="Sports season">
        <TextInput
          value={form.federal.sportsSeason}
          disabled={readOnly}
          onChange={(e) => patch({ sportsSeason: e.target.value })}
        />
      </Field>
      <SportParamSelect
        label="Other categories"
        paramKey={TEAM_PROFILE_PARAM_KEY_BY_FIELD.otherCategories}
        sport={sport}
        catalog={catalog}
        value={form.federal.otherCategories}
        disabled={readOnly}
        onChange={(v) => patch({ otherCategories: v })}
      />
    </SectionCard>
  );
}

export function TeamAdminSportTab({ form, setForm, readOnly }: PanelProps) {
  const patch = (patch: Partial<TeamProfileFormPayload['adminSport']>) =>
    setForm((f) => ({ ...f, adminSport: { ...f.adminSport, ...patch } }));

  return (
    <div className="space-y-4">
      <SectionCard title="Administrative" tone="red">
        <Field label="President">
          <TextInput
            value={form.adminSport.president}
            disabled={readOnly}
            onChange={(e) => patch({ president: e.target.value })}
          />
        </Field>
        <Field label="Vice President">
          <TextInput
            value={form.adminSport.vicePresident}
            disabled={readOnly}
            onChange={(e) => patch({ vicePresident: e.target.value })}
          />
        </Field>
        <Field label="Secretary">
          <TextInput
            value={form.adminSport.secretary}
            disabled={readOnly}
            onChange={(e) => patch({ secretary: e.target.value })}
          />
        </Field>
        <Field label="Treasurer">
          <TextInput
            value={form.adminSport.treasurer}
            disabled={readOnly}
            onChange={(e) => patch({ treasurer: e.target.value })}
          />
        </Field>
        <Field label="Youth Sector Manager">
          <TextInput
            value={form.adminSport.youthSectorManager}
            disabled={readOnly}
            onChange={(e) => patch({ youthSectorManager: e.target.value })}
          />
        </Field>
        <Field label="IBAN (alphanumeric)">
          <TextInput
            value={form.adminSport.iban}
            disabled={readOnly}
            onChange={(e) => patch({ iban: e.target.value })}
          />
        </Field>
        <Field label="SDI Invoicing Code (numeric)">
          <TextInput
            inputMode="numeric"
            value={form.adminSport.sdiInvoicingCode}
            disabled={readOnly}
            onChange={(e) => patch({ sdiInvoicingCode: e.target.value })}
          />
        </Field>
      </SectionCard>

      <SectionCard title="Sport data" tone="blue">
        <Field label="Allenatore prima squadra">
          <TextInput
            value={form.adminSport.headCoach}
            disabled={readOnly}
            onChange={(e) => patch({ headCoach: e.target.value })}
          />
        </Field>
        <Field label="Coaching license number (numeric)">
          <TextInput
            inputMode="numeric"
            value={form.adminSport.coachingLicenseNumber}
            disabled={readOnly}
            onChange={(e) => patch({ coachingLicenseNumber: e.target.value })}
          />
        </Field>
        <Field label="Assistant coach">
          <TextInput
            value={form.adminSport.assistantCoach}
            disabled={readOnly}
            onChange={(e) => patch({ assistantCoach: e.target.value })}
          />
        </Field>
        <Field label="Fitness coach">
          <TextInput
            value={form.adminSport.fitnessCoach}
            disabled={readOnly}
            onChange={(e) => patch({ fitnessCoach: e.target.value })}
          />
        </Field>
        <Field label="Goalkeeper coach">
          <TextInput
            value={form.adminSport.goalkeeperCoach}
            disabled={readOnly}
            onChange={(e) => patch({ goalkeeperCoach: e.target.value })}
          />
        </Field>
        <Field label="Team doctor">
          <TextInput
            value={form.adminSport.teamDoctor}
            disabled={readOnly}
            onChange={(e) => patch({ teamDoctor: e.target.value })}
          />
        </Field>
        <Field label="Main sponsor">
          <TextInput
            value={form.adminSport.mainSponsor}
            disabled={readOnly}
            onChange={(e) => patch({ mainSponsor: e.target.value })}
          />
        </Field>
        <Field label="Technical supplier">
          <TextInput
            value={form.adminSport.technicalSupplier}
            disabled={readOnly}
            onChange={(e) => patch({ technicalSupplier: e.target.value })}
          />
        </Field>
      </SectionCard>
    </div>
  );
}
