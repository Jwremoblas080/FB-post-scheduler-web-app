import { PostManagementService } from './postService';
import { initializeDatabase } from '../database/init';
import Database from 'better-sqlite3';
import { PostData } from '../types';
import fs from 'fs';
import path from 'path';

describe('PostManagementService', () => {
  let db: Database.Database;
  let postService: PostManagementService;
  let testDbPath: string;
  let testUserId: number;

  beforeEach(() => {
    // Create a temporary database for testing
    testDbPath = path.join(__dirname, '../../test-data', `test-${Date.now()}.db`);
    const dbDir = path.dirname(testDbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = initializeDatabase(testDbPath);
    postService = new PostManagementService(db);

    // Create a test user
    const result = db.prepare(`
      INSERT INTO users (facebook_user_id, access_token, token_expiry, created_at)
      VALUES (?, ?, ?, ?)
    `).run('test-user-123', 'encrypted-token', Math.floor(Date.now() / 1000) + 3600, Math.floor(Date.now() / 1000));
    
    testUserId = result.lastInsertRowid as number;
  });

  afterEach(() => {
    db.close();
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('createPost', () => {
    it('should create a post with all required fields', () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      const postData: PostData = {
        caption: 'Test post caption',
        mediaUrls: ['/uploads/image1.jpg'],
        mediaType: 'image',
        scheduledTime: futureDate,
        pageId: 'page-123',
        userId: testUserId
      };

      const createdPost = postService.createPost(postData);

      expect(createdPost.id).toBeDefined();
      expect(createdPost.caption).toBe(postData.caption);
      expect(createdPost.mediaUrls).toEqual(postData.mediaUrls);
      expect(createdPost.mediaType).toBe(postData.mediaType);
      expect(createdPost.scheduledTime.getTime()).toBe(futureDate.getTime());
      expect(createdPost.status).toBe('pending');
      expect(createdPost.pageId).toBe(postData.pageId);
      expect(createdPost.userId).toBe(testUserId);
      expect(createdPost.createdAt).toBeInstanceOf(Date);
    });

    it('should create a post with multiple images', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const postData: PostData = {
        caption: 'Multi-image post',
        mediaUrls: ['/uploads/img1.jpg', '/uploads/img2.jpg', '/uploads/img3.jpg'],
        mediaType: 'image',
        scheduledTime: futureDate,
        pageId: 'page-123',
        userId: testUserId
      };

      const createdPost = postService.createPost(postData);

      expect(createdPost.mediaUrls).toHaveLength(3);
      expect(createdPost.mediaUrls).toEqual(postData.mediaUrls);
    });

    it('should reject post with scheduled time in the past', () => {
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
      const postData: PostData = {
        caption: 'Past post',
        mediaUrls: ['/uploads/image1.jpg'],
        mediaType: 'image',
        scheduledTime: pastDate,
        pageId: 'page-123',
        userId: testUserId
      };

      expect(() => postService.createPost(postData)).toThrow('Scheduled time must be in the future');
    });

    it('should reject post with missing caption', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const postData: PostData = {
        caption: '',
        mediaUrls: ['/uploads/image1.jpg'],
        mediaType: 'image',
        scheduledTime: futureDate,
        pageId: 'page-123',
        userId: testUserId
      };

      expect(() => postService.createPost(postData)).toThrow('Missing required fields: caption');
    });

    it('should reject post with missing media', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const postData: PostData = {
        caption: 'Test caption',
        mediaUrls: [],
        mediaType: 'image',
        scheduledTime: futureDate,
        pageId: 'page-123',
        userId: testUserId
      };

      expect(() => postService.createPost(postData)).toThrow('Missing required fields: media');
    });

    it('should reject post with missing pageId', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const postData: PostData = {
        caption: 'Test caption',
        mediaUrls: ['/uploads/image1.jpg'],
        mediaType: 'image',
        scheduledTime: futureDate,
        pageId: '',
        userId: testUserId
      };

      expect(() => postService.createPost(postData)).toThrow('Missing required fields: pageId');
    });

    it('should reject post with more than 10 images', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const postData: PostData = {
        caption: 'Too many images',
        mediaUrls: Array(11).fill('/uploads/image.jpg'),
        mediaType: 'image',
        scheduledTime: futureDate,
        pageId: 'page-123',
        userId: testUserId
      };

      expect(() => postService.createPost(postData)).toThrow('Cannot upload more than 10 images per post');
    });

    it('should reject video post with multiple files', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const postData: PostData = {
        caption: 'Multiple videos',
        mediaUrls: ['/uploads/video1.mp4', '/uploads/video2.mp4'],
        mediaType: 'video',
        scheduledTime: futureDate,
        pageId: 'page-123',
        userId: testUserId
      };

      expect(() => postService.createPost(postData)).toThrow('Cannot upload more than one video per post');
    });
  });

  describe('getPosts', () => {
    it('should retrieve all posts for a user', () => {
      const futureDate1 = new Date(Date.now() + 3600000);
      const futureDate2 = new Date(Date.now() + 7200000);

      const postData1: PostData = {
        caption: 'First post',
        mediaUrls: ['/uploads/image1.jpg'],
        mediaType: 'image',
        scheduledTime: futureDate1,
        pageId: 'page-123',
        userId: testUserId
      };

      const postData2: PostData = {
        caption: 'Second post',
        mediaUrls: ['/uploads/video1.mp4'],
        mediaType: 'video',
        scheduledTime: futureDate2,
        pageId: 'page-456',
        userId: testUserId
      };

      postService.createPost(postData1);
      postService.createPost(postData2);

      const posts = postService.getPosts(testUserId);

      expect(posts).toHaveLength(2);
      expect(posts[0].caption).toBe('First post');
      expect(posts[1].caption).toBe('Second post');
    });

    it('should return posts sorted by scheduled time in ascending order', () => {
      const futureDate1 = new Date(Date.now() + 7200000); // 2 hours
      const futureDate2 = new Date(Date.now() + 3600000); // 1 hour
      const futureDate3 = new Date(Date.now() + 10800000); // 3 hours

      const postData1: PostData = {
        caption: 'Post 2',
        mediaUrls: ['/uploads/image1.jpg'],
        mediaType: 'image',
        scheduledTime: futureDate1,
        pageId: 'page-123',
        userId: testUserId
      };

      const postData2: PostData = {
        caption: 'Post 1',
        mediaUrls: ['/uploads/image2.jpg'],
        mediaType: 'image',
        scheduledTime: futureDate2,
        pageId: 'page-123',
        userId: testUserId
      };

      const postData3: PostData = {
        caption: 'Post 3',
        mediaUrls: ['/uploads/image3.jpg'],
        mediaType: 'image',
        scheduledTime: futureDate3,
        pageId: 'page-123',
        userId: testUserId
      };

      postService.createPost(postData1);
      postService.createPost(postData2);
      postService.createPost(postData3);

      const posts = postService.getPosts(testUserId);

      expect(posts).toHaveLength(3);
      expect(posts[0].caption).toBe('Post 1');
      expect(posts[1].caption).toBe('Post 2');
      expect(posts[2].caption).toBe('Post 3');
      expect(posts[0].scheduledTime.getTime()).toBeLessThan(posts[1].scheduledTime.getTime());
      expect(posts[1].scheduledTime.getTime()).toBeLessThan(posts[2].scheduledTime.getTime());
    });

    it('should return empty array for user with no posts', () => {
      const posts = postService.getPosts(testUserId);
      expect(posts).toEqual([]);
    });

    it('should parse multi-image URLs correctly', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const postData: PostData = {
        caption: 'Multi-image post',
        mediaUrls: ['/uploads/img1.jpg', '/uploads/img2.jpg', '/uploads/img3.jpg'],
        mediaType: 'image',
        scheduledTime: futureDate,
        pageId: 'page-123',
        userId: testUserId
      };

      postService.createPost(postData);
      const posts = postService.getPosts(testUserId);

      expect(posts[0].mediaUrls).toHaveLength(3);
      expect(posts[0].mediaUrls).toEqual(['/uploads/img1.jpg', '/uploads/img2.jpg', '/uploads/img3.jpg']);
    });
  });

  describe('deletePost', () => {
    it('should delete a pending post', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const postData: PostData = {
        caption: 'Test post',
        mediaUrls: ['/uploads/image1.jpg'],
        mediaType: 'image',
        scheduledTime: futureDate,
        pageId: 'page-123',
        userId: testUserId
      };

      const createdPost = postService.createPost(postData);
      postService.deletePost(createdPost.id);

      const posts = postService.getPosts(testUserId);
      expect(posts).toHaveLength(0);
    });

    it('should delete a failed post', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const postData: PostData = {
        caption: 'Test post',
        mediaUrls: ['/uploads/image1.jpg'],
        mediaType: 'image',
        scheduledTime: futureDate,
        pageId: 'page-123',
        userId: testUserId
      };

      const createdPost = postService.createPost(postData);
      postService.updatePostStatus(createdPost.id, 'failed', 'Test error');
      postService.deletePost(createdPost.id);

      const posts = postService.getPosts(testUserId);
      expect(posts).toHaveLength(0);
    });

    it('should not allow deletion of posted posts', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const postData: PostData = {
        caption: 'Test post',
        mediaUrls: ['/uploads/image1.jpg'],
        mediaType: 'image',
        scheduledTime: futureDate,
        pageId: 'page-123',
        userId: testUserId
      };

      const createdPost = postService.createPost(postData);
      postService.updatePostStatus(createdPost.id, 'posted');

      expect(() => postService.deletePost(createdPost.id)).toThrow('Cannot delete a post that has already been posted');
    });

    it('should throw error when deleting non-existent post', () => {
      expect(() => postService.deletePost(99999)).toThrow('Post not found');
    });
  });

  describe('updatePostStatus', () => {
    it('should update post status to posted', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const postData: PostData = {
        caption: 'Test post',
        mediaUrls: ['/uploads/image1.jpg'],
        mediaType: 'image',
        scheduledTime: futureDate,
        pageId: 'page-123',
        userId: testUserId
      };

      const createdPost = postService.createPost(postData);
      postService.updatePostStatus(createdPost.id, 'posted');

      const posts = postService.getPosts(testUserId);
      expect(posts[0].status).toBe('posted');
      expect(posts[0].errorMessage).toBeUndefined();
    });

    it('should update post status to failed with error message', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const postData: PostData = {
        caption: 'Test post',
        mediaUrls: ['/uploads/image1.jpg'],
        mediaType: 'image',
        scheduledTime: futureDate,
        pageId: 'page-123',
        userId: testUserId
      };

      const createdPost = postService.createPost(postData);
      const errorMessage = 'Failed to publish: Network error';
      postService.updatePostStatus(createdPost.id, 'failed', errorMessage);

      const posts = postService.getPosts(testUserId);
      expect(posts[0].status).toBe('failed');
      expect(posts[0].errorMessage).toBe(errorMessage);
    });

    it('should clear error message when updating to posted', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const postData: PostData = {
        caption: 'Test post',
        mediaUrls: ['/uploads/image1.jpg'],
        mediaType: 'image',
        scheduledTime: futureDate,
        pageId: 'page-123',
        userId: testUserId
      };

      const createdPost = postService.createPost(postData);
      postService.updatePostStatus(createdPost.id, 'failed', 'Initial error');
      postService.updatePostStatus(createdPost.id, 'posted');

      const posts = postService.getPosts(testUserId);
      expect(posts[0].status).toBe('posted');
      expect(posts[0].errorMessage).toBeUndefined();
    });
  });
});
