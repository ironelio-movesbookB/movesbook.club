/** Localized copy for Parents → Send by mail (rules + privacy acceptance). */

export type ParentsAcceptanceKind = 'club' | 'team';

export type ParentsAcceptanceMailCopy = {
  subject: string;
  sentence: string;
  regards: string;
  rulesTitle: string;
  privacyTitle: string;
};

function normalizeLang(code: string | null | undefined): string {
  const raw = String(code || 'en').trim().toLowerCase();
  if (!raw) return 'en';
  return raw.split(/[-_]/)[0] || 'en';
}

export function parentsAcceptanceMailCopy(
  languageCode: string | null | undefined,
  kind: ParentsAcceptanceKind,
  entityName: string,
): ParentsAcceptanceMailCopy {
  const lang = normalizeLang(languageCode);
  const name = entityName.trim() || (kind === 'team' ? 'Team' : 'Club');

  if (lang === 'it') {
    const entityWord = kind === 'team' ? 'team' : 'club';
    return {
      subject: `Accettazione del regolamento - ${name}`,
      sentence: `Vi informiamo che avete letto e accettato il regolamento del nostro ${entityWord}.`,
      regards: 'Cordiali saluti',
      rulesTitle: 'Regolamento',
      privacyTitle: 'Informativa sulla privacy',
    };
  }

  return {
    subject: `Acceptance of the rules and regulations - ${name}`,
    sentence: `We hereby inform you that you have read and accepted the rules and regulations of our ${kind}.`,
    regards: 'Best regards',
    rulesTitle: 'Rules',
    privacyTitle: 'Privacy policy',
  };
}

export function parentsAcceptanceConfirmMessage(params: {
  languageCode: string | null | undefined;
  willSave: boolean;
  recipientLines: string[];
}): string {
  const lang = normalizeLang(params.languageCode);
  const list = params.recipientLines.join('\n');
  if (lang === 'it') {
    const intro = params.willSave
      ? 'I dati dei Genitori verranno salvati, poi la conferma di accettazione con Regolamento e Informativa sulla privacy in allegato sarà inviata a:'
      : 'La conferma di accettazione con Regolamento e Informativa sulla privacy in allegato sarà inviata a:';
    return `${intro}\n\n${list}`;
  }
  const intro = params.willSave
    ? 'The Parents data will be saved, then the confirmation of acceptance with the Rules and the Privacy policy attached will be sent to:'
    : 'The confirmation of acceptance with the Rules and the Privacy policy attached will be sent to:';
  return `${intro}\n\n${list}`;
}
