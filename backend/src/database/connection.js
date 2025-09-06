import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../..', 'data.sqlite');

let db;

export function getDatabase() {
  if (db) return db;
  
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  
  return db;
}

export function ensureDatabase() {
  return getDatabase();
}
