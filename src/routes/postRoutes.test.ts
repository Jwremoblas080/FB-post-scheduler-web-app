import request from 'supertest';
import express, { Express } from 'express';
import Database from 'better-sqlite3';
import postRoutes, { initializePostRoutes } from './postRoutes';

describe('Post Routes', () => {
  let app: Express;
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    
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

    // Create Posts table
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

    // Create index
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_time 
      ON posts(scheduled_time, status)
    `);

    // Create test user
    db.prepare(`
      INSERT INTO users (facebook_user_id, access_token, token_expiry, created_at)
      VALUES (?, ?, ?, ?)
    `).run('test_user_123', 'encrypted_token', Math.floor(Date.now() / 1000) + 3600, Math.floor(Date.now() / 1000));

    // Initialize routes with test database
    initializePostRoutes(db);

    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/posts', postRoutes);
  });

  afterEach(() => {
    db.close();
  });

  describe('POST /posts', () => {
    it('should create a new post with valid data', async () => {
      const futureTime = new Date(Date.now() + 3600000); // 1 hour from now
      const postData = {
        caption: 'Test post caption',
        mediaUrls: ['/uploads/image1.jpg'],
        mediaType: 'image',
        scheduledTime: futureTime.toISOString(),
        pageId: 'page_123',
        userId: 1
      };

      const response = await request(app)
        .post('/posts')
        .send(postData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.post).toBeDefined();
      expect(response.body.post.caption).toBe(postData.caption);
      expect(response.body.post.status).toBe('pending');
      expect(response.body.post.mediaUrls).toEqual(postData.mediaUrls);
    });

    it('should reject post with missing required fields', async () => {
      const postData = {
        caption: 'Test post',
        // Missing mediaUrls, mediaType, scheduledTime, pageId, userId
      };

      const response = await request(app)
        .post('/posts')
        .send(postData)
        .expect(400);

      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('Missing required fields');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject post with scheduled time in the past', async () => {
      const pastTime = new Date(Date.now() - 3600000); // 1 hour ago
      const postData = {
        caption: 'Test post',
        mediaUrls: ['/uploads/image1.jpg'],
        mediaType: 'image',
        scheduledTime: pastTime.toISOString(),
        pageId: 'page_123',
        userId: 1
      };

      const response = await request(app)
        .post('/posts')
        .send(postData)
        .expect(400);

      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('Scheduled time must be in the future');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject post with more than 10 images', async () => {
      const futureTime = new Date(Date.now() + 3600000);
      const postData = {
        caption: 'Test post',
        mediaUrls: Array(11).fill('/uploads/image.jpg'),
        mediaType: 'image',
        scheduledTime: futureTime.toISOString(),
        pageId: 'page_123',
        userId: 1
      };

      const response = await request(app)
        .post('/posts')
        .send(postData)
        .expect(400);

      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('Cannot upload more than 10 images');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject video post with multiple files', async () => {
      const futureTime = new Date(Date.now() + 3600000);
      const postData = {
        caption: 'Test post',
        mediaUrls: ['/uploads/video1.mp4', '/uploads/video2.mp4'],
        mediaType: 'video',
        scheduledTime: futureTime.toISOString(),
        pageId: 'page_123',
        userId: 1
      };

      const response = await request(app)
        .post('/posts')
        .send(postData)
        .expect(400);

      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('Cannot upload more than one video');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /posts', () => {
    beforeEach(() => {
      // Create test posts
      const futureTime1 = Math.floor((Date.now() + 3600000) / 1000);
      const futureTime2 = Math.floor((Date.now() + 7200000) / 1000);

      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Post 1', JSON.stringify(['/uploads/img1.jpg']), 'image', futureTime1, 'pending', 'page_123', Math.floor(Date.now() / 1000));

      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Post 2', JSON.stringify(['/uploads/img2.jpg']), 'image', futureTime2, 'pending', 'page_123', Math.floor(Date.now() / 1000));
    });

    it('should retrieve all posts for a user', async () => {
      const response = await request(app)
        .get('/posts')
        .query({ userId: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.posts).toBeDefined();
      expect(response.body.posts.length).toBe(2);
      expect(response.body.posts[0].caption).toBe('Post 1');
      expect(response.body.posts[1].caption).toBe('Post 2');
    });

    it('should return posts sorted by scheduled time ascending', async () => {
      const response = await request(app)
        .get('/posts')
        .query({ userId: 1 })
        .expect(200);

      expect(response.body.posts.length).toBe(2);
      const time1 = new Date(response.body.posts[0].scheduledTime).getTime();
      const time2 = new Date(response.body.posts[1].scheduledTime).getTime();
      expect(time1).toBeLessThan(time2);
    });

    it('should return empty array for user with no posts', async () => {
      const response = await request(app)
        .get('/posts')
        .query({ userId: 999 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.posts).toEqual([]);
    });

    it('should reject request without userId', async () => {
      const response = await request(app)
        .get('/posts')
        .expect(400);

      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('User ID is required');
      expect(response.body.code).toBe('MISSING_USER_ID');
    });

    it('should reject request with invalid userId format', async () => {
      const response = await request(app)
        .get('/posts')
        .query({ userId: 'invalid' })
        .expect(400);

      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('Invalid user ID format');
      expect(response.body.code).toBe('INVALID_USER_ID');
    });
  });

  describe('DELETE /posts/:id', () => {
    let pendingPostId: number;
    let postedPostId: number;

    beforeEach(() => {
      // Create a pending post
      const futureTime = Math.floor((Date.now() + 3600000) / 1000);
      const result1 = db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Pending post', JSON.stringify(['/uploads/img1.jpg']), 'image', futureTime, 'pending', 'page_123', Math.floor(Date.now() / 1000));
      pendingPostId = result1.lastInsertRowid as number;

      // Create a posted post
      const result2 = db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Posted post', JSON.stringify(['/uploads/img2.jpg']), 'image', futureTime, 'posted', 'page_123', Math.floor(Date.now() / 1000));
      postedPostId = result2.lastInsertRowid as number;
    });

    it('should delete a pending post', async () => {
      const response = await request(app)
        .delete(`/posts/${pendingPostId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Verify post is deleted
      const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(pendingPostId);
      expect(post).toBeUndefined();
    });

    it('should reject deletion of posted post', async () => {
      const response = await request(app)
        .delete(`/posts/${postedPostId}`)
        .expect(403);

      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('Cannot delete a post that has already been posted');
      expect(response.body.code).toBe('DELETE_FORBIDDEN');

      // Verify post still exists
      const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postedPostId);
      expect(post).toBeDefined();
    });

    it('should return 404 for non-existent post', async () => {
      const response = await request(app)
        .delete('/posts/99999')
        .expect(404);

      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('Post not found');
      expect(response.body.code).toBe('POST_NOT_FOUND');
    });

    it('should reject invalid post ID format', async () => {
      const response = await request(app)
        .delete('/posts/invalid')
        .expect(400);

      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('Invalid post ID format');
      expect(response.body.code).toBe('INVALID_POST_ID');
    });
  });
});
