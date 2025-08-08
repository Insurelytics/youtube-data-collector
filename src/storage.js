import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'data.sqlite');

let db;

export function ensureDatabase() {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      handle TEXT
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      channelId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      publishedAt TEXT NOT NULL,
      durationSeconds INTEGER,
      viewCount INTEGER,
      likeCount INTEGER,
      commentCount INTEGER,
      tags TEXT,
      thumbnails TEXT,
      raw TEXT,
      lastSyncedAt TEXT,
      FOREIGN KEY(channelId) REFERENCES channels(id)
    );

    CREATE INDEX IF NOT EXISTS idx_videos_channel_date ON videos(channelId, publishedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_videos_views ON videos(viewCount DESC);
  `);
  return db;
}

export function upsertChannel(channel) {
  ensureDatabase();
  const stmt = db.prepare(`
    INSERT INTO channels (id, title, handle)
    VALUES (@id, @title, @handle)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title, handle=excluded.handle
  `);
  stmt.run(channel);
}

export function upsertVideos(videos) {
  ensureDatabase();
  const nowIso = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO videos (
      id, channelId, title, description, publishedAt, durationSeconds,
      viewCount, likeCount, commentCount, tags, thumbnails, raw, lastSyncedAt
    ) VALUES (
      @id, @channelId, @title, @description, @publishedAt, @durationSeconds,
      @viewCount, @likeCount, @commentCount, @tags, @thumbnails, @raw, @lastSyncedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      description=excluded.description,
      publishedAt=excluded.publishedAt,
      durationSeconds=excluded.durationSeconds,
      viewCount=excluded.viewCount,
      likeCount=excluded.likeCount,
      commentCount=excluded.commentCount,
      tags=excluded.tags,
      thumbnails=excluded.thumbnails,
      raw=excluded.raw,
      lastSyncedAt=excluded.lastSyncedAt
  `);

  const toRow = (v) => ({
    id: v.id,
    channelId: v.channelId,
    title: v.title,
    description: v.description || '',
    publishedAt: v.publishedAt,
    durationSeconds: v.durationSeconds || null,
    viewCount: v.viewCount ?? null,
    likeCount: v.likeCount ?? null,
    commentCount: v.commentCount ?? null,
    tags: v.tags ? JSON.stringify(v.tags) : null,
    thumbnails: v.thumbnails ? JSON.stringify(v.thumbnails) : null,
    raw: v.raw ? JSON.stringify(v.raw) : null,
    lastSyncedAt: nowIso,
  });

  const tx = db.transaction((all) => {
    for (const item of all) stmt.run(toRow(item));
  });
  tx(videos);
}

export function queryVideos({ search, sort, order, page, pageSize }) {
  ensureDatabase();
  const params = {};
  const where = [];
  if (search) {
    where.push('(title LIKE :q OR description LIKE :q)');
    params.q = `%${search}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  let sortColumn = 'publishedAt';
  if (sort === 'views') sortColumn = 'viewCount';
  if (sort === 'likes') sortColumn = 'likeCount';
  if (sort === 'comments') sortColumn = 'commentCount';

  const orderSql = order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const total = db.prepare(`SELECT COUNT(*) as c FROM videos ${whereSql}`).get(params).c;
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`
    SELECT id, channelId, title, description, publishedAt, durationSeconds,
           viewCount, likeCount, commentCount, thumbnails
    FROM videos
    ${whereSql}
    ORDER BY ${sortColumn} ${orderSql}
    LIMIT :limit OFFSET :offset
  `).all({ ...params, limit: pageSize, offset });

  return { total, rows };
}


