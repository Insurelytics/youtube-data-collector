import { getDatabase } from './connection.js';
import { getEngagementSqlExpression } from '../utils/engagement-utils.js';

export function initTopicsSchema() {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS video_topics (
      video_id TEXT NOT NULL,
      topic_id INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'author',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (video_id, topic_id, source),
      FOREIGN KEY (video_id) REFERENCES videos(id),
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    );

    CREATE INDEX IF NOT EXISTS idx_topics_name ON topics(name);
    CREATE INDEX IF NOT EXISTS idx_video_topics_video ON video_topics(video_id);
    CREATE INDEX IF NOT EXISTS idx_video_topics_topic ON video_topics(topic_id);
    CREATE INDEX IF NOT EXISTS idx_video_topics_source ON video_topics(source);
  `);
}

// Helper function to extract hashtags from text
function extractHashtags(text) {
  if (!text) return [];
  const hashtags = text.match(/#[a-zA-Z0-9_]+/g) || [];
  return hashtags.map(tag => tag.toLowerCase().slice(1)); // Remove # and lowercase
}

// Function to upsert topic and return topic ID
export function upsertTopic(topicName) {
  const db = getDatabase();
  const normalizedName = topicName.toLowerCase().trim();
  if (!normalizedName) return null;
  
  // Try to find existing topic
  let topic = db.prepare('SELECT id FROM topics WHERE name = ?').get(normalizedName);
  
  if (!topic) {
    // Create new topic
    const stmt = db.prepare('INSERT INTO topics (name, created_at) VALUES (?, ?)');
    const result = stmt.run(normalizedName, new Date().toISOString());
    return result.lastInsertRowid;
  }
  
  return topic.id;
}

// Function to associate video with topics
export function associateVideoWithTopics(videoId, topicNames, source = 'author') {
  const db = getDatabase();
  if (!topicNames || topicNames.length === 0) return;
  
  // Clear existing associations for this source
  db.prepare('DELETE FROM video_topics WHERE video_id = ? AND source = ?').run(videoId, source);
  
  // Add new associations
  const insertStmt = db.prepare('INSERT OR IGNORE INTO video_topics (video_id, topic_id, source, created_at) VALUES (?, ?, ?, ?)');
  const nowIso = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const topicName of topicNames) {
      const topicId = upsertTopic(topicName);
      if (topicId) {
        insertStmt.run(videoId, topicId, source, nowIso);
      }
    }
  });
  tx();
}

// Function to extract and associate hashtags from video description
export function extractAndAssociateHashtags(videoId, description) {
  const hashtags = extractHashtags(description);
  if (hashtags.length > 0) {
    associateVideoWithTopics(videoId, hashtags, 'author');
  }
}

// Function to associate AI-generated topics with a video
export function associateAITopicsWithVideo(videoId, topicNames) {
  return associateVideoWithTopics(videoId, topicNames, 'ai');
}

// Function to get topics for a video by source
export function getVideoTopics(videoId, source = null) {
  const db = getDatabase();
  let query = `
    SELECT t.name, vt.source, vt.created_at
    FROM topics t
    INNER JOIN video_topics vt ON t.id = vt.topic_id
    WHERE vt.video_id = ?
  `;
  const params = [videoId];
  
  if (source) {
    query += ' AND vt.source = ?';
    params.push(source);
  }
  
  query += ' ORDER BY vt.created_at ASC';
  
  return db.prepare(query).all(...params);
}

// Function to check if video has AI-generated topics
export function hasAITopics(videoId) {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT COUNT(*) as count
    FROM video_topics
    WHERE video_id = ? AND source = 'ai'
  `).get(videoId);
  
  return result.count > 0;
}

// Function to remove AI topics for a video (useful for regenerating)
export function removeAITopics(videoId) {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM video_topics WHERE video_id = ? AND source = \'ai\'').run(videoId);
  return result.changes;
}

// Function to get topic statistics
export function getTopicStats(source = null) {
  const db = getDatabase();
  let query = `
    SELECT 
      t.id,
      t.name,
      t.created_at,
      COUNT(vt.video_id) as video_count
    FROM topics t
    LEFT JOIN video_topics vt ON t.id = vt.topic_id
  `;
  const params = [];
  
  if (source) {
    query += ' AND vt.source = ?';
    params.push(source);
  }
  
  query += `
    GROUP BY t.id, t.name, t.created_at
    ORDER BY video_count DESC, t.name ASC
  `;
  
  const stats = db.prepare(query).all(...params);
  
  const totalTopics = stats.length;
  const totalAssociations = stats.reduce((sum, topic) => sum + topic.video_count, 0);
  
  return {
    totalTopics,
    totalAssociations,
    topics: stats
  };
}

export function getVideosByTopic(topicName, { page = 1, pageSize = 50, source = null } = {}) {
  const db = getDatabase();
  const normalizedName = topicName.toLowerCase().trim();
  
  let totalQuery = `
    SELECT COUNT(*) as count
    FROM videos v
    INNER JOIN video_topics vt ON v.id = vt.video_id
    INNER JOIN topics t ON vt.topic_id = t.id
    WHERE t.name = ?
  `;
  const params = [normalizedName];
  
  if (source) {
    totalQuery += ' AND vt.source = ?';
    params.push(source);
  }
  
  const total = db.prepare(totalQuery).get(...params)?.count || 0;
  
  const offset = (page - 1) * pageSize;
  const engagementExpr = getEngagementSqlExpression();
  let videosQuery = `
    SELECT v.*, t.name as topic_name, vt.source as topic_source, c.title as channelTitle, c.handle as channelHandle, v.channelId,
           ${engagementExpr} as engagement
    FROM videos v
    INNER JOIN video_topics vt ON v.id = vt.video_id
    INNER JOIN topics t ON vt.topic_id = t.id
    LEFT JOIN channels c ON v.channelId = c.id
    WHERE t.name = ?
  `;
  const videoParams = [normalizedName];
  
  if (source) {
    videosQuery += ' AND vt.source = ?';
    videoParams.push(source);
  }
  
  videosQuery += ` ORDER BY ${engagementExpr} DESC LIMIT ? OFFSET ?`;
  videoParams.push(pageSize, offset);
  
  const videos = db.prepare(videosQuery).all(...videoParams);
  
  return {
    total,
    page,
    pageSize,
    videos
  };
}

// Function to get videos that need AI topic generation (no AI topics yet)
export function getVideosNeedingAITopics({ page = 1, pageSize = 50 } = {}) {
  const db = getDatabase();
  const totalQuery = `
    SELECT COUNT(*) as count
    FROM videos v
    LEFT JOIN video_topics vt ON v.id = vt.video_id AND vt.source = 'ai'
    WHERE vt.video_id IS NULL
  `;
  
  const total = db.prepare(totalQuery).get()?.count || 0;
  
  const offset = (page - 1) * pageSize;
  const videosQuery = `
    SELECT v.*
    FROM videos v
    LEFT JOIN video_topics vt ON v.id = vt.video_id AND vt.source = 'ai'
    WHERE vt.video_id IS NULL
    ORDER BY v.publishedAt DESC
    LIMIT ? OFFSET ?
  `;
  
  const videos = db.prepare(videosQuery).all(pageSize, offset);
  
  return {
    total,
    page,
    pageSize,
    videos
  };
}

// Function to get a combined view of topics for a video
export function getVideoTopicsSummary(videoId) {
  const authorTopics = getVideoTopics(videoId, 'author');
  const aiTopics = getVideoTopics(videoId, 'ai');
  
  return {
    author: authorTopics.map(t => t.name),
    ai: aiTopics.map(t => t.name),
    all: [...authorTopics, ...aiTopics]
  };
}

export function getAllTopics() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM topics').all();
}

export function getAllVideoTopics() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM video_topics').all();
}

export function getTopicIdByName(topicName) {
  const db = getDatabase();
  const normalizedName = topicName.toLowerCase().trim();
  const topic = db.prepare('SELECT id FROM topics WHERE name = ?').get(normalizedName);
  return topic ? topic.id : null;
}
