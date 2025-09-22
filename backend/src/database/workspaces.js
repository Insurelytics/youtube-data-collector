import { getDatabase } from './connection.js';

export function initWorkspacesSchema() {
  const db = getDatabase('default'); // Always use default database for workspaces registry
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dbFile TEXT NOT NULL,
      userId TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function listWorkspaces() {
  const db = getDatabase('default'); // Always use default database for workspaces registry
  return db.prepare('SELECT id, name, dbFile, userId, created_at FROM workspaces ORDER BY created_at DESC').all();
}

export function getWorkspace(id) {
  const db = getDatabase('default'); // Always use default database for workspaces registry
  return db.prepare('SELECT id, name, dbFile, userId, created_at FROM workspaces WHERE id = ?').get(id);
}

export function createWorkspace({ id, name, dbFile, userId = null }) {
  const db = getDatabase('default'); // Always use default database for workspaces registry
  const stmt = db.prepare('INSERT INTO workspaces (id, name, dbFile, userId, created_at) VALUES (?, ?, ?, ?, ?)');
  const now = new Date().toISOString();
  stmt.run(id, name, dbFile, userId, now);
}

export function removeWorkspace(id) {
  const db = getDatabase('default'); // Always use default database for workspaces registry
  return db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
}


