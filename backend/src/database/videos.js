import { getDatabase } from './connection.js';
import { getEngagementSqlExpression } from '../utils/engagement-utils.js';

export function initVideosSchema() {
  const db = getDatabase();
  db.exec(`
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
      platform TEXT NOT NULL,
      shortCode TEXT,
      displayUrl TEXT,
      localImageUrl TEXT,
      videoUrl TEXT,
      dimensions TEXT,
      mentions TEXT,
      takenAtTimestamp INTEGER,
      transcription TEXT,
      audioPath TEXT,
      audioProcessedAt TEXT,
      transcriptionStatus TEXT DEFAULT 'pending',
      FOREIGN KEY(channelId) REFERENCES channels(id)
    );

    CREATE INDEX IF NOT EXISTS idx_videos_channel_date ON videos(channelId, publishedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_videos_views ON videos(viewCount DESC);
  `);
  
  // Add missing columns to existing tables (migration)
  try {
    db.exec(`ALTER TABLE videos ADD COLUMN audioPath TEXT;`);
  } catch (e) {
    // Column already exists, ignore
  }
  
  try {
    db.exec(`ALTER TABLE videos ADD COLUMN audioProcessedAt TEXT;`);
  } catch (e) {
    // Column already exists, ignore
  }
  
  try {
    db.exec(`ALTER TABLE videos ADD COLUMN transcriptionStatus TEXT DEFAULT 'pending';`);
  } catch (e) {
    // Column already exists, ignore
  }
}

export function upsertVideos(videos) {
  const db = getDatabase();
  const nowIso = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO videos (
      id, channelId, title, description, publishedAt, durationSeconds,
      viewCount, likeCount, commentCount, tags, thumbnails, raw, lastSyncedAt,
      platform, shortCode, displayUrl, localImageUrl, videoUrl, dimensions, mentions, takenAtTimestamp, transcription,
      audioPath, audioProcessedAt, transcriptionStatus
    ) VALUES (
      @id, @channelId, @title, @description, @publishedAt, @durationSeconds,
      @viewCount, @likeCount, @commentCount, @tags, @thumbnails, @raw, @lastSyncedAt,
      @platform, @shortCode, @displayUrl, @localImageUrl, @videoUrl, @dimensions, @mentions, @takenAtTimestamp, @transcription,
      @audioPath, @audioProcessedAt, @transcriptionStatus
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
      takenAtTimestamp=excluded.takenAtTimestamp,
      transcription=excluded.transcription,
      audioPath=excluded.audioPath,
      audioProcessedAt=excluded.audioProcessedAt,
      transcriptionStatus=excluded.transcriptionStatus
  `);

  const toRow = (v) => ({
    id: v.id,
    channelId: v.channelId,
    title: v.title,
    description: v.description || '',
    publishedAt: v.publishedAt ? new Date(v.publishedAt).toISOString() : new Date().toISOString(),
    durationSeconds: v.durationSeconds || null,
    viewCount: v.viewCount ?? null,
    likeCount: v.likeCount ?? null,
    commentCount: v.commentCount ?? null,
    tags: v.tags ? JSON.stringify(v.tags) : null,
    thumbnails: v.thumbnails ? JSON.stringify(v.thumbnails) : null,
    raw: v.raw ? JSON.stringify(v.raw) : null,
    lastSyncedAt: nowIso,
    platform: v.platform,
    shortCode: v.shortCode || null,
    displayUrl: v.displayUrl || null,
    localImageUrl: v.localImageUrl || null,
    videoUrl: v.videoUrl || null,
    dimensions: v.dimensions ? JSON.stringify(v.dimensions) : null,
    mentions: v.mentions ? JSON.stringify(v.mentions) : null,
    takenAtTimestamp: v.takenAtTimestamp || null,
    transcription: v.transcription || null,
    audioPath: v.audioPath || null,
    audioProcessedAt: v.audioProcessedAt || null,
    transcriptionStatus: v.transcriptionStatus || 'pending',
  });

  const tx = db.transaction((all) => {
    for (const item of all) {
      stmt.run(toRow(item));
    }
  });
  tx(videos);
}

export function queryVideos({ search, sort, order, page, pageSize }) {
  const db = getDatabase();
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
           platform, shortCode, displayUrl, localImageUrl, transcription,
           ${sortEngagementExpr} AS engagement
    FROM videos
    ${whereSql}
    ORDER BY ${sort === 'engagement' ? sortEngagementExpr : sortColumn} ${orderSql}
    LIMIT :limit OFFSET :offset
  `).all({ ...params, limit: pageSize, offset });

  return { total, rows };
}

export function queryVideosAdvanced({ sinceIso, channelId, sort, order, page, pageSize, likeWeight = 150, commentWeight = 500 }) {
  const db = getDatabase();
  const clauses = [];
  const params = {};
  if (sinceIso) { clauses.push('publishedAt >= :sinceIso'); params.sinceIso = sinceIso; }
  if (channelId) { clauses.push('channelId = :channelId'); params.channelId = channelId; }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderSql = order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const engagement = getEngagementSqlExpression(likeWeight, commentWeight);
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

export function getTopVideos({ channelId, sinceIso, likeWeight = 150, commentWeight = 500 }) {
  const db = getDatabase();
  const where = `WHERE channelId = :channelId AND publishedAt >= :sinceIso`;
  const engagement = getEngagementSqlExpression(likeWeight, commentWeight);
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

export function getTimeFilteredAvgViews({ channelId, sinceIso }) {
  const db = getDatabase();
  const clauses = ['channelId = :channelId'];
  const params = { channelId };
  
  if (sinceIso) {
    clauses.push('publishedAt >= :sinceIso');
    params.sinceIso = sinceIso;
  }
  
  const whereSql = clauses.join(' AND ');
  const result = db.prepare(`
    SELECT AVG(COALESCE(viewCount,0)) as avgViews
    FROM videos
    WHERE ${whereSql}
  `).get(params);
  return result?.avgViews || 0;
}

export function getSpecialVideos({ channelId, avgViews, sinceIso, viralMultiplier = 5 }) {
  const db = getDatabase();
  
  // Use time-filtered average views for consistency
  const effectiveAvgViews = sinceIso ? getTimeFilteredAvgViews({ channelId, sinceIso }) : avgViews;
  
  const rows = db.prepare(`
    SELECT id, title, viewCount, likeCount, commentCount, publishedAt, thumbnails,
           platform, shortCode, displayUrl, localImageUrl
    FROM videos
    WHERE channelId = :channelId AND publishedAt >= :sinceIso AND COALESCE(viewCount,0) >= :threshold
    ORDER BY COALESCE(viewCount,0) DESC
  `).all({ channelId, sinceIso, threshold: viralMultiplier * (effectiveAvgViews || 0) });
  return rows;
}

export function getViralVideoCount({ channelId, avgViews, viralMultiplier = 5, sinceIso }) {
  const db = getDatabase();
  
  // If sinceIso is provided, use time-filtered average views
  const effectiveAvgViews = sinceIso ? getTimeFilteredAvgViews({ channelId, sinceIso }) : avgViews;
  
  const clauses = ['channelId = :channelId', 'COALESCE(viewCount,0) >= :threshold'];
  const params = { channelId, threshold: viralMultiplier * (effectiveAvgViews || 0) };
  
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

export function getAllVideos() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM videos').all();
}

export function getNewVideosSince(sinceTimestamp) {
  const db = getDatabase();
  return db.prepare(`
    SELECT v.*, c.title as channelTitle, c.handle as channelHandle
    FROM videos v
    JOIN channels c ON v.channelId = c.id
    WHERE v.lastSyncedAt >= ?
    ORDER BY v.lastSyncedAt DESC, v.publishedAt DESC
  `).all(sinceTimestamp);
}

export function identifyViralVideos(videos, viralMultiplier = 5) {
  const db = getDatabase();
  
  if (!videos || videos.length === 0) return [];
  
  // Group videos by channel to calculate viral threshold per channel
  const channelGroups = {};
  videos.forEach(video => {
    if (!channelGroups[video.channelId]) {
      channelGroups[video.channelId] = [];
    }
    channelGroups[video.channelId].push(video);
  });
  
  const viralVideos = [];
  
  // Check each channel's videos for viral status
  Object.keys(channelGroups).forEach(channelId => {
    const channelVideos = channelGroups[channelId];
    
    // Get the channel's average views for viral calculation
    const avgViewsResult = db.prepare(`
      SELECT AVG(COALESCE(viewCount,0)) as avgViews
      FROM videos
      WHERE channelId = ? AND viewCount IS NOT NULL AND viewCount > 0
    `).get(channelId);
    
    const avgViews = avgViewsResult?.avgViews || 0;
    const viralThreshold = avgViews * viralMultiplier;
    
    // Find videos that exceed the viral threshold
    channelVideos.forEach(video => {
      const viewCount = video.viewCount || 0;
      if (viewCount >= viralThreshold && avgViews > 0) {
        viralVideos.push({
          ...video,
          viralThreshold,
          avgViews,
          viralMultiplier: (viewCount / avgViews).toFixed(1)
        });
      }
    });
  });
  
  // Sort by view count descending
  return viralVideos.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
}

export function videoExists(videoId) {
  const db = getDatabase();
  const result = db.prepare('SELECT id FROM videos WHERE id = ?').get(videoId);
  return !!result;
}

export function getExistingVideoIds(videoIds) {
  const db = getDatabase();
  if (!videoIds || videoIds.length === 0) return [];
  
  const placeholders = videoIds.map(() => '?').join(',');
  const results = db.prepare(`SELECT id FROM videos WHERE id IN (${placeholders})`).all(...videoIds);
  return results.map(row => row.id);
}

export function updateEngagementMetrics(videos) {
  const db = getDatabase();
  const nowIso = new Date().toISOString();
  
  const stmt = db.prepare(`
    UPDATE videos 
    SET viewCount = ?, 
        likeCount = ?, 
        commentCount = ?, 
        lastSyncedAt = ?
    WHERE id = ?
  `);

  const tx = db.transaction((all) => {
    for (const video of all) {
      stmt.run(
        video.viewCount ?? null,
        video.likeCount ?? null,
        video.commentCount ?? null,
        nowIso,
        video.id
      );
    }
  });
  
  tx(videos);
}

export function getVideosNeedingAudioProcessing() {
  const db = getDatabase();
  return db.prepare(`
    SELECT id, videoUrl, platform
    FROM videos 
    WHERE videoUrl IS NOT NULL 
      AND audioPath IS NULL 
      AND transcriptionStatus = 'pending'
    ORDER BY publishedAt DESC
  `).all();
}

export function getVideosNeedingTranscription() {
  const db = getDatabase();
  return db.prepare(`
    SELECT id, audioPath, title, description
    FROM videos 
    WHERE audioPath IS NOT NULL 
      AND transcription IS NULL 
      AND transcriptionStatus IN ('audio_ready', 'pending')
    ORDER BY audioProcessedAt DESC
  `).all();
}

export function updateAudioProcessingStatus(videoId, audioPath, status = 'audio_ready') {
  const db = getDatabase();
  const nowIso = new Date().toISOString();
  
  db.prepare(`
    UPDATE videos 
    SET audioPath = ?, 
        audioProcessedAt = ?, 
        transcriptionStatus = ?
    WHERE id = ?
  `).run(audioPath, nowIso, status, videoId);
}

export function updateTranscriptionStatus(videoId, transcription, status = 'completed') {
  const db = getDatabase();
  
  db.prepare(`
    UPDATE videos 
    SET transcription = ?, 
        transcriptionStatus = ?
    WHERE id = ?
  `).run(transcription, status, videoId);
}
