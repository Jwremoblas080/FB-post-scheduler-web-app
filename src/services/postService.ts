import Database from 'better-sqlite3';
import { Post, PostData } from '../types';

export class PostManagementService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Create a new scheduled post with validation
   * Requirements: 4.2, 4.3, 4.6
   */
  createPost(postData: PostData): Post {
    // Validate required fields
    this.validatePostData(postData);

    // Validate scheduled time is not in the past
    const now = new Date();
    if (postData.scheduledTime <= now) {
      throw new Error('Scheduled time must be in the future');
    }

    // Convert media URLs array to JSON string for storage
    const mediaUrlJson = JSON.stringify(postData.mediaUrls);
    const scheduledTimeTimestamp = Math.floor(postData.scheduledTime.getTime() / 1000);
    const createdAtTimestamp = Math.floor(Date.now() / 1000);

    // Insert post into database
    const result = this.db.prepare(`
      INSERT INTO posts (
        user_id, caption, media_url, media_type, 
        scheduled_time, status, page_id, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      postData.userId,
      postData.caption,
      mediaUrlJson,
      postData.mediaType,
      scheduledTimeTimestamp,
      'pending',
      postData.pageId,
      createdAtTimestamp
    );

    // Return the created post
    return {
      id: result.lastInsertRowid as number,
      userId: postData.userId,
      caption: postData.caption,
      mediaUrls: postData.mediaUrls,
      mediaType: postData.mediaType,
      scheduledTime: postData.scheduledTime,
      status: 'pending',
      pageId: postData.pageId,
      createdAt: new Date(createdAtTimestamp * 1000)
    };
  }

  /**
   * Retrieve all posts (single-user mode)
   */
  getAllPosts(): Post[] {
    const rows = this.db.prepare(`
      SELECT 
        id, user_id, caption, media_url, media_type,
        scheduled_time, status, page_id, created_at, error_message
      FROM posts
      ORDER BY scheduled_time ASC
    `).all() as Array<{
      id: number;
      user_id: number;
      caption: string;
      media_url: string;
      media_type: 'image' | 'video';
      scheduled_time: number;
      status: 'pending' | 'posted' | 'failed';
      page_id: string;
      created_at: number;
      error_message: string | null;
    }>;

    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      caption: row.caption,
      mediaUrls: JSON.parse(row.media_url),
      mediaType: row.media_type,
      scheduledTime: new Date(row.scheduled_time * 1000),
      status: row.status,
      pageId: row.page_id,
      createdAt: new Date(row.created_at * 1000),
      errorMessage: row.error_message || undefined
    }));
  }

  /**
   * Retrieve all posts for a specific user
   * Requirements: 5.1
   */
  getPosts(userId: number): Post[] {
    const rows = this.db.prepare(`
      SELECT 
        id, user_id, caption, media_url, media_type,
        scheduled_time, status, page_id, created_at, error_message
      FROM posts
      WHERE user_id = ?
      ORDER BY scheduled_time ASC
    `).all(userId) as Array<{
      id: number;
      user_id: number;
      caption: string;
      media_url: string;
      media_type: 'image' | 'video';
      scheduled_time: number;
      status: 'pending' | 'posted' | 'failed';
      page_id: string;
      created_at: number;
      error_message: string | null;
    }>;

    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      caption: row.caption,
      mediaUrls: JSON.parse(row.media_url),
      mediaType: row.media_type,
      scheduledTime: new Date(row.scheduled_time * 1000),
      status: row.status,
      pageId: row.page_id,
      createdAt: new Date(row.created_at * 1000),
      errorMessage: row.error_message || undefined
    }));
  }

  /**
   * Delete a post with status restrictions
   * Requirements: 5.5, 5.6
   */
  deletePost(postId: number): void {
    // First, check if the post exists and get its status
    const post = this.db.prepare(`
      SELECT status FROM posts WHERE id = ?
    `).get(postId) as { status: string } | undefined;

    if (!post) {
      throw new Error('Post not found');
    }

    // Only allow deletion of pending or failed posts
    if (post.status === 'posted') {
      throw new Error('Cannot delete a post that has already been posted');
    }

    // Delete the post
    this.db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
  }

  /**
   * Update post status (used by scheduler)
   * Requirements: 6.6, 6.7, 7.2
   */
  updatePostStatus(postId: number, status: 'pending' | 'posted' | 'failed', errorMessage?: string): void {
    if (errorMessage) {
      this.db.prepare(`
        UPDATE posts 
        SET status = ?, error_message = ?
        WHERE id = ?
      `).run(status, errorMessage, postId);
    } else {
      this.db.prepare(`
        UPDATE posts 
        SET status = ?, error_message = NULL
        WHERE id = ?
      `).run(status, postId);
    }
  }

  /**
   * Validate post data has all required fields
   * Requirements: 4.2
   */
  private validatePostData(postData: PostData): void {
    const missingFields: string[] = [];

    if (!postData.caption || postData.caption.trim() === '') {
      missingFields.push('caption');
    }

    if (!postData.mediaUrls || postData.mediaUrls.length === 0) {
      missingFields.push('media');
    }

    if (!postData.scheduledTime) {
      missingFields.push('scheduledTime');
    }

    if (!postData.pageId || postData.pageId.trim() === '') {
      missingFields.push('pageId');
    }

    if (!postData.userId) {
      missingFields.push('userId');
    }

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate media type
    if (postData.mediaType !== 'image' && postData.mediaType !== 'video') {
      throw new Error('Invalid media type. Must be "image" or "video"');
    }

    // Validate multi-image constraints
    if (postData.mediaType === 'image' && postData.mediaUrls.length > 10) {
      throw new Error('Cannot upload more than 10 images per post');
    }

    // Validate single video constraint
    if (postData.mediaType === 'video' && postData.mediaUrls.length > 1) {
      throw new Error('Cannot upload more than one video per post');
    }
  }
}
