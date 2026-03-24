import { initializeDatabase } from './init';
import fs from 'fs';
import path from 'path';

describe('Database Initialization', () => {
  const testDbPath = './test-data/test.db';
  
  beforeEach(() => {
    // Clean up test database before each test
    const testDir = path.dirname(testDbPath);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test database after each test
    const testDir = path.dirname(testDbPath);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  test('should create database file and directory', () => {
    const db = initializeDatabase(testDbPath);
    expect(fs.existsSync(testDbPath)).toBe(true);
    db.close();
  });

  test('should create users table with correct schema', () => {
    const db = initializeDatabase(testDbPath);
    
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const columnNames = tableInfo.map((col: any) => col.name);
    
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('facebook_user_id');
    expect(columnNames).toContain('access_token');
    expect(columnNames).toContain('token_expiry');
    expect(columnNames).toContain('created_at');
    
    db.close();
  });

  test('should create posts table with correct schema', () => {
    const db = initializeDatabase(testDbPath);
    
    const tableInfo = db.prepare("PRAGMA table_info(posts)").all();
    const columnNames = tableInfo.map((col: any) => col.name);
    
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('user_id');
    expect(columnNames).toContain('caption');
    expect(columnNames).toContain('media_url');
    expect(columnNames).toContain('media_type');
    expect(columnNames).toContain('scheduled_time');
    expect(columnNames).toContain('status');
    expect(columnNames).toContain('page_id');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('error_message');
    
    db.close();
  });

  test('should create index on scheduled_time and status', () => {
    const db = initializeDatabase(testDbPath);
    
    const indexes = db.prepare("PRAGMA index_list(posts)").all();
    const indexNames = indexes.map((idx: any) => idx.name);
    
    expect(indexNames).toContain('idx_scheduled_time');
    
    db.close();
  });

  test('should enforce foreign key constraint', () => {
    const db = initializeDatabase(testDbPath);
    
    // Try to insert a post with non-existent user_id
    const insertPost = db.prepare(`
      INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    expect(() => {
      insertPost.run(999, 'Test caption', '["test.jpg"]', 'image', Date.now(), 'pending', 'page123', Date.now());
    }).toThrow();
    
    db.close();
  });

  test('should enforce media_type check constraint', () => {
    const db = initializeDatabase(testDbPath);
    
    // First create a user
    const insertUser = db.prepare(`
      INSERT INTO users (facebook_user_id, access_token, token_expiry, created_at)
      VALUES (?, ?, ?, ?)
    `);
    const userResult = insertUser.run('user123', 'token', Date.now() + 3600000, Date.now());
    
    // Try to insert a post with invalid media_type
    const insertPost = db.prepare(`
      INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    expect(() => {
      insertPost.run(userResult.lastInsertRowid, 'Test', '["test.jpg"]', 'invalid', Date.now(), 'pending', 'page123', Date.now());
    }).toThrow();
    
    db.close();
  });

  test('should enforce status check constraint', () => {
    const db = initializeDatabase(testDbPath);
    
    // First create a user
    const insertUser = db.prepare(`
      INSERT INTO users (facebook_user_id, access_token, token_expiry, created_at)
      VALUES (?, ?, ?, ?)
    `);
    const userResult = insertUser.run('user123', 'token', Date.now() + 3600000, Date.now());
    
    // Try to insert a post with invalid status
    const insertPost = db.prepare(`
      INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    expect(() => {
      insertPost.run(userResult.lastInsertRowid, 'Test', '["test.jpg"]', 'image', Date.now(), 'invalid', 'page123', Date.now());
    }).toThrow();
    
    db.close();
  });

  test('should allow valid post insertion', () => {
    const db = initializeDatabase(testDbPath);
    
    // Create a user
    const insertUser = db.prepare(`
      INSERT INTO users (facebook_user_id, access_token, token_expiry, created_at)
      VALUES (?, ?, ?, ?)
    `);
    const userResult = insertUser.run('user123', 'token', Date.now() + 3600000, Date.now());
    
    // Insert a valid post
    const insertPost = db.prepare(`
      INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const postResult = insertPost.run(
      userResult.lastInsertRowid,
      'Test caption',
      '["test.jpg"]',
      'image',
      Date.now() + 3600000,
      'pending',
      'page123',
      Date.now()
    );
    
    expect(postResult.changes).toBe(1);
    
    db.close();
  });

  test('should cascade delete posts when user is deleted', () => {
    const db = initializeDatabase(testDbPath);
    
    // Create a user
    const insertUser = db.prepare(`
      INSERT INTO users (facebook_user_id, access_token, token_expiry, created_at)
      VALUES (?, ?, ?, ?)
    `);
    const userResult = insertUser.run('user123', 'token', Date.now() + 3600000, Date.now());
    const userId = userResult.lastInsertRowid;
    
    // Insert a post
    const insertPost = db.prepare(`
      INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertPost.run(userId, 'Test', '["test.jpg"]', 'image', Date.now(), 'pending', 'page123', Date.now());
    
    // Verify post exists
    const countBefore = db.prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ?').get(userId) as { count: number };
    expect(countBefore.count).toBe(1);
    
    // Delete user
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    
    // Verify post was cascade deleted
    const countAfter = db.prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ?').get(userId) as { count: number };
    expect(countAfter.count).toBe(0);
    
    db.close();
  });

  test('should enforce unique facebook_user_id constraint', () => {
    const db = initializeDatabase(testDbPath);
    
    const insertUser = db.prepare(`
      INSERT INTO users (facebook_user_id, access_token, token_expiry, created_at)
      VALUES (?, ?, ?, ?)
    `);
    
    // Insert first user
    insertUser.run('user123', 'token1', Date.now() + 3600000, Date.now());
    
    // Try to insert duplicate facebook_user_id
    expect(() => {
      insertUser.run('user123', 'token2', Date.now() + 3600000, Date.now());
    }).toThrow();
    
    db.close();
  });
});
