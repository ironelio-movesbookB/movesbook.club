'use client';

import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { getEntityProfileLabels } from '@/lib/entity/entityProfileLabels';
import { DEFAULT_ENTITY_SPORT, ENTITY_SPORT_OPTIONS } from '@/lib/sport/entitySportOptions';
import { emptyTeamProfileForm } from '@/lib/team/teamProfileDefaults';
import { teamToFormPayload } from '@/lib/team/teamProfilePayload';
import {
  TEAM_PROFILE_TABS,
  type TeamProfileFormPayload,
  type TeamProfileSavePayload,
  type TeamProfileTabId,
} from '@/lib/team/teamProfileTypes';
import {
  TeamAdminSportTab,
  TeamContactsTab,
  TeamFederalTab,
  TeamPasswordsTab,
  TeamProfileMainTab,
  TeamSubteamsTab,
} from '@/components/team/TeamProfileTabPanels';
import { Field, TextSelect } from '@/components/club/memberProfile/FormBits';

export type { TeamProfileFormPayload, TeamProfileSavePayload };

type TeamProfileEditorProps = {
  mode: 'create' | 'edit';
  /** Club archive uses the same editor with club/team wording. */
  entityKind?: 'club' | 'team';
  adminUsername?: string;
  initialTeam?: {
    name: string;
    description?: string | null;
    sport?: string | null;
  };
  onSave: (payload: TeamProfileSavePayload) => Promise<void>;
  saving?: boolean;
  onCancel?: () => void;
};

export default function TeamProfileEditor({
  mode,
  entityKind = 'team',
  adminUsername = 'username',
  initialTeam,
  onSave,
  saving = false,
  onCancel,
}: TeamProfileEditorProps) {
  const labels = getEntityProfileLabels(entityKind === 'club' ? 'club' : 'team');
  const [activeTab, setActiveTab] = useState<TeamProfileTabId>('team-profile');
  const [form, setForm] = useState<TeamProfileFormPayload>(emptyTeamProfileForm);
  const [repeatPassword, setRepeatPassword] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(mode === 'create');

  /** Stable key so parent re-renders don't wipe in-progress logo picks / tab edits. */
  const hydrateKey =
    mode === 'edit' && initialTeam
      ? `${initialTeam.name}\n${initialTeam.sport ?? ''}\n${initialTeam.description ?? ''}`
      : mode;

  useEffect(() => {
    if (mode === 'edit' && initialTeam) {
      const payload = teamToFormPayload(initialTeam);
      setForm(payload);
      setLogoUrl(payload.logoUrl || null);
      setLogoFile(null);
      setLogoRemoved(false);
      setRepeatPassword('');
      setError(null);
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrateKey is content-derived from initialTeam
  }, [mode, hydrateKey]);

  const handleLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoRemoved(false);
    setLogoUrl((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoRemoved(true);
    setLogoUrl((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    setForm((f) => ({ ...f, logoUrl: '' }));
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.directAccess.trim()) {
      setError(labels.directAccessRequiredError);
      setActiveTab('passwords');
      return;
    }
    if (mode === 'create') {
      if (!form.teamPassword.trim()) {
        setError(labels.passwordRequiredError);
        setActiveTab('passwords');
        return;
      }
      if (form.teamPassword !== repeatPassword) {
        setError('My Password and Repeat Pass. do not match.');
        setActiveTab('passwords');
        return;
      }
    } else if (form.teamPassword || repeatPassword) {
      if (form.teamPassword !== repeatPassword) {
        setError('New Password and Repeat Pass. do not match.');
        setActiveTab('passwords');
        return;
      }
    }
    const name = form.officialName.trim() || form.username.trim();
    if (!name) {
      setError(labels.nameRequiredError);
      setActiveTab('team-profile');
      return;
    }
    setError(null);
    try {
      const sports =
        form.sports.length > 0 ? form.sports : [form.sport || DEFAULT_ENTITY_SPORT];
      const publicLogoUrl =
        logoRemoved
          ? ''
          : logoUrl && !logoUrl.startsWith('blob:') && !logoUrl.startsWith('data:')
            ? logoUrl
            : form.logoUrl &&
                !form.logoUrl.startsWith('blob:') &&
                !form.logoUrl.startsWith('data:')
              ? form.logoUrl
              : '';
      await onSave({
        ...form,
        sports,
        sport: sports[0],
        logoUrl: publicLogoUrl,
        logoFile,
        removeLogo: logoRemoved,
        username: form.username.trim(),
        officialName: form.officialName.trim() || form.username.trim(),
        directAccess: form.directAccess.trim(),
        directRegistrationCode: form.directRegistrationCode.trim(),
        teamPassword: form.teamPassword.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.saveError);
    }
  };

  if (mode === 'edit' && !hydrated) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">Loading team profile…</p>
    );
  }

  const title =
    mode === 'create'
      ? labels.createTitle(adminUsername)
      : entityKind === 'club'
        ? 'Edit club / team profile'
        : 'Edit team profile';

  return (
    <div className="space-y-4">
      <div className="bg-[#6b1020] px-4 py-2.5 text-sm font-semibold text-white rounded-t-lg">
        {title}
      </div>

      <div className="border border-t-0 border-gray-300 bg-[#f3f3f3] rounded-b-lg">
        <div className="flex flex-wrap gap-0 border-b border-gray-300 bg-white">
          {TEAM_PROFILE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs sm:text-sm font-medium border-r border-gray-300 ${
                activeTab === tab.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-4 p-4">
          {activeTab === 'team-profile' ? (
            <div className="space-y-4">
              <Field label="Sport of the team">
                <TextSelect
                  value={form.sport}
                  onChange={(e) => {
                    const picked = e.target.value;
                    setForm((f) => {
                      const current = f.sports?.length ? f.sports : [f.sport];
                      // Primary sport leads the list; keep any extra sports selected.
                      const sports = [picked, ...current.filter((s) => s !== picked)];
                      return { ...f, sports, sport: picked };
                    });
                  }}
                >
                  {ENTITY_SPORT_OPTIONS.map((sport) => (
                    <option key={sport} value={sport}>
                      {sport}
                    </option>
                  ))}
                  {form.sport && !(ENTITY_SPORT_OPTIONS as readonly string[]).includes(form.sport) ? (
                    <option value={form.sport}>{form.sport}</option>
                  ) : null}
                </TextSelect>
              </Field>
              <Field label="Other sports">
                <div className="flex flex-wrap gap-x-4 gap-y-2 rounded border border-gray-300 bg-white px-3 py-2">
                  {ENTITY_SPORT_OPTIONS.map((sport) => {
                    const checked = (form.sports?.length ? form.sports : [form.sport]).includes(
                      sport,
                    );
                    return (
                      <label
                        key={sport}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-800"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setForm((f) => {
                              const current = f.sports?.length ? f.sports : [f.sport];
                              const next = current.includes(sport)
                                ? current.filter((s) => s !== sport)
                                : [...current, sport];
                              const sports = next.length ? next : [DEFAULT_ENTITY_SPORT];
                              return { ...f, sports, sport: sports[0] };
                            })
                          }
                        />
                        {sport}
                      </label>
                    );
                  })}
                </div>
              </Field>

              <div className="flex flex-col gap-6 sm:flex-row">
                <div className="flex shrink-0 flex-col items-start gap-2">
                  <div className="text-sm font-medium text-gray-800">
                    Escutcheon / Logo
                  </div>
                  <label className="relative flex h-28 w-36 cursor-pointer items-center justify-center overflow-hidden border border-gray-400 bg-white">
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleLogoPick}
                    />
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-10 w-10 text-gray-400" />
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="text-sm text-blue-700 hover:underline"
                  >
                    [ Remove Logo ]
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <TeamProfileMainTab form={form} setForm={setForm} />
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'passwords' ? (
            <TeamPasswordsTab
              form={form}
              setForm={setForm}
              mode={mode}
              repeatPassword={repeatPassword}
              setRepeatPassword={setRepeatPassword}
            />
          ) : null}

          {activeTab === 'contacts' ? (
            <TeamContactsTab form={form} setForm={setForm} />
          ) : null}

          {activeTab === 'federal' ? (
            <TeamFederalTab form={form} setForm={setForm} />
          ) : null}

          {activeTab === 'subteams' ? (
            <TeamSubteamsTab form={form} setForm={setForm} />
          ) : null}

          {activeTab === 'admin-sport' ? (
            <TeamAdminSportTab form={form} setForm={setForm} />
          ) : null}

          {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-center gap-6 pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded-lg border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-10 py-2.5 font-semibold text-white shadow disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {onCancel ? (
              <button
                type="button"
                disabled={saving}
                onClick={onCancel}
                className="rounded-lg border border-gray-900 bg-gradient-to-b from-gray-700 to-black px-10 py-2.5 font-semibold text-white shadow disabled:opacity-60"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
