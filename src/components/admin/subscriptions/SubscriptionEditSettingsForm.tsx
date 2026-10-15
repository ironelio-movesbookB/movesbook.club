'use client';

import { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import type {
  SubscriptionEditSettings,
  SubscriptionMembershipSetting,
  SubscriptionTier,
  SubscriptionUserType,
} from '@/types/adminSubscriptionSettings';
import SubscriptionMembershipSharingDisplay from './SubscriptionMembershipSharingDisplay';
import {
  getAthleteTierLimits,
  getCoachVariantIntroText,
  getMembershipSectionLabel,
  hasCreatableCompaniesSetting,
  SUBSCRIPTION_TIERS as TIERS,
  totalAthleteTierLimit,
  usesCoachTeamClubSharingLayout,
} from '@/lib/admin/subscriptionEditSettingsLayout';

type SubscriptionEditSettingsFormProps = {
  settings: SubscriptionEditSettings;
  userType: SubscriptionUserType;
  onChange: (settings: SubscriptionEditSettings) => void;
  variant: 'athlete' | 'coach';
  daysValue: number;
};

const INTEGER_RE = /^-?\d+$/;

/** Integer field that allows "" and "-" while typing (e.g. -1 = Unlimited) without forcing 0. */
function IntegerInput({
  value,
  onValueChange,
  className,
}: {
  value: number | undefined;
  onValueChange: (value: number) => void;
  className: string;
}) {
  const current = Number.isFinite(value) ? (value as number) : 0;
  const [text, setText] = useState(String(current));

  useEffect(() => {
    setText((prev) =>
      INTEGER_RE.test(prev.trim()) && Number(prev) === current ? prev : String(current),
    );
  }, [current]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (INTEGER_RE.test(raw.trim())) onValueChange(Number(raw));
      }}
      onBlur={() => {
        if (!INTEGER_RE.test(text.trim())) setText(String(current));
      }}
      className={className}
    />
  );
}

function MembershipRow({
  label,
  setting,
  sharingLabel,
  onChange,
}: {
  label: string;
  setting: SubscriptionMembershipSetting;
  sharingLabel: string;
  onChange: (patch: Partial<SubscriptionMembershipSetting>) => void;
}) {
  return (
    <div className="grid grid-cols-[80px_60px_32px_32px_1fr] items-center gap-2 py-1">
      <span className="text-sm text-gray-700 font-medium">{label}</span>
      <IntegerInput
        value={setting.limit}
        onValueChange={(v) => onChange({ limit: v })}
        className="border border-gray-300 bg-[#fffacd] px-2 py-1 text-sm w-full"
      />
      <div className="flex justify-center">
        <Share2 className="w-5 h-5 text-[#5cb85c]" />
      </div>
      <input
        type="checkbox"
        checked={setting.sharingEnabled}
        onChange={(e) => onChange({ sharingEnabled: e.target.checked })}
        className="justify-self-center"
      />
      <span className="text-sm text-gray-600">{sharingLabel}</span>
    </div>
  );
}

export default function SubscriptionEditSettingsForm({
  settings,
  userType,
  onChange,
  variant,
  daysValue,
}: SubscriptionEditSettingsFormProps) {
  const update = (patch: Partial<SubscriptionEditSettings>) => {
    onChange({ ...settings, ...patch });
  };

  const updateMembership = (
    key: 'coachSharing' | 'teams' | 'groups' | 'clubs',
    patch: Partial<SubscriptionMembershipSetting>,
  ) => {
    onChange({ ...settings, [key]: { ...settings[key], ...patch } });
  };

  const roleLabel =
    variant === 'athlete'
      ? 'Athlete'
      : userType === 'coach'
        ? 'Coach'
        : getRoleCapitalized(userType);

  const coachTeamClubLayout = usesCoachTeamClubSharingLayout(userType);
  const coachSharing = settings.coachSharing ?? { limit: 1, sharingEnabled: true };
  const athleteTierLimits = getAthleteTierLimits(settings);
  const athleteTotal = totalAthleteTierLimit(athleteTierLimits);

  const updateAthleteTierLimit = (tier: SubscriptionTier, raw: string) => {
    const value = raw.trim() === '-' ? -1 : Number(raw) || 0;
    const nextLimits = { ...athleteTierLimits, [tier]: value };
    update({
      athleteTierLimits: nextLimits,
      athleteTiers: {
        trial: nextLimits.trial !== 0,
        base: nextLimits.base !== 0,
        premium: nextLimits.premium !== 0,
        pro: nextLimits.pro !== 0,
      },
      athletesLimit: totalAthleteTierLimit(nextLimits),
    });
  };

  return (
    <div className="border border-gray-300 mb-4">
      <div className="bg-[#e6e6e6] px-4 py-2 font-bold text-sm text-gray-800 border-b border-gray-300">
        Edit Settings
      </div>
      <div className="p-4 bg-white space-y-6">
        {variant === 'athlete' ? (
          <div>
            <p className="text-sm text-gray-700 mb-3">
              Athlete can have one or more coaches and can be invited to be one of this athlete....
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm text-gray-700">Coaches</span>
              <IntegerInput
                value={settings.coachesLimit}
                onValueChange={(v) => update({ coachesLimit: v })}
                className="border border-gray-300 bg-[#fffacd] px-2 py-1 text-sm w-16"
              />
              <div className="flex items-center gap-4 ml-4">
                {TIERS.map((tier) => (
                  <label key={tier.key} className="flex items-center gap-1 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={settings.coachTiers[tier.key]}
                      onChange={(e) =>
                        update({
                          coachTiers: { ...settings.coachTiers, [tier.key]: e.target.checked },
                        })
                      }
                    />
                    {tier.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : coachTeamClubLayout ? (
          <div>
            <p className="text-sm text-gray-700 mb-3">{getCoachVariantIntroText(userType)}</p>
            <p className="text-sm font-medium text-gray-800 mb-2">Free accounts athletes</p>
            <div className="flex flex-wrap items-end gap-3">
              {TIERS.map((tier) => (
                <label key={tier.key} className="flex flex-col items-center gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                    {tier.label}
                  </span>
                  <IntegerInput
                    value={athleteTierLimits[tier.key]}
                    onValueChange={(v) => updateAthleteTierLimit(tier.key, String(v))}
                    className="border border-gray-300 bg-[#fffacd] px-2 py-1 text-sm w-16 text-center"
                  />
                </label>
              ))}
              <span className="text-xs text-gray-500 pb-1.5">
                Total: {athleteTotal === -1 ? 'Unlimited' : athleteTotal}
              </span>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-700 mb-3">
              {roleLabel} can be member of teams, groups and clubs and can have one or more athletes....
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm text-gray-700">Athletes</span>
              <IntegerInput
                value={settings.athletesLimit}
                onValueChange={(v) => update({ athletesLimit: v })}
                className="border border-gray-300 bg-[#fffacd] px-2 py-1 text-sm w-16"
              />
              <div className="flex items-center gap-4 ml-4">
                {TIERS.map((tier) => (
                  <label key={tier.key} className="flex items-center gap-1 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={settings.athleteTiers[tier.key]}
                      onChange={(e) =>
                        update({
                          athleteTiers: { ...settings.athleteTiers, [tier.key]: e.target.checked },
                        })
                      }
                    />
                    {tier.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {variant === 'coach' && hasCreatableCompaniesSetting(userType) ? (
          <div>
            <p className="text-sm font-medium text-gray-800 mb-1">Max number of manageable users</p>
            <p className="text-xs text-gray-500 mb-3">
              Limits for companies and users managed by the admin — shown in the subscription
              settings browse table.
            </p>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm text-gray-700 min-w-[280px]">
                  Companies creable by the admin
                </label>
                <IntegerInput
                  value={settings.creatableCompanies}
                  onValueChange={(v) => update({ creatableCompanies: v })}
                  className="border border-gray-300 bg-[#fffacd] px-2 py-1 text-sm w-24"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm text-gray-700 min-w-[280px]">
                  Number of users available for the 1th subscription
                </label>
                <IntegerInput
                  value={settings.usersAvailableFirstSubscription}
                  onValueChange={(v) => update({ usersAvailableFirstSubscription: v })}
                  className="border border-gray-300 bg-[#fffacd] px-2 py-1 text-sm w-24"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm text-gray-700 min-w-[280px]">
                  Number of users available for the renewal
                </label>
                <IntegerInput
                  value={settings.usersAvailableRenewal}
                  onValueChange={(v) => update({ usersAvailableRenewal: v })}
                  className="border border-gray-300 bg-[#fffacd] px-2 py-1 text-sm w-24"
                />
              </div>
            </div>
          </div>
        ) : null}

        <div>
          <p className="text-sm text-gray-700 mb-1">
            {getMembershipSectionLabel(userType, roleLabel)}
          </p>
          <p className="text-xs text-gray-500 mb-3">
            Sharing limits for this version — displayed during registration (Package → Availability
            shares tab and when the user selects this version).
          </p>
          {coachTeamClubLayout ? (
            <MembershipRow
              label="Coaches"
              setting={coachSharing}
              sharingLabel="Sharing with coaches"
              onChange={(patch) => updateMembership('coachSharing', patch)}
            />
          ) : null}
          <MembershipRow
            label="Teams"
            setting={settings.teams}
            sharingLabel="Sharing with teams"
            onChange={(patch) => updateMembership('teams', patch)}
          />
          <MembershipRow
            label="Groups"
            setting={settings.groups}
            sharingLabel="Sharing with groups"
            onChange={(patch) => updateMembership('groups', patch)}
          />
          <MembershipRow
            label="Clubs"
            setting={settings.clubs}
            sharingLabel="Sharing with clubs"
            onChange={(patch) => updateMembership('clubs', patch)}
          />
          <p className="text-xs text-gray-500 mt-2">-1=Unlimited</p>

          <div className="mt-4">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-600">
              Registration preview — Availability shares
            </div>
            <SubscriptionMembershipSharingDisplay
              settings={settings}
              userType={userType}
              daysValue={daysValue}
              mode="admin-preview"
              hideDaysDuration={coachTeamClubLayout}
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-800 mb-3">Notify at expiration</p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700 mb-3">
            <span>Alert</span>
            <IntegerInput
              value={settings.alertDaysBefore}
              onValueChange={(v) => update({ alertDaysBefore: v })}
              className="border border-gray-300 bg-[#fffacd] px-2 py-1 w-12 text-center"
            />
            <span>days before and</span>
            <IntegerInput
              value={settings.alertDaysAfter}
              onValueChange={(v) => update({ alertDaysAfter: v })}
              className="border border-gray-300 bg-[#fffacd] px-2 py-1 w-12 text-center"
            />
            <span>days after the expiration</span>
            <label className="flex items-center gap-2 ml-4">
              <input
                type="checkbox"
                checked={settings.alertEveryDay}
                onChange={(e) => update({ alertEveryDay: e.target.checked })}
              />
              Alert every day and not only once
            </label>
          </div>
          <div className="space-y-2">
            {(
              [
                ['notifyMail', 'Mail'],
                ['notifyNetwork', 'On your network page'],
                ['notifyCellular', 'Cellular'],
                ['notifyFacebook', 'Post on Facebook'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 text-sm text-gray-700">
                <Share2 className="w-5 h-5 text-[#5cb85c]" />
                <input
                  type="checkbox"
                  checked={settings[key]}
                  onChange={(e) => update({ [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {variant === 'coach' ? (
          <>
            <div>
              <p className="text-sm font-medium text-gray-800 mb-3">
                Set Data End subscription about athletes when they accept invite
              </p>
              <div className="space-y-2 text-sm text-gray-700">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="inviteEndMode"
                    checked={settings.inviteEndMode === 'own_subscription'}
                    onChange={() => update({ inviteEndMode: 'own_subscription' })}
                  />
                  Untile data end of their own subscription
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="inviteEndMode"
                    checked={settings.inviteEndMode === 'days_after_accept'}
                    onChange={() => update({ inviteEndMode: 'days_after_accept' })}
                  />
                  Untile
                  <IntegerInput
                    value={settings.inviteEndDays}
                    onValueChange={(v) => update({ inviteEndDays: v })}
                    className="border border-gray-300 bg-[#fffacd] px-2 py-1 w-12"
                  />
                  in days after acceptance of the invite
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="inviteEndMode"
                    checked={settings.inviteEndMode === 'coach_subscription'}
                    onChange={() => update({ inviteEndMode: 'coach_subscription' })}
                  />
                  Untile data end subscription of the Coach
                </label>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-700 mb-3">
                Users invited who accept the invite will be assigned this Single User version..
              </p>
              <div className="space-y-2 text-sm text-gray-700">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="invitedUserVersion"
                    checked={settings.invitedUserVersion === 'same'}
                    onChange={() => update({ invitedUserVersion: 'same' })}
                  />
                  Remain in the same version they have
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="invitedUserVersion"
                    checked={settings.invitedUserVersion === 'next'}
                    onChange={() => update({ invitedUserVersion: 'next' })}
                  />
                  Will be assigned the next version that they have as current
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="invitedUserVersion"
                    checked={settings.invitedUserVersion === 'professional'}
                    onChange={() => update({ invitedUserVersion: 'professional' })}
                  />
                  Will be assigned the Professional version
                </label>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function getRoleCapitalized(userType: SubscriptionUserType): string {
  if (userType === 'athlete') return 'Athlete';
  if (userType === 'coach') return 'Coach';
  if (userType === 'team') return 'Team';
  if (userType === 'group') return 'Group';
  return 'Club';
}
