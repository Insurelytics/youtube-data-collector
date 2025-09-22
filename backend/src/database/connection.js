import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../..', 'data');

// Map of workspaceId -> Database instance
const dbMap = new Map();

// Module-scoped current request workspace id (set by middleware)
let currentRequestWorkspaceId = 'default';

function workspaceDbPath(workspaceId) {
  return path.join(DATA_DIR, `${workspaceId}.sqlite`);
}

function openDatabaseForWorkspace(workspaceId) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const dbPath = workspaceDbPath(workspaceId);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

export function getDatabase(workspaceId) {
  const id = workspaceId || currentRequestWorkspaceId || 'default';
  if (dbMap.has(id)) return dbMap.get(id);
  const db = openDatabaseForWorkspace(id);
  dbMap.set(id, db);
  return db;
}

export function ensureDatabase() {
  return getDatabase('default');
}

export function setRequestWorkspace(workspaceId) {
  currentRequestWorkspaceId = workspaceId || 'default';
}

export function initializeWorkspaceDatabase(workspaceId) {
  const db = openDatabaseForWorkspace(workspaceId);
  dbMap.set(workspaceId, db);
  return db;
}
