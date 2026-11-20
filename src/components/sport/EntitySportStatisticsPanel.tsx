'use client';

import {
  CheckRow,
  Field,
  Row2,
  SectionCard,
  TextInput,
  TextSelect,
} from '@/components/club/memberProfile/FormBits';
import SportStatsBoard from '@/components/sport/SportStatsBoard';
import { useSportT } from '@/components/sport/useSportT';
import { normalizeEntitySport } from '@/lib/sport/entitySportOptions';
import { splitFieldLabel } from '@/lib/sport/sportI18n';
import type { SportFieldDef } from '@/lib/sport/sportProfileTypes';
import {
  decodeMultiSportValues,
  encodeMultiSportValues,
} from '@/lib/sport/sportProfileTypes';
import { teamSportInfoFields, teamSportProfile } from '@/lib/sport/teamSportProfiles';
import type { EntitySportProfileData } from '@/lib/team/teamProfileTypes';

type Props = {
  sport: string;
  data: EntitySportProfileData;
  onChange: (next: EntitySportProfileData) => void;
  readOnly?: boolean;
};

export function SportFieldGrid({
  defs,
  values,
  onChange,
  readOnly,
}: {
  defs: SportFieldDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  readOnly?: boolean;
}) {
  const st = useSportT();
  return (
    <Row2>
      {defs.map((def) => {
        const value = values[def.key] ?? '';
        const { label, examples: rawExamples } = splitFieldLabel(def.label);
        const examples = rawExamples ? st(rawExamples) : undefined;
        if (def.multi && def.options && def.options.length > 0) {
          const selected = decodeMultiSportValues(value);
          return (
            <div
              key={def.key}
              className="col-span-full flex flex-col justify-end md:col-span-2"
            >
              <Field label={`${st(label)} (multicheck)`}>
                <div className="flex flex-wrap gap-x-4 gap-y-2 rounded border border-gray-200 bg-white px-3 py-2">
                  {def.options.map((choice) => {
                    const checked = selected.includes(choice);
                    return (
                      <CheckRow
                        key={choice}
                        label={st(choice)}
                        disabled={readOnly}
                        checked={checked}
                        onChange={(on) => {
                          const next = on
                            ? [...selected, choice]
                            : selected.filter((v) => v !== choice);
                          onChange(def.key, encodeMultiSportValues(next));
                        }}
                      />
                    );
                  })}
                </div>
              </Field>
            </div>
          );
        }
        return (
          <div key={def.key} className="flex flex-col justify-end">
            <Field label={st(label)}>
              {def.options ? (
                <TextSelect
                  value={value}
                  disabled={readOnly}
                  onChange={(e) => onChange(def.key, e.target.value)}
                >
                  <option value="">—</option>
                  {def.options.map((o) => (
                    <option key={o} value={o}>
                      {st(o)}
                    </option>
                  ))}
                  {value && !def.options.includes(value) ? (
                    <option value={value}>{value}</option>
                  ) : null}
                </TextSelect>
              ) : (
                <TextInput
                  value={value}
                  placeholder={examples}
                  title={examples}
                  disabled={readOnly}
                  onChange={(e) => onChange(def.key, e.target.value)}
                />
              )}
            </Field>
          </div>
        );
      })}
    </Row2>
  );
}

/** Statistics tab of a Team / Club profile: season statistics of the sport + general items. */
export default function EntitySportStatisticsPanel({ sport, data, onChange, readOnly }: Props) {
  const key = normalizeEntitySport(sport);
  const infoFields = teamSportInfoFields(key);
  const fieldValues = data.fields[key] ?? {};

  return (
    <div className="space-y-4" data-testid="entity-sport-statistics">
      <SectionCard title={`Season statistics — ${key}`} tone="blue">
        <SportStatsBoard
          groups={teamSportProfile(key).seasonStats}
          values={data.stats[key] ?? {}}
          readOnly={readOnly}
          emptyText={`No season statistics are defined for ${key}.`}
          onChange={(next) => onChange({ ...data, stats: { ...data.stats, [key]: next } })}
        />
      </SectionCard>
      {infoFields.length > 0 ? (
        <SectionCard title="Statistics — general" tone="slate">
          <SportFieldGrid
            defs={infoFields}
            values={fieldValues}
            readOnly={readOnly}
            onChange={(fieldKey, value) =>
              onChange({
                ...data,
                fields: { ...data.fields, [key]: { ...fieldValues, [fieldKey]: value } },
              })
            }
          />
        </SectionCard>
      ) : null}
    </div>
  );
}
