import Database from 'better-sqlite3';
import { SchedulerService } from './schedulerService';
import { GraphApiClient } from './graphApiClient';
import { PostManagementService } from './postService';
import { encrypt } from '../utils/encryption';

/**
 * Tests for Task 10.2: Post Publishing Logic
 * Requirements: 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
 */
describe('SchedulerService - Post Publishing Logic', () => {
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

    // Create test user with properly encrypted token
    const encryptedToken = encrypt('test_access_token_123');
    db.prepare(`
      INSERT INTO users (facebook_user_id, access_token, token_expiry, created_at)
      VALUES (?, ?, ?, ?)
    `).run('test_user_123', encryptedToken, Math.floor(Date.now() / 1000) + 3600, Math.floor(Date.now() / 1000));

    // Initialize services
    graphApiClient = new GraphApiClient();
    postService = new PostManagementService(db);
    schedulerService = new SchedulerService(db, graphApiClient, postService);
  });

  afterEach(() => {
    schedulerService.stop();
    db.close();
  });

  describe('Single Image Publishing - Requirements 6.3, 6.5', () => {
    it('should publish single image post with caption via Graph API', async () => {
      // Mock Graph API methods
      const mockGetPages = jest.spyOn(graphApiClient, 'getPages').mockResolvedValue([
        { id: 'page123', name: 'Test Page', accessToken: 'page_token_123' }
      ]);

      const mockPublishPhoto = jest.spyOn(graphApiClient, 'publishPhoto').mockResolvedValue({
        success: true,
        postId: 'fb_post_123'
      });

      // Create a pending post with single image
      const pastTime = Math.floor((Date.now() - 3600000) / 1000);
      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Test caption for single image', JSON.stringify(['/uploads/image1.jpg']), 'image', pastTime, 'pending', 'page123', Math.floor(Date.now() / 1000));

      // Run scheduler
      await schedulerService.checkAndPublishPosts();

      // Verify Graph API was called correctly
      expect(mockGetPages).toHaveBeenCalledWith('test_access_token_123');
      expect(mockPublishPhoto).toHaveBeenCalledWith(
        'page123',
        'page_token_123',
        '/uploads/image1.jpg',
        'Test caption for single image'
      );

      // Verify post status was updated to 'posted'
      const post = db.prepare('SELECT status FROM posts WHERE id = 1').get() as { status: string };
      expect(post.status).toBe('posted');

      mockGetPages.mockRestore();
      mockPublishPhoto.mockRestore();
    });
  });

  describe('Multiple Images Publishing - Requirements 6.3, 6.5', () => {
    it('should publish multiple images post with caption via Graph API', async () => {
      // Mock Graph API methods
      const mockGetPages = jest.spyOn(graphApiClient, 'getPages').mockResolvedValue([
        { id: 'page456', name: 'Test Page', accessToken: 'page_token_456' }
      ]);

      const mockPublishPhotos = jest.spyOn(graphApiClient, 'publishPhotos').mockResolvedValue({
        success: true,
        postId: 'fb_post_456'
      });

      // Create a pending post with multiple images
      const pastTime = Math.floor((Date.now() - 3600000) / 1000);
      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Test caption for multiple images', JSON.stringify(['/uploads/image1.jpg', '/uploads/image2.jpg', '/uploads/image3.jpg']), 'image', pastTime, 'pending', 'page456', Math.floor(Date.now() / 1000));

      // Run scheduler
      await schedulerService.checkAndPublishPosts();

      // Verify Graph API was called correctly
      expect(mockGetPages).toHaveBeenCalledWith('test_access_token_123');
      expect(mockPublishPhotos).toHaveBeenCalledWith(
        'page456',
        'page_token_456',
        ['/uploads/image1.jpg', '/uploads/image2.jpg', '/uploads/image3.jpg'],
        'Test caption for multiple images'
      );

      // Verify post status was updated to 'posted'
      const post = db.prepare('SELECT status FROM posts WHERE id = 1').get() as { status: string };
      expect(post.status).toBe('posted');

      mockGetPages.mockRestore();
      mockPublishPhotos.mockRestore();
    });
  });

  describe('Video Publishing - Requirements 6.4, 6.5', () => {
    it('should publish video post with caption via Graph API', async () => {
      // Mock Graph API methods
      const mockGetPages = jest.spyOn(graphApiClient, 'getPages').mockResolvedValue([
        { id: 'page789', name: 'Test Page', accessToken: 'page_token_789' }
      ]);

      const mockPublishVideo = jest.spyOn(graphApiClient, 'publishVideo').mockResolvedValue({
        success: true,
        postId: 'fb_video_789'
      });

      // Create a pending video post
      const pastTime = Math.floor((Date.now() - 3600000) / 1000);
      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Test caption for video', JSON.stringify(['/uploads/video1.mp4']), 'video', pastTime, 'pending', 'page789', Math.floor(Date.now() / 1000));

      // Run scheduler
      await schedulerService.checkAndPublishPosts();

      // Verify Graph API was called correctly
      expect(mockGetPages).toHaveBeenCalledWith('test_access_token_123');
      expect(mockPublishVideo).toHaveBeenCalledWith(
        'page789',
        'page_token_789',
        '/uploads/video1.mp4',
        'Test caption for video'
      );

      // Verify post status was updated to 'posted'
      const post = db.prepare('SELECT status FROM posts WHERE id = 1').get() as { status: string };
      expect(post.status).toBe('posted');

      mockGetPages.mockRestore();
      mockPublishVideo.mockRestore();
    });
  });

  describe('Successful Publishing - Requirements 6.6, 6.8', () => {
    it('should update post status to "posted" on successful publish', async () => {
      // Mock successful publish
      jest.spyOn(graphApiClient, 'getPages').mockResolvedValue([
        { id: 'page123', name: 'Test Page', accessToken: 'page_token_123' }
      ]);

      jest.spyOn(graphApiClient, 'publishPhoto').mockResolvedValue({
        success: true,
        postId: 'fb_post_success'
      });

      const pastTime = Math.floor((Date.now() - 3600000) / 1000);
      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Success test', JSON.stringify(['/uploads/image1.jpg']), 'image', pastTime, 'pending', 'page123', Math.floor(Date.now() / 1000));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await schedulerService.checkAndPublishPosts();

      // Verify status updated to 'posted'
      const post = db.prepare('SELECT status, error_message FROM posts WHERE id = 1').get() as { status: string; error_message: string | null };
      expect(post.status).toBe('posted');
      expect(post.error_message).toBeNull();

      // Verify logging
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully published post 1')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Failed Publishing - Requirements 6.7, 6.8, 7.2', () => {
    it('should update post status to "failed" with error message on publish failure', async () => {
      // Mock failed publish
      jest.spyOn(graphApiClient, 'getPages').mockResolvedValue([
        { id: 'page123', name: 'Test Page', accessToken: 'page_token_123' }
      ]);

      jest.spyOn(graphApiClient, 'publishPhoto').mockResolvedValue({
        success: false,
        error: 'Facebook API Error: Invalid media URL'
      });

      // Mock sleep to avoid backoff delays during retries
      jest.spyOn(schedulerService as any, 'sleep').mockResolvedValue(undefined);

      const pastTime = Math.floor((Date.now() - 3600000) / 1000);
      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Failure test', JSON.stringify(['/uploads/image1.jpg']), 'image', pastTime, 'pending', 'page123', Math.floor(Date.now() / 1000));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await schedulerService.checkAndPublishPosts();

      // Verify status updated to 'failed' with error message
      const post = db.prepare('SELECT status, error_message FROM posts WHERE id = 1').get() as { status: string; error_message: string };
      expect(post.status).toBe('failed');
      expect(post.error_message).toBe('Facebook API Error: Invalid media URL');

      // Verify error logging
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to publish post 1')
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle missing user access token', async () => {
      // Temporarily disable foreign keys to insert post with non-existent user
      db.pragma('foreign_keys = OFF');
      
      const pastTime = Math.floor((Date.now() - 3600000) / 1000);
      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(999, 'No user test', JSON.stringify(['/uploads/image1.jpg']), 'image', pastTime, 'pending', 'page123', Math.floor(Date.now() / 1000));

      // Re-enable foreign keys
      db.pragma('foreign_keys = ON');

      // Mock sleep to avoid backoff delays during retries
      jest.spyOn(schedulerService as any, 'sleep').mockResolvedValue(undefined);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await schedulerService.checkAndPublishPosts();

      // Verify status updated to 'failed'
      const post = db.prepare('SELECT status, error_message FROM posts WHERE id = 1').get() as { status: string; error_message: string };
      expect(post.status).toBe('failed');
      expect(post.error_message).toBe('User access token not found');

      consoleErrorSpy.mockRestore();
    });

    it('should handle missing page access token', async () => {
      // Mock getPages to return empty array (page not found)
      jest.spyOn(graphApiClient, 'getPages').mockResolvedValue([]);

      // Mock sleep to avoid backoff delays during retries
      jest.spyOn(schedulerService as any, 'sleep').mockResolvedValue(undefined);

      const pastTime = Math.floor((Date.now() - 3600000) / 1000);
      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'No page test', JSON.stringify(['/uploads/image1.jpg']), 'image', pastTime, 'pending', 'page999', Math.floor(Date.now() / 1000));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await schedulerService.checkAndPublishPosts();

      // Verify status updated to 'failed'
      const post = db.prepare('SELECT status, error_message FROM posts WHERE id = 1').get() as { status: string; error_message: string };
      expect(post.status).toBe('failed');
      expect(post.error_message).toContain('Page access token not found');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Publishing Attempt Logging - Requirements 6.8, 7.1', () => {
    it('should log all publishing attempts with timestamps', async () => {
      jest.spyOn(graphApiClient, 'getPages').mockResolvedValue([
        { id: 'page123', name: 'Test Page', accessToken: 'page_token_123' }
      ]);

      jest.spyOn(graphApiClient, 'publishPhoto').mockResolvedValue({
        success: true,
        postId: 'fb_post_123'
      });

      const pastTime = Math.floor((Date.now() - 3600000) / 1000);
      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Logging test', JSON.stringify(['/uploads/image1.jpg']), 'image', pastTime, 'pending', 'page123', Math.floor(Date.now() / 1000));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await schedulerService.checkAndPublishPosts();

      // Verify logging with timestamp
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] Publishing post 1\.\.\./)
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] Successfully published post 1/)
      );

      consoleSpy.mockRestore();
    });

    it('should log error details for failed attempts', async () => {
      jest.spyOn(graphApiClient, 'getPages').mockResolvedValue([
        { id: 'page123', name: 'Test Page', accessToken: 'page_token_123' }
      ]);

      jest.spyOn(graphApiClient, 'publishPhoto').mockResolvedValue({
        success: false,
        error: 'Rate limit exceeded'
      });

      // Mock sleep to avoid backoff delays during retries
      jest.spyOn(schedulerService as any, 'sleep').mockResolvedValue(undefined);

      const pastTime = Math.floor((Date.now() - 3600000) / 1000);
      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Error logging test', JSON.stringify(['/uploads/image1.jpg']), 'image', pastTime, 'pending', 'page123', Math.floor(Date.now() / 1000));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await schedulerService.checkAndPublishPosts();

      // Verify error logging with details
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] Failed to publish post 1: Rate limit exceeded/)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Caption Inclusion - Requirement 6.5', () => {
    it('should include caption in all publish requests', async () => {
      const mockGetPages = jest.spyOn(graphApiClient, 'getPages').mockResolvedValue([
        { id: 'page123', name: 'Test Page', accessToken: 'page_token_123' }
      ]);

      const mockPublishPhoto = jest.spyOn(graphApiClient, 'publishPhoto').mockResolvedValue({
        success: true,
        postId: 'fb_post_123'
      });

      const pastTime = Math.floor((Date.now() - 3600000) / 1000);
      const testCaption = 'This is a test caption with special characters: #hashtag @mention';
      
      db.prepare(`
        INSERT INTO posts (user_id, caption, media_url, media_type, scheduled_time, status, page_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, testCaption, JSON.stringify(['/uploads/image1.jpg']), 'image', pastTime, 'pending', 'page123', Math.floor(Date.now() / 1000));

      await schedulerService.checkAndPublishPosts();

      // Verify caption was passed to Graph API
      expect(mockPublishPhoto).toHaveBeenCalledWith(
        'page123',
        'page_token_123',
        '/uploads/image1.jpg',
        testCaption
      );

      mockGetPages.mockRestore();
      mockPublishPhoto.mockRestore();
    });
  });
});
