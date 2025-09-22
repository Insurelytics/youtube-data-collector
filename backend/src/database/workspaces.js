import { getDatabase } from './connection.js';

export function initWorkspacesSchema() {
  const db = getDatabase('default'); // Always use default database for workspaces registry
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dbFile TEXT NOT NULL,
      driveFolderId TEXT,
      spreadsheetId TEXT,
      userId TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  // Ensure driveFolderId exists for older installs
  try {
    const cols = db.prepare("PRAGMA table_info('workspaces')").all();
    const hasDrive = cols.some(c => c.name === 'driveFolderId');
    if (!hasDrive) {
      db.exec("ALTER TABLE workspaces ADD COLUMN driveFolderId TEXT");
    }
    const hasSheet = cols.some(c => c.name === 'spreadsheetId');
    if (!hasSheet) {
      db.exec("ALTER TABLE workspaces ADD COLUMN spreadsheetId TEXT");
    }
  } catch {}
}

export function listWorkspaces() {
  const db = getDatabase('default'); // Always use default database for workspaces registry
  return db.prepare('SELECT id, name, dbFile, driveFolderId, spreadsheetId, userId, created_at FROM workspaces ORDER BY created_at DESC').all();
}

export function getWorkspace(id) {
  const db = getDatabase('default'); // Always use default database for workspaces registry
  return db.prepare('SELECT id, name, dbFile, driveFolderId, spreadsheetId, userId, created_at FROM workspaces WHERE id = ?').get(id);
}

export function createWorkspace({ id, name, dbFile, driveFolderId = null, spreadsheetId = null, userId = null }) {
  const db = getDatabase('default'); // Always use default database for workspaces registry
  const stmt = db.prepare('INSERT INTO workspaces (id, name, dbFile, driveFolderId, spreadsheetId, userId, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const now = new Date().toISOString();
  stmt.run(id, name, dbFile, driveFolderId, spreadsheetId, userId, now);
}

export function getWorkspaceByName(name) {
  const db = getDatabase('default');
  return db.prepare('SELECT id, name FROM workspaces WHERE LOWER(name) = LOWER(?)').get(name);
}

export function removeWorkspace(id) {
  const db = getDatabase('default'); // Always use default database for workspaces registry
  return db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
}

export function updateWorkspaceDriveFolderId(id, driveFolderId) {
  const db = getDatabase('default');
  const stmt = db.prepare('UPDATE workspaces SET driveFolderId = ? WHERE id = ?');
  return stmt.run(driveFolderId, id);
}

export function updateWorkspaceSpreadsheetId(id, spreadsheetId) {
  const db = getDatabase('default');
  const stmt = db.prepare('UPDATE workspaces SET spreadsheetId = ? WHERE id = ?');
  return stmt.run(spreadsheetId, id);
}


