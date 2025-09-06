import { getDatabase } from './connection.js';

export function initChannelsSchema() {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      handle TEXT,
      subscriberCount INTEGER,
      isActive INTEGER DEFAULT 1,
      thumbnailUrl TEXT,
      platform TEXT,
      biography TEXT,
      postsCount INTEGER,
      followsCount INTEGER,
      verified INTEGER DEFAULT 0,
      businessCategoryName TEXT,
      externalUrls TEXT,
      initial_scrape_running INTEGER DEFAULT 0
    );
  `);
}

export function upsertChannel(channel) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO channels (id, title, handle, subscriberCount, isActive, thumbnailUrl, platform, biography, postsCount, followsCount, verified, businessCategoryName, externalUrls, initial_scrape_running)
    VALUES (@id, @title, @handle, @subscriberCount, COALESCE(@isActive, 1), @thumbnailUrl, @platform, @biography, @postsCount, @followsCount, COALESCE(@verified, 0), @businessCategoryName, @externalUrls, COALESCE(@initial_scrape_running, 0))
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      handle=excluded.handle,
      subscriberCount=COALESCE(excluded.subscriberCount, channels.subscriberCount),
      isActive=COALESCE(excluded.isActive, channels.isActive),
      thumbnailUrl=COALESCE(excluded.thumbnailUrl, channels.thumbnailUrl),
      platform=COALESCE(excluded.platform, channels.platform),
      biography=COALESCE(excluded.biography, channels.biography),
      postsCount=COALESCE(excluded.postsCount, channels.postsCount),
      followsCount=COALESCE(excluded.followsCount, channels.followsCount),
      verified=COALESCE(excluded.verified, channels.verified),
      businessCategoryName=COALESCE(excluded.businessCategoryName, channels.businessCategoryName),
      externalUrls=COALESCE(excluded.externalUrls, channels.externalUrls),
      initial_scrape_running=COALESCE(excluded.initial_scrape_running, channels.initial_scrape_running)
  `);
  
  const withDefaults = { 
    subscriberCount: null, 
    isActive: 1, 
    thumbnailUrl: null, 
    biography: null,
    postsCount: null,
    followsCount: null,
    verified: 0,
    businessCategoryName: null,
    externalUrls: null,
    initial_scrape_running: 0,
    ...channel 
  };
  stmt.run(withDefaults);
}

export function listChannels() {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT c.id, c.title, c.handle, COALESCE(c.subscriberCount, 0) AS subscriberCount,
           COALESCE(c.isActive, 1) AS isActive,
           c.thumbnailUrl AS thumbnailUrl,
           c.platform,
           c.biography, c.postsCount, c.followsCount, 
           COALESCE(c.verified, 0) AS verified,
           c.businessCategoryName, c.externalUrls,
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
  const db = getDatabase();
  db.prepare('UPDATE channels SET isActive = 0 WHERE id = ?').run(id);
}

export function getChannel(id) {
  const db = getDatabase();
  return db.prepare(`
    SELECT c.id, c.title, c.handle,
           COALESCE(c.subscriberCount,0) AS subscriberCount,
           COALESCE(c.isActive,1) AS isActive,
           c.thumbnailUrl AS thumbnailUrl,
           c.platform,
           c.biography, c.postsCount, c.followsCount, 
           COALESCE(c.verified, 0) AS verified,
           c.businessCategoryName, c.externalUrls,
           (SELECT MAX(lastSyncedAt) FROM videos v WHERE v.channelId = c.id) AS lastSyncedAt,
           COALESCE((SELECT COUNT(1) FROM videos v WHERE v.channelId = c.id), 0) AS videoCount,
           COALESCE((SELECT SUM(COALESCE(viewCount,0)) FROM videos v WHERE v.channelId = c.id), 0) AS totalViews
    FROM channels c
    WHERE c.id = ?
  `).get(id);
}

export function getChannelTrends({ channelId, sinceIso }) {
  const db = getDatabase();
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

export function getLastPublishedDate(channelId) {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT MAX(publishedAt) as lastPublishedAt
    FROM videos
    WHERE channelId = ?
  `).get(channelId);
  return result?.lastPublishedAt || null;
}
