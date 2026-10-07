import { randomBytes, randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/prisma';
import { getServerPublicDir } from '@/lib/serverPublicDir';
import type { CoachWorkspace } from '@/lib/club/clubCoachService';
import {
  MAX_MEETING_FILE_BYTES,
  MEETING_FILE_EXTENSIONS,
  type ClubMeeting,
  type ClubMeetingInput,
} from '@/lib/club/clubStaffAdmin.constants';

const TABLE = 'club_meetings';
const UPLOAD_SUBDIR = 'club_meetings';

export class ClubMeetingError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${TABLE}\` (
      id VARCHAR(191) NOT NULL,
      workspace_kind VARCHAR(10) NOT NULL,
      workspace_id VARCHAR(191) NOT NULL,
      meeting_date DATE NOT NULL,
      subject VARCHAR(255) NOT NULL,
      secretary VARCHAR(191) NOT NULL DEFAULT '',
      document_name VARCHAR(191) NOT NULL DEFAULT '',
      document_html MEDIUMTEXT NULL,
      file_name VARCHAR(191) NULL,
      file_path VARCHAR(255) NULL,
      author_id VARCHAR(191) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY club_meetings_workspace_idx (workspace_kind, workspace_id, meeting_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tableReady = true;
}

type MeetingRow = {
  id: string;
  meeting_date: Date;
  subject: string;
  secretary: string;
  document_name: string;
  document_html: string | null;
  file_name: string | null;
  file_path: string | null;
  created_at: Date;
  updated_at: Date;
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

function toMeeting(r: MeetingRow, withDocument: boolean): ClubMeeting {
  return {
    id: r.id,
    meetingDate: new Date(r.meeting_date).toISOString().slice(0, 10),
    subject: r.subject,
    secretary: r.secretary,
    documentName: r.document_name,
    documentHtml: withDocument ? r.document_html ?? '' : '',
    fileName: r.file_name ?? '',
    fileUrl: r.file_path ?? '',
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export function parseMeetingInput(body: Record<string, unknown>): ClubMeetingInput {
  const meetingDate = str(body.meetingDate, 10);
  if (!YMD.test(meetingDate)) throw new ClubMeetingError('Enter the date of the meeting', 400);
  const subject = str(body.subject, 255);
  if (!subject) throw new ClubMeetingError('Enter the subject of the meeting', 400);
  return {
    meetingDate,
    subject,
    secretary: str(body.secretary, 191),
    documentName: str(body.documentName, 191),
    documentHtml: String(body.documentHtml ?? '').slice(0, 2_000_000),
  };
}

async function getRow(ws: CoachWorkspace, id: string): Promise<MeetingRow> {
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<MeetingRow[]>(
    `SELECT * FROM \`${TABLE}\` WHERE id = ? AND workspace_kind = ? AND workspace_id = ?`,
    id,
    ws.kind,
    ws.id,
  );
  if (!rows[0]) throw new ClubMeetingError('Meeting not found', 404);
  return rows[0];
}

export async function listMeetings(ws: CoachWorkspace): Promise<ClubMeeting[]> {
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<MeetingRow[]>(
    `SELECT id, meeting_date, subject, secretary, document_name, NULL AS document_html, file_name, file_path, created_at, updated_at
     FROM \`${TABLE}\` WHERE workspace_kind = ? AND workspace_id = ? ORDER BY meeting_date DESC, created_at DESC`,
    ws.kind,
    ws.id,
  );
  return rows.map((r) => toMeeting(r, false));
}

export async function getMeeting(ws: CoachWorkspace, id: string): Promise<ClubMeeting> {
  return toMeeting(await getRow(ws, id), true);
}

export async function createMeeting(ws: CoachWorkspace, input: ClubMeetingInput, authorId: string): Promise<ClubMeeting> {
  await ensureTable();
  const id = randomUUID();
  const now = new Date();
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${TABLE}\` (id, workspace_kind, workspace_id, meeting_date, subject, secretary, document_name, document_html, author_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ws.kind,
    ws.id,
    input.meetingDate,
    input.subject,
    input.secretary,
    input.documentName,
    input.documentHtml || null,
    authorId,
    now,
    now,
  );
  return getMeeting(ws, id);
}

export async function updateMeeting(ws: CoachWorkspace, id: string, input: ClubMeetingInput): Promise<ClubMeeting> {
  await getRow(ws, id);
  await prisma.$executeRawUnsafe(
    `UPDATE \`${TABLE}\` SET meeting_date = ?, subject = ?, secretary = ?, document_name = ?, document_html = ?, updated_at = ?
     WHERE id = ? AND workspace_kind = ? AND workspace_id = ?`,
    input.meetingDate,
    input.subject,
    input.secretary,
    input.documentName,
    input.documentHtml || null,
    new Date(),
    id,
    ws.kind,
    ws.id,
  );
  return getMeeting(ws, id);
}

async function removeStoredFile(publicPath: string | null) {
  if (!publicPath?.startsWith(`/uploads/${UPLOAD_SUBDIR}/`)) return;
  const fileName = publicPath.slice(`/uploads/${UPLOAD_SUBDIR}/`.length);
  if (!/^[A-Za-z0-9_.-]+$/.test(fileName)) return;
  await unlink(join(getServerPublicDir(), 'uploads', UPLOAD_SUBDIR, fileName)).catch(() => {});
}

export async function deleteMeeting(ws: CoachWorkspace, id: string) {
  const row = await getRow(ws, id);
  await prisma.$executeRawUnsafe(
    `DELETE FROM \`${TABLE}\` WHERE id = ? AND workspace_kind = ? AND workspace_id = ?`,
    id,
    ws.kind,
    ws.id,
  );
  await removeStoredFile(row.file_path);
}

/** Stores (or replaces) the attachment of a meeting under an unguessable public file name. */
export async function attachMeetingFile(ws: CoachWorkspace, id: string, file: Blob, originalName: string) {
  const row = await getRow(ws, id);
  if (file.size === 0) throw new ClubMeetingError('The file is empty', 400);
  if (file.size > MAX_MEETING_FILE_BYTES) throw new ClubMeetingError('The file cannot be larger than 15MB', 400);
  const ext = (originalName.split('.').pop() ?? '').toLowerCase();
  if (!(MEETING_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new ClubMeetingError('File type not allowed', 400);
  }
  const dir = join(getServerPublicDir(), 'uploads', UPLOAD_SUBDIR);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const stored = `${randomBytes(16).toString('hex')}.${ext}`;
  await writeFile(join(dir, stored), Buffer.from(await file.arrayBuffer()));
  const publicPath = `/uploads/${UPLOAD_SUBDIR}/${stored}`;
  await prisma.$executeRawUnsafe(
    `UPDATE \`${TABLE}\` SET file_name = ?, file_path = ?, updated_at = ? WHERE id = ?`,
    str(originalName, 191) || stored,
    publicPath,
    new Date(),
    id,
  );
  await removeStoredFile(row.file_path);
  return getMeeting(ws, id);
}

export async function removeMeetingFile(ws: CoachWorkspace, id: string) {
  const row = await getRow(ws, id);
  await prisma.$executeRawUnsafe(
    `UPDATE \`${TABLE}\` SET file_name = NULL, file_path = NULL, updated_at = ? WHERE id = ?`,
    new Date(),
    id,
  );
  await removeStoredFile(row.file_path);
  return getMeeting(ws, id);
}
