import { prisma } from '@/lib/prisma';

export type MoodMusicRow = {
  id: number;
  title: string;
  image_url: string;
  playlistid: string;
  update_order: number;
};

/**
 * Full legacy PHP mood_music list (8 sections from clubs/mood_music).
 * playlistid accepts YouTube playlist or single-video ids.
 */
const SEED_ROWS: Array<Omit<MoodMusicRow, 'id'>> = [
  {
    title: 'In planetary orbit',
    image_url: 'https://i.ytimg.com/vi/TPWYQ94Ief4/hqdefault.jpg',
    // Legacy production clubs/show_video?link=…
    playlistid: 'PLoD5t3mcnxH4N5MFbgMSz9heHN_hVy8O7',
    update_order: 0,
  },
  {
    title: 'Atmospheres of space',
    image_url: 'https://i.ytimg.com/vi/Gf0Wlo6hJMg/hqdefault.jpg',
    playlistid: 'Gf0Wlo6hJMg',
    update_order: 1,
  },
  {
    title: 'Lounge & Chillout',
    image_url: 'https://i.ytimg.com/vi/7n2LJxX_3J0/hqdefault.jpg',
    playlistid: '7n2LJxX_3J0',
    update_order: 2,
  },
  {
    title: 'Atmospheres in Coffee Radio',
    image_url: 'https://i.ytimg.com/vi/omIqNHyhy-c/hqdefault.jpg',
    playlistid: 'omIqNHyhy-c',
    update_order: 3,
  },
  {
    title: 'Landscapes & Countries',
    image_url: 'https://i.ytimg.com/vi/h2VVCAP6WOc/hqdefault.jpg',
    playlistid: 'h2VVCAP6WOc',
    update_order: 4,
  },
  {
    title: 'Soft atmospheres without music',
    image_url: 'https://i.ytimg.com/vi/1RcVIuZ8Wdk/hqdefault.jpg',
    playlistid: '1RcVIuZ8Wdk',
    update_order: 5,
  },
  {
    title: 'Christmas & Halloween atmospheres',
    image_url: 'https://i.ytimg.com/vi/le2vhI3klew/hqdefault.jpg',
    playlistid: 'le2vhI3klew',
    update_order: 6,
  },
  {
    title: 'Soft atmospheres with music',
    image_url: 'https://i.ytimg.com/vi/xknOrXoIHDA/hqdefault.jpg',
    playlistid: 'xknOrXoIHDA',
    update_order: 7,
  },
];

let ensurePromise: Promise<void> | null = null;

export async function ensureMoodMusicTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`mood_music\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`title\` VARCHAR(255) NOT NULL,
          \`image_url\` TEXT NOT NULL,
          \`playlistid\` VARCHAR(255) NOT NULL,
          \`update_order\` INT NOT NULL DEFAULT 0,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      const existing = await prisma.$queryRaw<
        Array<{ title: string; image_url: string; playlistid: string }>
      >`
        SELECT title, image_url, playlistid FROM mood_music
      `;
      const byTitle = new Map(
        existing.map((r) => [
          String(r.title).trim().toLowerCase(),
          {
            image_url: String(r.image_url ?? ''),
            playlistid: String(r.playlistid ?? ''),
          },
        ])
      );

      for (const row of SEED_ROWS) {
        const key = row.title.trim().toLowerCase();
        const current = byTitle.get(key);
        if (current === undefined) {
          await prisma.$executeRaw`
            INSERT INTO mood_music (title, image_url, playlistid, update_order)
            VALUES (${row.title}, ${row.image_url}, ${row.playlistid}, ${row.update_order})
          `;
          continue;
        }
        // Repair broken thumbs / stale single-video playlist stubs from early seed.
        const brokenImage =
          !current.image_url.trim() ||
          /sW9jw5YLn-E|khj_MVQXZZ4|LS6CDuuTUUk|IUEfHtMEqmc/i.test(current.image_url);
        const stalePlaylist =
          current.playlistid === 'TPWYQ94Ief4' ||
          current.playlistid !== row.playlistid &&
            /^(TPWYQ94Ief4|Gf0Wlo6hJMg|7n2LJxX_3J0)$/i.test(current.playlistid);
        if (
          (brokenImage && current.image_url !== row.image_url) ||
          (stalePlaylist && current.playlistid !== row.playlistid)
        ) {
          await prisma.$executeRaw`
            UPDATE mood_music
            SET image_url = ${row.image_url}, playlistid = ${row.playlistid}
            WHERE title = ${row.title}
          `;
        }
      }
    })().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  await ensurePromise;
}

export async function listMoodMusic(): Promise<MoodMusicRow[]> {
  await ensureMoodMusicTable();
  const rows = await prisma.$queryRaw<MoodMusicRow[]>`
    SELECT id, title, image_url, playlistid, update_order
    FROM mood_music
    ORDER BY update_order ASC, id ASC
  `;
  return rows.map((row) => ({
    id: Number(row.id),
    title: String(row.title ?? ''),
    image_url: String(row.image_url ?? ''),
    playlistid: String(row.playlistid ?? ''),
    update_order: Number(row.update_order ?? 0),
  }));
}

/** Persist drag order — `orderedIds` is the new top-to-bottom id sequence. */
export async function updateMoodMusicOrder(orderedIds: number[]): Promise<void> {
  await ensureMoodMusicTable();
  const ids = orderedIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return;

  await prisma.$transaction(
    ids.map(
      (id, updateOrder) =>
        prisma.$executeRaw`
          UPDATE mood_music SET update_order = ${updateOrder} WHERE id = ${id}
        `
    )
  );
}

export { moodMusicEmbedUrl } from './moodMusicEmbed';
