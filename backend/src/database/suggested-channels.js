import { getDatabase } from './connection.js';

export function initSuggestedChannelsSchema() {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS suggested_channels (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      fullName TEXT,
      followersCount INTEGER,
      followsCount INTEGER,
      postsCount INTEGER,
      verified INTEGER DEFAULT 0,
      isPrivate INTEGER DEFAULT 0,
      biography TEXT,
      externalUrl TEXT,
      profilePicUrl TEXT,
      localProfilePicPath TEXT,
      searchTerm TEXT NOT NULL,
      foundAt TEXT DEFAULT CURRENT_TIMESTAMP,
      platform TEXT DEFAULT 'instagram',
      topicId INTEGER,
      FOREIGN KEY (topicId) REFERENCES topics(id)
    );
  `);
}

export function upsertSuggestedChannel(channel) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO suggested_channels (
      id, username, fullName, followersCount, followsCount, postsCount, 
      verified, isPrivate, biography, externalUrl, profilePicUrl, 
      localProfilePicPath, searchTerm, platform, topicId
    )
    VALUES (
      @id, @username, @fullName, @followersCount, @followsCount, @postsCount,
      @verified, @isPrivate, @biography, @externalUrl, @profilePicUrl,
      @localProfilePicPath, @searchTerm, @platform, @topicId
    )
    ON CONFLICT(id) DO UPDATE SET
      username=excluded.username,
      fullName=excluded.fullName,
      followersCount=COALESCE(excluded.followersCount, suggested_channels.followersCount),
      followsCount=COALESCE(excluded.followsCount, suggested_channels.followsCount),
      postsCount=COALESCE(excluded.postsCount, suggested_channels.postsCount),
      verified=COALESCE(excluded.verified, suggested_channels.verified),
      isPrivate=COALESCE(excluded.isPrivate, suggested_channels.isPrivate),
      biography=COALESCE(excluded.biography, suggested_channels.biography),
      externalUrl=COALESCE(excluded.externalUrl, suggested_channels.externalUrl),
      profilePicUrl=COALESCE(excluded.profilePicUrl, suggested_channels.profilePicUrl),
      localProfilePicPath=COALESCE(excluded.localProfilePicPath, suggested_channels.localProfilePicPath),
      searchTerm=excluded.searchTerm,
      platform=COALESCE(excluded.platform, suggested_channels.platform),
      topicId=COALESCE(excluded.topicId, suggested_channels.topicId)
  `);
  
  const withDefaults = { 
    followersCount: null,
    followsCount: null,
    postsCount: null,
    verified: 0,
    isPrivate: 0,
    biography: null,
    externalUrl: null,
    profilePicUrl: null,
    localProfilePicPath: null,
    platform: 'instagram',
    topicId: null,
    ...channel 
  };
  stmt.run(withDefaults);
}

export function listSuggestedChannels() {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM suggested_channels 
    ORDER BY foundAt DESC
  `).all();
  return rows;
}

export function getSuggestedChannelsBySearchTerm(searchTerm) {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM suggested_channels 
    WHERE searchTerm = ?
    ORDER BY followersCount DESC
  `).all(searchTerm);
  return rows;
}

export function removeSuggestedChannel(id) {
  const db = getDatabase();
  db.prepare('DELETE FROM suggested_channels WHERE id = ?').run(id);
}

export function isChannelAlreadyTracked(username) {
  const db = getDatabase();
  // Check if channel exists in main channels table (could be Instagram or YouTube)
  const existsInChannels = db.prepare(`
    SELECT 1 FROM channels 
    WHERE handle = ? OR id = ? OR id = ?
  `).get(username, `ig_${username}`, username);
  
  // Check if already exists in suggested channels
  const existsInSuggested = db.prepare(`
    SELECT 1 FROM suggested_channels 
    WHERE username = ? OR id = ?
  `).get(username, `ig_${username}`);
  
  return !!(existsInChannels || existsInSuggested);
}

export function getSearchedTopicIds() {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT DISTINCT topicId FROM suggested_channels 
    WHERE topicId IS NOT NULL
  `).all();
  return rows.map(row => row.topicId);
}

