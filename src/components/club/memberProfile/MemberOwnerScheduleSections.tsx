'use client';

import type { OwnerProfileData, PersonalDocumentData } from '@/lib/club/memberProfileTypes';
import {
  CheckRow,
  Field,
  Row2,
  SectionCard,
  TextArea,
  TextInput,
  TextSelect,
} from '@/components/club/memberProfile/FormBits';

type DocKey = keyof OwnerProfileData['documents'];

const DOCUMENT_FIELDS: Array<{ key: DocKey; label: string }> = [
  { key: 'idCard', label: 'ID Card' },
  { key: 'drivingLicence', label: 'Driving licence' },
  { key: 'healthInsuranceCard', label: 'Health insurance card' },
  { key: 'passport', label: 'Passport' },
  { key: 'residencePermit', label: 'Residence permit' },
];

function clampSize(value: string, max = 5): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, max);
}

/** Weight-style decimal: up to 3 digits + optional . + 1 decimal (000.0). */
function clampDecimal(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const parts = cleaned.split('.');
  const whole = (parts[0] || '').slice(0, 3);
  const frac = (parts[1] || '').slice(0, 1);
  return parts.length > 1 ? `${whole}.${frac}` : whole;
}

/** Shoe size: numeric 00.0 (2 digits + optional . + 1 decimal). */
function clampShoeSize(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const parts = cleaned.split('.');
  const whole = (parts[0] || '').slice(0, 2);
  const frac = (parts[1] || '').slice(0, 1);
  return parts.length > 1 ? `${whole}.${frac}` : whole;
}

type Props = {
  owner: OwnerProfileData;
  readOnly: boolean;
  onChange: (next: OwnerProfileData) => void;
  onUploadDocument?: (opts: {
    docKey: DocKey;
    side: 'front' | 'back';
    file: File;
  }) => Promise<void>;
};

export default function MemberOwnerScheduleSections({
  owner,
  readOnly,
  onChange,
  onUploadDocument,
}: Props) {
  const patchDoc = (key: DocKey, patch: Partial<PersonalDocumentData>) => {
    onChange({
      ...owner,
      documents: {
        ...owner.documents,
        [key]: { ...owner.documents[key], ...patch },
      },
    });
  };

  const body = owner.bodyMeasurements;

  return (
    <>
      <SectionCard title="Personal documents">
        <p className="mb-3 text-xs text-gray-500">
          For each document: number, expiring date, and photo of the front and back.
        </p>
        <div className="space-y-4">
          {DOCUMENT_FIELDS.map(({ key, label }) => {
            const doc = owner.documents[key];
            return (
              <div key={key} className="rounded border border-gray-200 p-3">
                <div className="mb-2 text-sm font-semibold text-gray-900">{label}</div>
                <Row2>
                  <Field label="Document number">
                    <TextInput
                      disabled={readOnly}
                      value={doc.number}
                      onChange={(e) => patchDoc(key, { number: e.target.value })}
                    />
                  </Field>
                  <Field label="Expiring date">
                    <TextInput
                      type="date"
                      disabled={readOnly}
                      value={doc.expiry}
                      onChange={(e) => patchDoc(key, { expiry: e.target.value })}
                    />
                  </Field>
                  <Field label="Photo front">
                    <div className="space-y-1">
                      {doc.frontUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={doc.frontUrl}
                          alt=""
                          className="h-16 w-24 rounded border object-cover"
                        />
                      ) : null}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={readOnly || !onUploadDocument}
                        className="block w-full text-xs"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && onUploadDocument) void onUploadDocument({ docKey: key, side: 'front', file });
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </Field>
                  <Field label="Photo back">
                    <div className="space-y-1">
                      {doc.backUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={doc.backUrl}
                          alt=""
                          className="h-16 w-24 rounded border object-cover"
                        />
                      ) : null}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={readOnly || !onUploadDocument}
                        className="block w-full text-xs"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && onUploadDocument) void onUploadDocument({ docKey: key, side: 'back', file });
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </Field>
                </Row2>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Body measurements and dietary information">
        <Row2>
          <Field label="Height (000.0)">
            <TextInput
              disabled={readOnly}
              inputMode="decimal"
              value={body.height}
              onChange={(e) =>
                onChange({
                  ...owner,
                  bodyMeasurements: {
                    ...body,
                    height: clampDecimal(e.target.value),
                  },
                })
              }
            />
          </Field>
          <Field label="Unit of measurement">
            <TextSelect
              disabled={readOnly}
              value={body.heightUnit}
              onChange={(e) =>
                onChange({
                  ...owner,
                  bodyMeasurements: {
                    ...body,
                    heightUnit: e.target.value === 'inches' ? 'inches' : 'cm',
                  },
                })
              }
            >
              <option value="cm">cm</option>
              <option value="inches">inches</option>
            </TextSelect>
          </Field>
          <Field label="Weight (000.0)">
            <TextInput
              disabled={readOnly}
              inputMode="decimal"
              value={body.weight}
              onChange={(e) =>
                onChange({
                  ...owner,
                  bodyMeasurements: {
                    ...body,
                    weight: clampDecimal(e.target.value),
                  },
                })
              }
            />
          </Field>
          <Field label="Unit of measurement">
            <TextSelect
              disabled={readOnly}
              value={body.weightUnit}
              onChange={(e) =>
                onChange({
                  ...owner,
                  bodyMeasurements: {
                    ...body,
                    weightUnit: e.target.value === 'pounds' ? 'pounds' : 'kg',
                  },
                })
              }
            >
              <option value="kg">kg</option>
              <option value="pounds">pounds</option>
            </TextSelect>
          </Field>
          <Field label="Jersey size (alphanumeric, max 5)">
            <TextInput
              disabled={readOnly}
              maxLength={5}
              inputMode="text"
              autoComplete="off"
              value={body.jerseySize}
              onChange={(e) =>
                onChange({
                  ...owner,
                  bodyMeasurements: { ...body, jerseySize: clampSize(e.target.value) },
                })
              }
            />
          </Field>
          <Field label="Shorts size (alphanumeric, max 5)">
            <TextInput
              disabled={readOnly}
              maxLength={5}
              inputMode="text"
              autoComplete="off"
              value={body.shortsSize}
              onChange={(e) =>
                onChange({
                  ...owner,
                  bodyMeasurements: { ...body, shortsSize: clampSize(e.target.value) },
                })
              }
            />
          </Field>
          <Field label="Shoe size (00.0)">
            <TextInput
              disabled={readOnly}
              inputMode="decimal"
              autoComplete="off"
              placeholder="00.0"
              value={body.shoeSize}
              onChange={(e) =>
                onChange({
                  ...owner,
                  bodyMeasurements: { ...body, shoeSize: clampShoeSize(e.target.value) },
                })
              }
            />
          </Field>
        </Row2>
        <Field label="Intolerances">
          <TextArea
            disabled={readOnly}
            rows={3}
            value={owner.medical.intolerances}
            onChange={(e) =>
              onChange({
                ...owner,
                medical: { ...owner.medical, intolerances: e.target.value },
              })
            }
          />
        </Field>
        <Field label="Allergies">
          <TextArea
            disabled={readOnly}
            rows={3}
            value={owner.medical.allergies}
            onChange={(e) =>
              onChange({
                ...owner,
                medical: { ...owner.medical, allergies: e.target.value },
              })
            }
          />
        </Field>
      </SectionCard>
    </>
  );
}

export function MedicalCertExtraFields({
  owner,
  readOnly,
  onChange,
}: {
  owner: OwnerProfileData;
  readOnly: boolean;
  onChange: (next: OwnerProfileData) => void;
}) {
  return (
    <Row2>
      <Field label="BLSD certificate expiry date">
        <TextInput
          type="date"
          disabled={readOnly}
          value={owner.medical.blsdExpiry}
          onChange={(e) =>
            onChange({
              ...owner,
              medical: { ...owner.medical, blsdExpiry: e.target.value },
            })
          }
        />
      </Field>
      <Field label="'First aid' certificate expiry date">
        <TextInput
          type="date"
          disabled={readOnly}
          value={owner.medical.firstAidExpiry}
          onChange={(e) =>
            onChange({
              ...owner,
              medical: { ...owner.medical, firstAidExpiry: e.target.value },
            })
          }
        />
      </Field>
    </Row2>
  );
}

export function ForeignerAndIbanFields({
  owner,
  readOnly,
  onChange,
}: {
  owner: OwnerProfileData;
  readOnly: boolean;
  onChange: (next: OwnerProfileData) => void;
}) {
  return (
    <>
      <CheckRow
        label="Identification code for foreigners"
        disabled={readOnly}
        checked={owner.administrative.foreignerIdCode}
        onChange={(v) =>
          onChange({
            ...owner,
            administrative: { ...owner.administrative, foreignerIdCode: v },
          })
        }
      />
      <Field label="IBAN">
        <TextInput
          disabled={readOnly}
          value={owner.administrative.iban}
          onChange={(e) =>
            onChange({
              ...owner,
              administrative: { ...owner.administrative, iban: e.target.value },
            })
          }
        />
      </Field>
    </>
  );
}
