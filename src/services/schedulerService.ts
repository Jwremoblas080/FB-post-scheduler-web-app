import Database from 'better-sqlite3';
import { Post, PublishResult } from '../types';
import { GraphApiClient } from './graphApiClient';
import { PostManagementService } from './postService';
import { decrypt } from '../utils/encryption';

const MAX_REQUESTS_PER_HOUR = 200;
const RATE_LIMIT_THRESHOLD = 180; // queue posts when approaching limit
const MAX_RETRY_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 1000; // 1s, 2s, 4s, 8s

/**
 * Scheduler Service for automated post publishing
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 8.1, 8.2, 8.3, 8.4
 */
export class SchedulerService {
  private db: Database.Database;
  private graphApiClient: GraphApiClient;
  private postService: PostManagementService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  // Per-user API request tracking: userId -> list of timestamps (ms)
  private apiRequestLog: Map<number, number[]> = new Map();

  constructor(
    db: Database.Database,
    graphApiClient: GraphApiClient,
    postService: PostManagementService
  ) {
    this.db = db;
    this.graphApiClient = graphApiClient;
    this.postService = postService;
  }

  /**
   * Count API requests made by a user in the last hour
   * Requirements: 8.3
   */
  getRequestCountLastHour(userId: number): number {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const log = this.apiRequestLog.get(userId) ?? [];
    const recent = log.filter(t => t > oneHourAgo);
    this.apiRequestLog.set(userId, recent);
    return recent.length;
  }

  /**
   * Record an API request for a user
   * Requirements: 8.3
   */
  private recordApiRequest(userId: number): void {
    const log = this.apiRequestLog.get(userId) ?? [];
    log.push(Date.now());
    this.apiRequestLog.set(userId, log);
  }

  /**
   * Check if a user is approaching the rate limit
   * Requirements: 8.4
   */
  isApproachingRateLimit(userId: number): boolean {
    return this.getRequestCountLastHour(userId) >= RATE_LIMIT_THRESHOLD;
  }

  /**
   * Check if a user has exceeded the rate limit
   * Requirements: 8.3
   */
  isRateLimited(userId: number): boolean {
    return this.getRequestCountLastHour(userId) >= MAX_REQUESTS_PER_HOUR;
  }

  /**
   * Exponential backoff delay
   * Requirements: 8.2
   */
  getBackoffDelay(attempt: number): number {
    return BASE_BACKOFF_MS * Math.pow(2, attempt);
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Start the scheduler to run every 60 seconds
   * Requirements: 6.1
   */
  start(): void {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log('Scheduler started - checking for posts every 60 seconds');

    // Run immediately on start
    this.checkAndPublishPosts();

    // Then run every 60 seconds
    this.intervalId = setInterval(() => {
      this.checkAndPublishPosts();
    }, 60000); // 60 seconds
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Scheduler stopped');
  }

  /**
   * Check for pending posts and publish those that are due
   * Requirements: 6.1, 6.2
   */
  async checkAndPublishPosts(): Promise<void> {
    try {
      const pendingPosts = this.getPendingPosts();
      
      if (pendingPosts.length === 0) {
        console.log(`[${new Date().toISOString()}] No pending posts to publish`);
        return;
      }

      console.log(`[${new Date().toISOString()}] Found ${pendingPosts.length} pending post(s) to publish`);

      for (const post of pendingPosts) {
        // Requirements: 8.3, 8.4 - check rate limits before publishing
        if (this.isRateLimited(post.userId)) {
          console.warn(`[${new Date().toISOString()}] Rate limit reached for user ${post.userId}, skipping post ${post.id}`);
          continue;
        }
        if (this.isApproachingRateLimit(post.userId)) {
          console.warn(`[${new Date().toISOString()}] Approaching rate limit for user ${post.userId}, queuing post ${post.id} for later`);
          continue;
        }
        await this.publishPostWithRetry(post);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in checkAndPublishPosts:`, error);
    }
  }

  /**
   * Query database for posts that are ready to publish
   * Requirements: 6.2
   */
  private getPendingPosts(): Post[] {
    const currentTimestamp = Math.floor(Date.now() / 1000);

    const rows = this.db.prepare(`
      SELECT 
        id, user_id, caption, media_url, media_type,
        scheduled_time, status, page_id, created_at, error_message
      FROM posts
      WHERE status = 'pending' AND scheduled_time <= ?
      ORDER BY scheduled_time ASC
    `).all(currentTimestamp) as Array<{
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
   * Publish a post with exponential backoff retry logic
   * Requirements: 8.1, 8.2
   */
  async publishPostWithRetry(post: Post): Promise<PublishResult> {
    let lastResult: PublishResult = { success: false, error: 'Not attempted' };

    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        const delay = this.getBackoffDelay(attempt - 1);
        console.log(`[${new Date().toISOString()}] Retrying post ${post.id} (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}) after ${delay}ms backoff`);
        await this.sleep(delay);
      }

      lastResult = await this.publishPost(post);

      if (lastResult.success) {
        return lastResult;
      }

      // Check for rate limit error - Requirements: 8.1
      const isRateLimit = lastResult.error?.toLowerCase().includes('rate limit') ||
                          lastResult.error?.toLowerCase().includes('too many requests');
      if (isRateLimit) {
        console.warn(`[${new Date().toISOString()}] Rate limit error for post ${post.id}, will retry with backoff`);
        // Continue to next attempt with backoff
      }
    }

    return lastResult;
  }

  /**
   * Publish a single post via Graph API
   * Requirements: 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
   */
  private async publishPost(post: Post): Promise<PublishResult> {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Publishing post ${post.id}...`);
    
    try {
      // Get user's access token from database
      const userToken = this.getUserAccessToken(post.userId);
      if (!userToken) {
        const errorMsg = 'User access token not found';
        console.error(`[${timestamp}] Error publishing post ${post.id}: ${errorMsg}`);
        this.postService.updatePostStatus(post.id, 'failed', errorMsg);
        return {
          success: false,
          error: errorMsg
        };
      }

      // Get page access token
      const pageAccessToken = await this.getPageAccessToken(userToken, post.pageId);
      if (!pageAccessToken) {
        const errorMsg = `Page access token not found for page ${post.pageId}`;
        console.error(`[${timestamp}] Error publishing post ${post.id}: ${errorMsg}`);
        this.postService.updatePostStatus(post.id, 'failed', errorMsg);
        return {
          success: false,
          error: errorMsg
        };
      }

      // Publish based on media type
      let result: PublishResult;
      
      if (post.mediaType === 'video') {
        // Single video post
        // Requirements: 6.4, 6.5
        this.recordApiRequest(post.userId);
        result = await this.graphApiClient.publishVideo(
          post.pageId,
          pageAccessToken,
          post.mediaUrls[0],
          post.caption
        );
      } else if (post.mediaUrls.length === 1) {
        // Single image post
        // Requirements: 6.3, 6.5
        this.recordApiRequest(post.userId);
        result = await this.graphApiClient.publishPhoto(
          post.pageId,
          pageAccessToken,
          post.mediaUrls[0],
          post.caption
        );
      } else {
        // Multiple images post
        // Requirements: 6.3, 6.5
        this.recordApiRequest(post.userId);
        result = await this.graphApiClient.publishPhotos(
          post.pageId,
          pageAccessToken,
          post.mediaUrls,
          post.caption
        );
      }

      // Update post status based on result
      if (result.success) {
        // Requirements: 6.6, 6.8
        console.log(`[${timestamp}] Successfully published post ${post.id} (Facebook Post ID: ${result.postId})`);
        this.postService.updatePostStatus(post.id, 'posted');
      } else {
        // Requirements: 6.7, 6.8, 7.2
        console.error(`[${timestamp}] Failed to publish post ${post.id}: ${result.error}`);
        this.postService.updatePostStatus(post.id, 'failed', result.error);
      }

      return result;
    } catch (error) {
      // Requirements: 6.7, 6.8, 7.1, 7.2
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`[${timestamp}] Error publishing post ${post.id}:`, errorMessage);
      this.postService.updatePostStatus(post.id, 'failed', errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Retrieve user's access token from database
   * Requirements: 1.3, 9.1
   */
  private getUserAccessToken(userId: number): string | null {
    try {
      const row = this.db.prepare(`
        SELECT access_token 
        FROM users 
        WHERE id = ?
      `).get(userId) as { access_token: string } | undefined;

      if (!row) {
        return null;
      }

      // Decrypt the token
      return decrypt(row.access_token);
    } catch (error) {
      console.error(`Error retrieving user access token:`, error);
      return null;
    }
  }

  /**
   * Get page access token from Graph API
   * Requirements: 2.1, 2.2
   */
  private async getPageAccessToken(userAccessToken: string, pageId: string): Promise<string | null> {
    try {
      const pages = await this.graphApiClient.getPages(userAccessToken);
      const page = pages.find(p => p.id === pageId);
      return page ? page.accessToken : null;
    } catch (error) {
      console.error(`Error retrieving page access token:`, error);
      return null;
    }
  }
}
