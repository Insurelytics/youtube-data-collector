import { getDatabase } from './connection.js';

export function initSettingsSchema() {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

export function getSetting(key) {
  const db = getDatabase();
  const result = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return result ? result.value : null;
}

export function setSetting(key, value) {
  const db = getDatabase();
  const nowIso = new Date().toISOString();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, value, nowIso);
}

export function getSettings() {
  const db = getDatabase();
  const results = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  results.forEach(row => {
    settings[row.key] = row.value;
  });
  return settings;
}
