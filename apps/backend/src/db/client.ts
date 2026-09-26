import Database from 'better-sqlite3';
import { createSchema } from './schema.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) throw new Error('DB not initialized — call initDb() first');
  return db;
}

export function initDb(path: string = process.env.DATABASE_PATH ?? './data.db'): void {
  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createSchema(db);
}

export function closeDb(): void {
  db?.close();
  db = null;
}
