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
      platform TEXT DEFAULT 'youtube',
      shortCode TEXT,
      displayUrl TEXT,
      localImageUrl TEXT,
      videoUrl TEXT,
      dimensions TEXT,
      mentions TEXT,
      takenAtTimestamp INTEGER,
      FOREIGN KEY(channelId) REFERENCES channels(id)
    );

    CREATE INDEX IF NOT EXISTS idx_videos_channel_date ON videos(channelId, publishedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_videos_views ON videos(viewCount DESC);
  `);
  return db;
}

export function upsertChannel(channel) {
  ensureDatabase();
  // Migrate schema if needed
  try { db.exec('ALTER TABLE channels ADD COLUMN subscriberCount INTEGER'); } catch {}
  try { db.exec('ALTER TABLE channels ADD COLUMN isActive INTEGER DEFAULT 1'); } catch {}
  try { db.exec('ALTER TABLE channels ADD COLUMN thumbnailUrl TEXT'); } catch {}
  try { db.exec('ALTER TABLE channels ADD COLUMN platform TEXT DEFAULT "youtube"'); } catch {}
  
  // Migrate videos table for Instagram support
  try { db.exec('ALTER TABLE videos ADD COLUMN platform TEXT DEFAULT "youtube"'); } catch {}
  try { db.exec('ALTER TABLE videos ADD COLUMN shortCode TEXT'); } catch {}
  try { db.exec('ALTER TABLE videos ADD COLUMN displayUrl TEXT'); } catch {}
  try { db.exec('ALTER TABLE videos ADD COLUMN videoUrl TEXT'); } catch {}
  try { db.exec('ALTER TABLE videos ADD COLUMN dimensions TEXT'); } catch {}
  try { db.exec('ALTER TABLE videos ADD COLUMN mentions TEXT'); } catch {}
  try { db.exec('ALTER TABLE videos ADD COLUMN takenAtTimestamp INTEGER'); } catch {}
  try { db.exec('ALTER TABLE videos ADD COLUMN localImageUrl TEXT'); } catch {}

  const stmt = db.prepare(`
    INSERT INTO channels (id, title, handle, subscriberCount, isActive, thumbnailUrl, platform)
    VALUES (@id, @title, @handle, @subscriberCount, COALESCE(@isActive, 1), @thumbnailUrl, COALESCE(@platform, 'youtube'))
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      handle=excluded.handle,
      subscriberCount=COALESCE(excluded.subscriberCount, channels.subscriberCount),
      isActive=COALESCE(excluded.isActive, channels.isActive),
      thumbnailUrl=COALESCE(excluded.thumbnailUrl, channels.thumbnailUrl),
      platform=COALESCE(excluded.platform, channels.platform)
  `);
  const withDefaults = { subscriberCount: null, isActive: 1, thumbnailUrl: null, platform: 'youtube', ...channel };
  stmt.run(withDefaults);
}

export function upsertVideos(videos) {
  ensureDatabase();
  const nowIso = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO videos (
      id, channelId, title, description, publishedAt, durationSeconds,
      viewCount, likeCount, commentCount, tags, thumbnails, raw, lastSyncedAt,
      platform, shortCode, displayUrl, localImageUrl, videoUrl, dimensions, mentions, takenAtTimestamp
    ) VALUES (
      @id, @channelId, @title, @description, @publishedAt, @durationSeconds,
      @viewCount, @likeCount, @commentCount, @tags, @thumbnails, @raw, @lastSyncedAt,
      @platform, @shortCode, @displayUrl, @localImageUrl, @videoUrl, @dimensions, @mentions, @takenAtTimestamp
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
      lastSyncedAt=excluded.lastSyncedAt,
      platform=excluded.platform,
      shortCode=excluded.shortCode,
      displayUrl=excluded.displayUrl,
      localImageUrl=excluded.localImageUrl,
      videoUrl=excluded.videoUrl,
      dimensions=excluded.dimensions,
      mentions=excluded.mentions,
      takenAtTimestamp=excluded.takenAtTimestamp
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
    platform: v.platform || 'youtube',
    shortCode: v.shortCode || null,
    displayUrl: v.displayUrl || null,
    localImageUrl: v.localImageUrl || null,
    videoUrl: v.videoUrl || null,
    dimensions: v.dimensions ? JSON.stringify(v.dimensions) : null,
    mentions: v.mentions ? JSON.stringify(v.mentions) : null,
    takenAtTimestamp: v.takenAtTimestamp || null,
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
  const sortEngagementExpr = 'COALESCE(viewCount,0) * (COALESCE(durationSeconds,0) / 60.0) + 150*COALESCE(likeCount,0) + 500*COALESCE(commentCount,0)';

  const orderSql = order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const total = db.prepare(`SELECT COUNT(*) as c FROM videos ${whereSql}`).get(params).c;
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`
    SELECT id, channelId, title, description, publishedAt, durationSeconds,
           viewCount, likeCount, commentCount, thumbnails,
           platform, shortCode, displayUrl, localImageUrl,
           ${sortEngagementExpr} AS engagement
    FROM videos
    ${whereSql}
    ORDER BY ${sort === 'engagement' ? sortEngagementExpr : sortColumn} ${orderSql}
    LIMIT :limit OFFSET :offset
  `).all({ ...params, limit: pageSize, offset });

  return { total, rows };
}

export function listChannels() {
  ensureDatabase();
  try { db.exec('ALTER TABLE channels ADD COLUMN subscriberCount INTEGER'); } catch {}
  try { db.exec('ALTER TABLE channels ADD COLUMN isActive INTEGER DEFAULT 1'); } catch {}
  try { db.exec('ALTER TABLE channels ADD COLUMN thumbnailUrl TEXT'); } catch {}
  try { db.exec('ALTER TABLE channels ADD COLUMN platform TEXT DEFAULT "youtube"'); } catch {}
  // Default existing channels to YouTube
  try { db.exec('UPDATE channels SET platform = "youtube" WHERE platform IS NULL'); } catch {}

  const rows = db.prepare(`
    SELECT c.id, c.title, c.handle, COALESCE(c.subscriberCount, 0) AS subscriberCount,
           COALESCE(c.isActive, 1) AS isActive,
           c.thumbnailUrl AS thumbnailUrl,
           COALESCE(c.platform, 'youtube') AS platform,
           (SELECT MAX(lastSyncedAt) FROM videos v WHERE v.channelId = c.id) AS lastSyncedAt,
           (SELECT COUNT(1) FROM videos v WHERE v.channelId = c.id) AS videoCount,
           (SELECT SUM(COALESCE(viewCount,0)) FROM videos v WHERE v.channelId = c.id) AS totalViews,
           (SELECT AVG(COALESCE(viewCount,0)) FROM videos v WHERE v.channelId = c.id) AS avgViews
    FROM channels c
    ORDER BY c.title COLLATE NOCASE
  `).all();
  return rows;
}

export function removeChannel(id) {
  ensureDatabase();
  try { db.exec('ALTER TABLE channels ADD COLUMN isActive INTEGER DEFAULT 1'); } catch {}
  db.prepare('UPDATE channels SET isActive = 0 WHERE id = ?').run(id);
}

export function getChannel(id) {
  ensureDatabase();
  try { db.exec('ALTER TABLE channels ADD COLUMN subscriberCount INTEGER'); } catch {}
  try { db.exec('ALTER TABLE channels ADD COLUMN isActive INTEGER DEFAULT 1'); } catch {}
  try { db.exec('ALTER TABLE channels ADD COLUMN thumbnailUrl TEXT'); } catch {}
  try { db.exec('ALTER TABLE channels ADD COLUMN platform TEXT DEFAULT "youtube"'); } catch {}
  // Default existing channels to YouTube
  try { db.exec('UPDATE channels SET platform = "youtube" WHERE platform IS NULL'); } catch {}

  return db.prepare(`
    SELECT c.id, c.title, c.handle,
           COALESCE(c.subscriberCount,0) AS subscriberCount,
           COALESCE(c.isActive,1) AS isActive,
           c.thumbnailUrl AS thumbnailUrl,
           COALESCE(c.platform, 'youtube') AS platform,
           (SELECT MAX(lastSyncedAt) FROM videos v WHERE v.channelId = c.id) AS lastSyncedAt,
           COALESCE((SELECT COUNT(1) FROM videos v WHERE v.channelId = c.id), 0) AS videoCount,
           COALESCE((SELECT SUM(COALESCE(viewCount,0)) FROM videos v WHERE v.channelId = c.id), 0) AS totalViews
    FROM channels c
    WHERE c.id = ?
  `).get(id);
}

export function getChannelTrends({ channelId, sinceIso }) {
  ensureDatabase();
  const rows = db.prepare(`
    SELECT date(publishedAt) AS day,
           SUM(COALESCE(viewCount,0)) AS views,
           SUM(COALESCE(likeCount,0)) AS likes,
           SUM(COALESCE(commentCount,0)) AS comments,
           COUNT(1) AS videos
    FROM videos
    WHERE channelId = :channelId AND publishedAt >= :sinceIso
    GROUP BY day
    ORDER BY day ASC
  `).all({ channelId, sinceIso });
  return rows;
}

export function getTopVideos({ channelId, sinceIso, likeWeight = 150, commentWeight = 500 }) {
  ensureDatabase();
  const where = `WHERE channelId = :channelId AND publishedAt >= :sinceIso`;
  const engagement = `COALESCE(viewCount,0) * (COALESCE(durationSeconds,0) / 60.0) + ${likeWeight}*COALESCE(likeCount,0) + ${commentWeight}*COALESCE(commentCount,0)`;
  const views = db.prepare(`
    SELECT id, title, viewCount, likeCount, commentCount, publishedAt, thumbnails, 
           platform, shortCode, displayUrl, localImageUrl, ${engagement} AS engagement
    FROM videos
    ${where}
    ORDER BY ${engagement} DESC
    LIMIT 5
  `).all({ channelId, sinceIso });
  const likes = db.prepare(`SELECT id, title, likeCount FROM videos ${where} ORDER BY COALESCE(likeCount,0) DESC LIMIT 5`).all({ channelId, sinceIso });
  const comments = db.prepare(`SELECT id, title, commentCount FROM videos ${where} ORDER BY COALESCE(commentCount,0) DESC LIMIT 5`).all({ channelId, sinceIso });
  return { views, likes, comments };
}

export function getSpecialVideos({ channelId, subscriberCount, sinceIso, viralMultiplier = 5 }) {
  ensureDatabase();
  const rows = db.prepare(`
    SELECT id, title, viewCount, likeCount, commentCount, publishedAt, thumbnails,
           platform, shortCode, displayUrl, localImageUrl
    FROM videos
    WHERE channelId = :channelId AND publishedAt >= :sinceIso AND COALESCE(viewCount,0) >= :threshold
    ORDER BY COALESCE(viewCount,0) DESC
  `).all({ channelId, sinceIso, threshold: viralMultiplier * (subscriberCount || 0) });
  return rows;
}

export function getViralVideoCount({ channelId, subscriberCount, viralMultiplier = 5, sinceIso }) {
  ensureDatabase();
  const clauses = ['channelId = :channelId', 'COALESCE(viewCount,0) >= :threshold'];
  const params = { channelId, threshold: viralMultiplier * (subscriberCount || 0) };
  
  if (sinceIso) {
    clauses.push('publishedAt >= :sinceIso');
    params.sinceIso = sinceIso;
  }
  
  const whereSql = clauses.join(' AND ');
  const result = db.prepare(`
    SELECT COUNT(*) as count
    FROM videos
    WHERE ${whereSql}
  `).get(params);
  return result?.count || 0;
}

export function queryVideosAdvanced({ sinceIso, channelId, sort, order, page, pageSize, likeWeight = 150, commentWeight = 500 }) {
  ensureDatabase();
  const clauses = [];
  const params = {};
  if (sinceIso) { clauses.push('publishedAt >= :sinceIso'); params.sinceIso = sinceIso; }
  if (channelId) { clauses.push('channelId = :channelId'); params.channelId = channelId; }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderSql = order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const engagement = `COALESCE(viewCount,0) * (COALESCE(durationSeconds,0) / 60.0) + ${likeWeight}*COALESCE(likeCount,0) + ${commentWeight}*COALESCE(commentCount,0)`;
  let sortExpr = 'publishedAt';
  if (sort === 'engagement') sortExpr = engagement;
  if (sort === 'views') sortExpr = 'viewCount';
  if (sort === 'likes') sortExpr = 'likeCount';
  if (sort === 'comments') sortExpr = 'commentCount';
  const total = db.prepare(`SELECT COUNT(*) as c FROM videos ${whereSql}`).get(params).c;
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`
    SELECT id, channelId, title, description, publishedAt, durationSeconds,
           viewCount, likeCount, commentCount, thumbnails, 
           platform, shortCode, displayUrl, localImageUrl, ${engagement} AS engagement
    FROM videos
    ${whereSql}
    ORDER BY ${sortExpr} ${orderSql}
    LIMIT :limit OFFSET :offset
  `).all({ ...params, limit: pageSize, offset });
  return { total, rows };
}


