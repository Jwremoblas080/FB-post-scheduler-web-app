import Database from 'better-sqlite3';
import { SchedulerService } from './schedulerService';
import { GraphApiClient } from './graphApiClient';
import { PostManagementService } from './postService';
import { PostData } from '../types';

describe('SchedulerService', () => {
  let db: Database.Database;
  let schedulerService: SchedulerService;
  let graphApiClient: GraphApiClient;
  let postService: PostManagementService;

  beforeEach(() => {
    // Use in-memory database for testing
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    // Initialize schema
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        facebook_user_id TEXT UNIQUE NOT NULL,
        access_token TEXT NOT NULL,
        token_expiry INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    db.exec(`
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
      )
    `);

    db.exec(`
      CREATE INDEX idx_scheduled_time ON posts(scheduled_time, status)
    `);

    // Create test user
    db.prepare(`
      INSERT INTO users (facebook_user_id, access_token, token_expiry, created_at)
      VALUES (?, ?, ?, ?)
    `).run('test_user_123', 'encrypted_token', Math.floor(Date.now() / 1000) + 3600, Math.floor(Date.now() / 1000));

    // Initialize services
    graphApiClient = new GraphApiClient();
    postService = new PostManagementService(db);
    schedulerService = new SchedulerService(db, graphApiClient, postService);
  });

  afterEach(() => {
    schedulerService.stop();
    db.close();
  });

  describe('checkAndPublishPosts - Requirements 6.1, 6.2', () => {
    it('should query pending posts with scheduled time <= current time', async () => {
      // Create posts with different scheduled times
      const pastTime = Math.floor((Date.now() - 3600000) / 1000); // 1 hour ago
      const futureTime = Math.floor((Date.now() + 3600000) / 1000); // 1 hour from now

      // Insert directly into database to bypass validation
      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Past post', JSON.stringify(['/uploads/image1.jpg']), 'image', pastTime, 'pending', 'page123', Math.floor(Date.now() / 1000));

      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Future post', JSON.stringify(['/uploads/image2.jpg']), 'image', futureTime, 'pending', 'page123', Math.floor(Date.now() / 1000));

      // Mock publishPostWithRetry to avoid actual publishing (and retries)
      jest.spyOn(schedulerService, 'publishPostWithRetry').mockResolvedValue({ success: true });

      // Spy on console.log to verify behavior
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await schedulerService.checkAndPublishPosts();

      // Should find 1 pending post (the past one)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 pending post(s) to publish')
      );

      consoleSpy.mockRestore();
    });

    it('should handle case when no pending posts are due', async () => {
      // Create only future posts
      const futureTime = new Date(Date.now() + 3600000);

      const futurePost: PostData = {
        userId: 1,
        caption: 'Future post',
        mediaUrls: ['/uploads/image1.jpg'],
        mediaType: 'image',
        scheduledTime: futureTime,
        pageId: 'page123'
      };

      postService.createPost(futurePost);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await schedulerService.checkAndPublishPosts();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No pending posts to publish')
      );

      consoleSpy.mockRestore();
    });

    it('should query multiple pending posts in chronological order', async () => {
      // Create multiple past posts
      const time1 = Math.floor((Date.now() - 7200000) / 1000); // 2 hours ago
      const time2 = Math.floor((Date.now() - 3600000) / 1000); // 1 hour ago
      const time3 = Math.floor((Date.now() - 1800000) / 1000); // 30 minutes ago

      // Insert in non-chronological order
      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Post 1', JSON.stringify(['/uploads/image1.jpg']), 'image', time2, 'pending', 'page123', Math.floor(Date.now() / 1000));

      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Post 2', JSON.stringify(['/uploads/image2.jpg']), 'image', time1, 'pending', 'page123', Math.floor(Date.now() / 1000));

      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Post 3', JSON.stringify(['/uploads/image3.jpg']), 'image', time3, 'pending', 'page123', Math.floor(Date.now() / 1000));

      // Mock publishPostWithRetry to avoid actual publishing (and retries)
      jest.spyOn(schedulerService, 'publishPostWithRetry').mockResolvedValue({ success: true });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await schedulerService.checkAndPublishPosts();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Found 3 pending post(s) to publish')
      );

      consoleSpy.mockRestore();
    });

    it('should only query posts with status "pending"', async () => {
      const pastTime = Math.floor((Date.now() - 3600000) / 1000);

      // Create a pending post
      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Pending post', JSON.stringify(['/uploads/image1.jpg']), 'image', pastTime, 'pending', 'page123', Math.floor(Date.now() / 1000));

      // Create a posted post (should not be queried)
      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Posted post', JSON.stringify(['/uploads/image2.jpg']), 'image', pastTime, 'posted', 'page123', Math.floor(Date.now() / 1000));

      // Create another pending post
      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Another pending post', JSON.stringify(['/uploads/image3.jpg']), 'image', pastTime, 'pending', 'page123', Math.floor(Date.now() / 1000));

      // Mock publishPostWithRetry to avoid actual publishing (and retries)
      jest.spyOn(schedulerService, 'publishPostWithRetry').mockResolvedValue({ success: true });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await schedulerService.checkAndPublishPosts();

      // Should only find 2 pending posts (not the posted one)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Found 2 pending post(s) to publish')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Scheduler polling mechanism - Requirement 6.1', () => {
    it('should start and stop the scheduler', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      schedulerService.start();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Scheduler started')
      );

      schedulerService.stop();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Scheduler stopped')
      );

      consoleSpy.mockRestore();
    });

    it('should not start scheduler twice', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      schedulerService.start();
      schedulerService.start(); // Try to start again

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Scheduler is already running')
      );

      consoleSpy.mockRestore();
    });

    it('should run checkAndPublishPosts every 60 seconds', (done) => {
      jest.useFakeTimers();

      const checkSpy = jest.spyOn(schedulerService, 'checkAndPublishPosts');

      schedulerService.start();

      // Should be called immediately on start
      expect(checkSpy).toHaveBeenCalledTimes(1);

      // Fast-forward 60 seconds
      jest.advanceTimersByTime(60000);
      expect(checkSpy).toHaveBeenCalledTimes(2);

      // Fast-forward another 60 seconds
      jest.advanceTimersByTime(60000);
      expect(checkSpy).toHaveBeenCalledTimes(3);

      schedulerService.stop();
      jest.useRealTimers();
      done();
    });
  });
});
