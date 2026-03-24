import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Initialize the SQLite database with required schema
 * Creates Users and Posts tables with proper constraints and indexes
 */
export function initializeDatabase(dbPath: string = './data/scheduler.db'): Database.Database {
  // Ensure the directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Open database connection
  const db = new Database(dbPath);
  
  // Enable foreign key constraints
  db.pragma('foreign_keys = ON');

  // Create Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facebook_user_id TEXT UNIQUE NOT NULL,
      access_token TEXT NOT NULL,
      token_expiry INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Create Posts table with foreign key constraint
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      caption TEXT NOT NULL,
      media_url TEXT NOT NULL,
      media_type TEXT NOT NULL CHECK(media_type IN ('image', 'video')),
      scheduled_time INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'posted', 'failed')),
      page_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      error_message TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create index on scheduled_time and status for efficient querying
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scheduled_time 
    ON posts(scheduled_time, status)
  `);

  // Migration: add pages table if it doesn't exist (for existing DBs)
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      page_id TEXT NOT NULL,
      page_name TEXT NOT NULL,
      page_access_token TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, page_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  return db;
}

/**
 * Get a database connection
 * If the database doesn't exist, it will be initialized
 */
export function getDatabase(dbPath: string = './data/scheduler.db'): Database.Database {
  return initializeDatabase(dbPath);
}
