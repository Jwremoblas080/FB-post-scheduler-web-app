import Database from 'better-sqlite3';
import { SchedulerService } from './schedulerService';
import { GraphApiClient } from './graphApiClient';
import { PostManagementService } from './postService';
import { encrypt } from '../utils/encryption';

describe('SchedulerService - Rate Limiting (Requirements 8.1-8.4)', () => {
  let db: Database.Database;
  let schedulerService: SchedulerService;
  let graphApiClient: GraphApiClient;
  let postService: PostManagementService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        facebook_user_id TEXT UNIQUE NOT NULL,
        access_token TEXT NOT NULL,
        token_expiry INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE posts (
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
      );
      CREATE INDEX idx_scheduled_time ON posts(scheduled_time, status);
    `);

    const encryptedToken = encrypt('test_access_token_123');
    db.prepare(`INSERT INTO users (facebook_user_id, access_token, token_expiry, created_at) VALUES (?, ?, ?, ?)`)
      .run('test_user', encryptedToken, Math.floor(Date.now() / 1000) + 3600, Math.floor(Date.now() / 1000));

    graphApiClient = new GraphApiClient();
    postService = new PostManagementService(db);
    schedulerService = new SchedulerService(db, graphApiClient, postService);
  });

  afterEach(() => {
    schedulerService.stop();
    db.close();
  });

  describe('Exponential backoff - Requirement 8.2', () => {
    it('should return increasing delays for successive attempts', () => {
      expect(schedulerService.getBackoffDelay(0)).toBe(1000);
      expect(schedulerService.getBackoffDelay(1)).toBe(2000);
      expect(schedulerService.getBackoffDelay(2)).toBe(4000);
      expect(schedulerService.getBackoffDelay(3)).toBe(8000);
    });
  });

  describe('API request rate tracking - Requirement 8.3', () => {
    it('should count zero requests initially', () => {
      expect(schedulerService.getRequestCountLastHour(1)).toBe(0);
    });

    it('should not exceed 200 requests per hour per user', async () => {
      jest.spyOn(graphApiClient, 'getPages').mockResolvedValue([
        { id: 'page123', name: 'Test Page', accessToken: 'page_token' }
      ]);
      jest.spyOn(graphApiClient, 'publishPhoto').mockResolvedValue({ success: true, postId: 'fb_123' });

      const pastTime = Math.floor((Date.now() - 3600000) / 1000);

      // Simulate 200 requests already made
      for (let i = 0; i < 200; i++) {
        (schedulerService as any).recordApiRequest(1);
      }

      // Insert a pending post
      db.prepare(`INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(1, 'Rate limit test', JSON.stringify(['/uploads/img.jpg']), 'image', pastTime, 'pending', 'page123', Math.floor(Date.now() / 1000));

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      await schedulerService.checkAndPublishPosts();

      // Post should NOT have been published (rate limited)
      const post = db.prepare('SELECT status FROM posts WHERE id = 1').get() as { status: string };
      expect(post.status).toBe('pending');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Rate limit reached'));

      warnSpy.mockRestore();
    });
  });

  describe('Near-limit queuing - Requirement 8.4', () => {
    it('should queue posts when approaching rate limit (>=180 requests)', async () => {
      jest.spyOn(graphApiClient, 'getPages').mockResolvedValue([
        { id: 'page123', name: 'Test Page', accessToken: 'page_token' }
      ]);
      jest.spyOn(graphApiClient, 'publishPhoto').mockResolvedValue({ success: true, postId: 'fb_123' });

      const pastTime = Math.floor((Date.now() - 3600000) / 1000);

      // Simulate 180 requests (at threshold)
      for (let i = 0; i < 180; i++) {
        (schedulerService as any).recordApiRequest(1);
      }

      db.prepare(`INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(1, 'Near limit test', JSON.stringify(['/uploads/img.jpg']), 'image', pastTime, 'pending', 'page123', Math.floor(Date.now() / 1000));

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      await schedulerService.checkAndPublishPosts();

      const post = db.prepare('SELECT status FROM posts WHERE id = 1').get() as { status: string };
      expect(post.status).toBe('pending');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Approaching rate limit'));

      warnSpy.mockRestore();
    });

    it('should publish normally when under threshold (<180 requests)', async () => {
      jest.spyOn(graphApiClient, 'getPages').mockResolvedValue([
        { id: 'page123', name: 'Test Page', accessToken: 'page_token' }
      ]);
      jest.spyOn(graphApiClient, 'publishPhoto').mockResolvedValue({ success: true, postId: 'fb_123' });

      const pastTime = Math.floor((Date.now() - 3600000) / 1000);

      // Only 50 requests so far
      for (let i = 0; i < 50; i++) {
        (schedulerService as any).recordApiRequest(1);
      }

      db.prepare(`INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(1, 'Normal publish test', JSON.stringify(['/uploads/img.jpg']), 'image', pastTime, 'pending', 'page123', Math.floor(Date.now() / 1000));

      jest.spyOn(console, 'log').mockImplementation();
      await schedulerService.checkAndPublishPosts();

      const post = db.prepare('SELECT status FROM posts WHERE id = 1').get() as { status: string };
      expect(post.status).toBe('posted');
    });
  });

  describe('Rate limit error retry - Requirement 8.1', () => {
    it('should retry with backoff on rate limit error and succeed on retry', async () => {
      jest.useFakeTimers();

      jest.spyOn(graphApiClient, 'getPages').mockResolvedValue([
        { id: 'page123', name: 'Test Page', accessToken: 'page_token' }
      ]);

      // Fail first with rate limit, succeed on second attempt
      jest.spyOn(graphApiClient, 'publishPhoto')
        .mockResolvedValueOnce({ success: false, error: 'rate limit exceeded' })
        .mockResolvedValueOnce({ success: true, postId: 'fb_retry_123' });

      const pastTime = Math.floor((Date.now() - 3600000) / 1000);
      db.prepare(`INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(1, 'Retry test', JSON.stringify(['/uploads/img.jpg']), 'image', pastTime, 'pending', 'page123', Math.floor(Date.now() / 1000));

      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'warn').mockImplementation();
      jest.spyOn(console, 'error').mockImplementation();

      const publishPromise = schedulerService.checkAndPublishPosts();
      // Advance timers to cover backoff delay
      jest.runAllTimersAsync();
      await publishPromise;

      const post = db.prepare('SELECT status FROM posts WHERE id = 1').get() as { status: string };
      expect(post.status).toBe('posted');

      jest.useRealTimers();
    });
  });
});
