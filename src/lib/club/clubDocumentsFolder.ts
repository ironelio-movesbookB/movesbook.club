import {
  parseClubDescriptionMeta,
  type ClubDescriptionMeta,
} from '@/lib/club/clubSidebarLabel';
import { getClubLegalDocuments } from '@/lib/club/clubLegalDocuments';
import { sanitizeRichHtml } from '@/lib/sanitizeRichHtml';
import { toMediaApiPath } from '@/lib/uploadMediaUrl';

/** Stored under public/uploads/club_documents/ */
export const CLUB_DOCUMENTS_UPLOAD_SUBDIR = 'club_documents';
export const CLUB_DOCUMENT_PDF_MAX_BYTES = 15 * 1024 * 1024;

/** Browser URL for a stored club document PDF (via /api/media for production). */
export function clubDocumentFileHref(filePath: string | null | undefined): string | undefined {
  if (!filePath?.trim()) return undefined;
  return toMediaApiPath(filePath) || filePath;
}

export type DocumentSourceKey =
  | 'courses-listprices'
  | 'courses-timetables'
  | 'services'
  | 'products-catalog'
  | 'staff'
  | 'members'
  | 'not-members'
  | 'members-pending'
  | 'members-archived'
  | 'common-rules';

export const DOCUMENT_GENERATE_SOURCES: ReadonlyArray<{
  key: DocumentSourceKey;
  label: string;
  ready: boolean;
}> = [
  { key: 'courses-listprices', label: 'Courses and their listprices', ready: true },
  { key: 'courses-timetables', label: 'Courses and the timetables', ready: true },
  { key: 'services', label: 'List of Services available', ready: true },
  { key: 'products-catalog', label: 'Catalog of products', ready: true },
  { key: 'staff', label: 'List of Staff', ready: true },
  { key: 'members', label: 'List of Members', ready: true },
  { key: 'not-members', label: 'List of Not-members', ready: true },
  { key: 'members-pending', label: 'List of Members in pending', ready: true },
  { key: 'members-archived', label: 'List of Members archived', ready: true },
  { key: 'common-rules', label: 'Common rules for the Members', ready: true },
];

export type ClubFolderDocumentType = 'html' | 'pdf' | 'generated';

export type ClubFolderDocument = {
  id: string;
  title: string;
  type: ClubFolderDocumentType;
  contentHtml?: string;
  filePath?: string;
  fileName?: string;
  visible: boolean;
  sourceKeys?: DocumentSourceKey[];
  createdAt: string;
  updatedAt: string;
};

export type ClubDocumentsFolderState = {
  pageShared: boolean;
  /** Visibility for built-in Rules / Privacy Policy rows. */
  builtinVisible: {
    rules: boolean;
    privacyPolicy: boolean;
  };
  items: ClubFolderDocument[];
};

export type DocumentsFolderListItem = {
  id: string;
  title: string;
  type: 'builtin-rules' | 'builtin-privacy' | ClubFolderDocumentType;
  visible: boolean;
  editable: boolean;
  deletable: boolean;
  duplicatable: boolean;
  filePath?: string;
  fileName?: string;
  updatedAt?: string;
  sourceKeys?: DocumentSourceKey[];
};

export const BUILTIN_RULES_ID = 'builtin-rules';
export const BUILTIN_PRIVACY_ID = 'builtin-privacy';

function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return `doc_${c.randomUUID().replace(/-/g, '')}`;
  }
  return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function defaultDocumentsFolder(): ClubDocumentsFolderState {
  return {
    pageShared: false,
    builtinVisible: { rules: true, privacyPolicy: true },
    items: [],
  };
}

export function getDocumentsFolder(
  description: string | null | undefined,
): ClubDocumentsFolderState {
  const meta = parseClubDescriptionMeta(description);
  const raw = meta.documentsFolder;
  const base = defaultDocumentsFolder();
  if (!raw || typeof raw !== 'object') return base;
  return {
    pageShared: Boolean(raw.pageShared),
    builtinVisible: {
      rules: raw.builtinVisible?.rules !== false,
      privacyPolicy: raw.builtinVisible?.privacyPolicy !== false,
    },
    items: Array.isArray(raw.items)
      ? raw.items
          .filter((item): item is ClubFolderDocument => Boolean(item?.id && item?.title))
          .map((item) => ({
            id: String(item.id),
            title: String(item.title || 'Untitled').trim() || 'Untitled',
            type:
              item.type === 'pdf' || item.type === 'generated' || item.type === 'html'
                ? item.type
                : 'html',
            contentHtml: typeof item.contentHtml === 'string' ? item.contentHtml : '',
            filePath: typeof item.filePath === 'string' ? item.filePath : undefined,
            fileName: typeof item.fileName === 'string' ? item.fileName : undefined,
            visible: item.visible !== false,
            sourceKeys: Array.isArray(item.sourceKeys)
              ? (item.sourceKeys.filter(Boolean) as DocumentSourceKey[])
              : undefined,
            createdAt: String(item.createdAt || new Date().toISOString()),
            updatedAt: String(item.updatedAt || item.createdAt || new Date().toISOString()),
          }))
      : [],
  };
}

export function mergeDocumentsFolderForSave(
  existingDescription: string | null | undefined,
  folder: ClubDocumentsFolderState,
): string {
  const prev = parseClubDescriptionMeta(existingDescription);
  const meta: ClubDescriptionMeta = {
    ...prev,
    createdViaForm: prev.createdViaForm ?? true,
    documentsFolder: {
      pageShared: Boolean(folder.pageShared),
      builtinVisible: {
        rules: folder.builtinVisible.rules !== false,
        privacyPolicy: folder.builtinVisible.privacyPolicy !== false,
      },
      items: folder.items.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        contentHtml: item.contentHtml || '',
        filePath: item.filePath,
        fileName: item.fileName,
        visible: item.visible !== false,
        sourceKeys: item.sourceKeys,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    },
  };
  return JSON.stringify(meta);
}

export function listDocumentsFolderItems(
  description: string | null | undefined,
  opts?: { search?: string; sharedOnly?: boolean },
): DocumentsFolderListItem[] {
  const folder = getDocumentsFolder(description);
  const legal = getClubLegalDocuments(description);
  const search = (opts?.search || '').trim().toLowerCase();
  const sharedOnly = Boolean(opts?.sharedOnly);

  const builtin: DocumentsFolderListItem[] = [
    {
      id: BUILTIN_RULES_ID,
      title: 'Rules of the Club/Team',
      type: 'builtin-rules',
      visible: folder.builtinVisible.rules,
      editable: true,
      deletable: false,
      duplicatable: true,
      updatedAt: legal.rulesHtml ? undefined : undefined,
    },
    {
      id: BUILTIN_PRIVACY_ID,
      title: 'Privacy Policy',
      type: 'builtin-privacy',
      visible: folder.builtinVisible.privacyPolicy,
      editable: true,
      deletable: false,
      duplicatable: true,
      updatedAt: undefined,
    },
  ];

  const custom: DocumentsFolderListItem[] = folder.items.map((item) => ({
    id: item.id,
    title: item.title,
    type: item.type,
    visible: item.visible,
    editable: item.type !== 'pdf',
    deletable: true,
    duplicatable: true,
    filePath: clubDocumentFileHref(item.filePath) || item.filePath,
    fileName: item.fileName,
    updatedAt: item.updatedAt,
    sourceKeys: item.sourceKeys,
  }));

  let rows = [...builtin, ...custom];
  if (sharedOnly) rows = rows.filter((r) => r.visible);
  if (search) rows = rows.filter((r) => r.title.toLowerCase().includes(search));
  rows.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  return rows;
}

export function findFolderDocument(
  folder: ClubDocumentsFolderState,
  docId: string,
): ClubFolderDocument | null {
  return folder.items.find((item) => item.id === docId) ?? null;
}

export function createHtmlDocument(
  folder: ClubDocumentsFolderState,
  title: string,
  contentHtml = '',
): { folder: ClubDocumentsFolderState; doc: ClubFolderDocument } {
  const now = new Date().toISOString();
  const doc: ClubFolderDocument = {
    id: newId(),
    title: title.trim() || 'Untitled document',
    type: 'html',
    contentHtml: sanitizeRichHtml(contentHtml),
    visible: true,
    createdAt: now,
    updatedAt: now,
  };
  return { folder: { ...folder, items: [...folder.items, doc] }, doc };
}

export function createPdfDocument(
  folder: ClubDocumentsFolderState,
  title: string,
  filePath: string,
  fileName: string,
): { folder: ClubDocumentsFolderState; doc: ClubFolderDocument } {
  const now = new Date().toISOString();
  const doc: ClubFolderDocument = {
    id: newId(),
    title: title.trim() || fileName.replace(/\.pdf$/i, '') || 'PDF document',
    type: 'pdf',
    filePath,
    fileName,
    visible: true,
    createdAt: now,
    updatedAt: now,
  };
  return { folder: { ...folder, items: [...folder.items, doc] }, doc };
}

export function createGeneratedDocument(
  folder: ClubDocumentsFolderState,
  title: string,
  contentHtml: string,
  sourceKeys: DocumentSourceKey[],
  pdf?: { filePath: string; fileName: string },
): { folder: ClubDocumentsFolderState; doc: ClubFolderDocument } {
  const now = new Date().toISOString();
  const doc: ClubFolderDocument = {
    id: newId(),
    title: title.trim() || 'Generated document',
    type: 'generated',
    contentHtml: sanitizeRichHtml(contentHtml),
    filePath: pdf?.filePath,
    fileName: pdf?.fileName,
    sourceKeys,
    visible: true,
    createdAt: now,
    updatedAt: now,
  };
  return { folder: { ...folder, items: [...folder.items, doc] }, doc };
}

export function duplicateFolderDocument(
  description: string | null | undefined,
  docId: string,
): {
  folder: ClubDocumentsFolderState;
  doc: ClubFolderDocument;
  /** Original PDF path to copy on the server (do not share the same file). */
  sourceFilePath?: string;
} | null {
  const folder = getDocumentsFolder(description);
  const legal = getClubLegalDocuments(description);
  const now = new Date().toISOString();

  if (docId === BUILTIN_RULES_ID) {
    return createHtmlDocument(folder, 'Rules of the Club/Team (copy)', legal.rulesHtml);
  }
  if (docId === BUILTIN_PRIVACY_ID) {
    return createHtmlDocument(folder, 'Privacy Policy (copy)', legal.privacyPolicyHtml);
  }

  const source = findFolderDocument(folder, docId);
  if (!source) return null;
  const doc: ClubFolderDocument = {
    ...source,
    id: newId(),
    title: `${source.title} (copy)`,
    // Clear path until the API copies the bytes to a new file.
    filePath: undefined,
    createdAt: now,
    updatedAt: now,
  };
  return {
    folder: { ...folder, items: [...folder.items, doc] },
    doc,
    sourceFilePath: source.filePath,
  };
}

export function updateFolderDocument(
  folder: ClubDocumentsFolderState,
  docId: string,
  patch: Partial<
    Pick<ClubFolderDocument, 'title' | 'contentHtml' | 'visible' | 'filePath' | 'fileName'>
  >,
): ClubDocumentsFolderState | null {
  const idx = folder.items.findIndex((item) => item.id === docId);
  if (idx < 0) return null;
  const prev = folder.items[idx]!;
  const next: ClubFolderDocument = {
    ...prev,
    title: typeof patch.title === 'string' ? patch.title.trim() || prev.title : prev.title,
    contentHtml:
      typeof patch.contentHtml === 'string'
        ? sanitizeRichHtml(patch.contentHtml)
        : prev.contentHtml,
    visible: typeof patch.visible === 'boolean' ? patch.visible : prev.visible,
    filePath: typeof patch.filePath === 'string' ? patch.filePath : prev.filePath,
    fileName: typeof patch.fileName === 'string' ? patch.fileName : prev.fileName,
    updatedAt: new Date().toISOString(),
  };
  const items = folder.items.slice();
  items[idx] = next;
  return { ...folder, items };
}

export function deleteFolderDocument(
  folder: ClubDocumentsFolderState,
  docId: string,
): { folder: ClubDocumentsFolderState; removed: ClubFolderDocument } | null {
  const removed = findFolderDocument(folder, docId);
  if (!removed) return null;
  return {
    folder: { ...folder, items: folder.items.filter((item) => item.id !== docId) },
    removed,
  };
}

export function setBuiltinVisible(
  folder: ClubDocumentsFolderState,
  which: 'rules' | 'privacyPolicy',
  visible: boolean,
): ClubDocumentsFolderState {
  return {
    ...folder,
    builtinVisible: { ...folder.builtinVisible, [which]: visible },
  };
}

export function documentPublicHref(entityId: string, docId: string): string {
  return `/club/documents/view/${encodeURIComponent(docId)}?clubId=${encodeURIComponent(entityId)}`;
}

export function documentsPagePublicHref(entityId: string): string {
  return `/club/documents/shared?clubId=${encodeURIComponent(entityId)}`;
}

export function sourceLabel(key: DocumentSourceKey): string {
  return DOCUMENT_GENERATE_SOURCES.find((s) => s.key === key)?.label || key;
}
