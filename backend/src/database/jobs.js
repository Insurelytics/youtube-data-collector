import { getDatabase } from './connection.js';

export function initJobsSchema() {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handle TEXT NOT NULL,
      platform TEXT NOT NULL,
    workspace_id TEXT NOT NULL DEFAULT 'default',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      error_message TEXT,
      since_days INTEGER,
      is_initial_scrape INTEGER DEFAULT 0,
      channel_id TEXT,
      channel_title TEXT,
      videos_found INTEGER DEFAULT 0,
      videos_processed INTEGER DEFAULT 0,
      new_videos INTEGER DEFAULT 0,
      updated_videos INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_sync_jobs_created ON sync_jobs(created_at DESC);
  `);

  // Ensure new columns exist for older databases
  try {
    const columns = db.prepare(`PRAGMA table_info(sync_jobs)`).all();
    const hasInitialFlag = columns.some(col => col.name === 'is_initial_scrape');
    if (!hasInitialFlag) {
      db.exec(`ALTER TABLE sync_jobs ADD COLUMN is_initial_scrape INTEGER DEFAULT 0`);
    }
    const hasWorkspaceId = columns.some(col => col.name === 'workspace_id');
    if (!hasWorkspaceId) {
      db.exec(`ALTER TABLE sync_jobs ADD COLUMN workspace_id TEXT DEFAULT 'default'`);
    }
  } catch {}
}

export function createSyncJob({ handle, platform, sinceDays = null, isInitialScrape = 0, workspaceId = 'default' }) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO sync_jobs (handle, platform, workspace_id, status, created_at, since_days, is_initial_scrape)
    VALUES (?, ?, ?, 'pending', ?, ?, ?)
  `);
  const result = stmt.run(handle, platform, workspaceId, new Date().toISOString(), sinceDays, isInitialScrape ? 1 : 0);
  return result.lastInsertRowid;
}

export function updateSyncJob(jobId, updates) {
  const db = getDatabase();
  const allowedFields = ['status', 'started_at', 'completed_at', 'error_message', 'channel_id', 'channel_title', 'videos_found', 'videos_processed', 'new_videos', 'updated_videos', 'is_initial_scrape'];
  const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
  if (fields.length === 0) return;
  
  const setClause = fields.map(field => `${field} = ?`).join(', ');
  const values = fields.map(field => updates[field]);
  
  const stmt = db.prepare(`UPDATE sync_jobs SET ${setClause} WHERE id = ?`);
  stmt.run(...values, jobId);
}

export function getNextPendingJob() {
  const db = getDatabase();
  return db.prepare(`
    SELECT id, handle, platform, status, created_at, since_days, is_initial_scrape, channel_id, channel_title,
           videos_found, videos_processed, new_videos, updated_videos
    FROM sync_jobs
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
  `).get();
}

export function getJobStatus(jobId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT id, handle, platform, status, created_at, started_at, completed_at, error_message, since_days,
           is_initial_scrape, channel_id, channel_title, videos_found, videos_processed, new_videos, updated_videos
    FROM sync_jobs
    WHERE id = ?
  `).get(jobId);
}

export function listJobs({ limit = 50, offset = 0 } = {}) {
  const db = getDatabase();
  const total = db.prepare('SELECT COUNT(*) as count FROM sync_jobs').get().count;
  const jobs = db.prepare(`
    SELECT id, handle, platform, status, created_at, started_at, completed_at, error_message, since_days,
           is_initial_scrape, channel_id, channel_title, videos_found, videos_processed, new_videos, updated_videos
    FROM sync_jobs
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  
  return { total, jobs };
}

export function cleanupOrphanedRunningJobs() {
  const db = getDatabase();
  const result = db.prepare(`
    UPDATE sync_jobs 
    SET status = 'failed', 
        completed_at = ?, 
        error_message = 'Job was interrupted by server restart'
    WHERE status = 'running' OR status = 'pending'
  `).run(new Date().toISOString());
  
  if (result.changes > 0) {
    console.log(`Cleaned up ${result.changes} orphaned running jobs from previous server session`);
  }
  
  return result.changes;
}
