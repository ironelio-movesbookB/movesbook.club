import {
  parseClubDescriptionMeta,
  type ClubDescriptionMeta,
} from '@/lib/club/clubSidebarLabel';

export type ClubLegalDocKind = 'rules' | 'privacy-policy';

export type ClubLegalDocuments = {
  rulesHtml: string;
  privacyPolicyHtml: string;
};

export function getClubLegalDocuments(
  description: string | null | undefined,
): ClubLegalDocuments {
  const meta = parseClubDescriptionMeta(description);
  return {
    rulesHtml: meta.legalDocuments?.rulesHtml?.trim() || '',
    privacyPolicyHtml: meta.legalDocuments?.privacyPolicyHtml?.trim() || '',
  };
}

export function legalDocTitle(kind: ClubLegalDocKind): string {
  return kind === 'rules' ? 'Rules' : 'Privacy policy';
}

export function legalDocHtml(
  docs: ClubLegalDocuments,
  kind: ClubLegalDocKind,
): string {
  return kind === 'rules' ? docs.rulesHtml : docs.privacyPolicyHtml;
}

export function mergeClubLegalDocumentsForSave(
  existingDescription: string | null | undefined,
  docs: ClubLegalDocuments,
): string {
  const prev = parseClubDescriptionMeta(existingDescription);
  const meta: ClubDescriptionMeta = {
    ...prev,
    createdViaForm: prev.createdViaForm ?? true,
    legalDocuments: {
      rulesHtml: docs.rulesHtml,
      privacyPolicyHtml: docs.privacyPolicyHtml,
    },
  };
  return JSON.stringify(meta);
}

export function clubLegalDocumentHref(clubId: string, kind: ClubLegalDocKind): string {
  return `/club/legal-documents/${kind}?clubId=${encodeURIComponent(clubId)}`;
}
