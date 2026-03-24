import Database from 'better-sqlite3';

/**
 * Retry Handler with exponential backoff
 * Requirements: 8.1, 8.2
 */
export class RetryHandler {
  private db: Database.Database;
  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY_MS = 1000; // 1 second

  constructor(db: Database.Database) {
    this.db = db;
    this.initializeTable();
  }

  /**
   * Initialize the retry tracking table
   */
  private initializeTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS post_retries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        attempt_number INTEGER NOT NULL,
        next_retry_time INTEGER NOT NULL,
        error_message TEXT,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_post_retries_post_id 
      ON post_retries(post_id);
      
      CREATE INDEX IF NOT EXISTS idx_post_retries_next_retry 
      ON post_retries(next_retry_time);
    `);
  }

  /**
   * Record a failed attempt and calculate next retry time
   * Requirements: 8.2
   */
  recordFailedAttempt(postId: number, errorMessage: string): void {
    const attemptNumber = this.getAttemptCount(postId) + 1;
    
    // Calculate exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delaySeconds = Math.pow(2, attemptNumber - 1);
    const nextRetryTime = Math.floor(Date.now() / 1000) + delaySeconds;

    this.db.prepare(`
      INSERT INTO post_retries (post_id, attempt_number, next_retry_time, error_message)
      VALUES (?, ?, ?, ?)
    `).run(postId, attemptNumber, nextRetryTime, errorMessage);

    console.log(
      `[${new Date().toISOString()}] Post ${postId} retry scheduled: ` +
      `attempt ${attemptNumber}, next retry in ${delaySeconds}s`
    );
  }

  /**
   * Record a rate limit error with specific wait time
   * Requirements: 8.1
   */
  recordRateLimitError(postId: number, waitTimeSeconds: number, errorMessage: string): void {
    const attemptNumber = this.getAttemptCount(postId) + 1;
    const nextRetryTime = Math.floor(Date.now() / 1000) + waitTimeSeconds;

    this.db.prepare(`
      INSERT INTO post_retries (post_id, attempt_number, next_retry_time, error_message)
      VALUES (?, ?, ?, ?)
    `).run(postId, attemptNumber, nextRetryTime, errorMessage);

    console.log(
      `[${new Date().toISOString()}] Post ${postId} rate limited: ` +
      `waiting ${waitTimeSeconds}s before retry`
    );
  }

  /**
   * Get the number of retry attempts for a post
   */
  getAttemptCount(postId: number): number {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM post_retries
      WHERE post_id = ?
    `).get(postId) as { count: number };

    return result.count;
  }

  /**
   * Check if a post should be retried
   * Requirements: 8.2
   */
  shouldRetry(postId: number): boolean {
    const attemptCount = this.getAttemptCount(postId);
    
    if (attemptCount >= this.MAX_RETRIES) {
      return false;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    
    const result = this.db.prepare(`
      SELECT MAX(next_retry_time) as next_retry_time
      FROM post_retries
      WHERE post_id = ?
    `).get(postId) as { next_retry_time: number | null };

    if (!result.next_retry_time) {
      return true; // No retries yet, can retry
    }

    return currentTime >= result.next_retry_time;
  }

  /**
   * Check if max retries have been reached
   */
  hasExceededMaxRetries(postId: number): boolean {
    return this.getAttemptCount(postId) >= this.MAX_RETRIES;
  }

  /**
   * Clear retry history for a post (after successful publish)
   */
  clearRetries(postId: number): void {
    this.db.prepare(`
      DELETE FROM post_retries
      WHERE post_id = ?
    `).run(postId);
  }

  /**
   * Get posts that are ready for retry
   * Requirements: 8.2
   */
  getPostsReadyForRetry(): number[] {
    const currentTime = Math.floor(Date.now() / 1000);
    
    const rows = this.db.prepare(`
      SELECT DISTINCT post_id
      FROM post_retries
      WHERE next_retry_time <= ?
      GROUP BY post_id
      HAVING COUNT(*) < ?
    `).all(currentTime, this.MAX_RETRIES) as Array<{ post_id: number }>;

    return rows.map(row => row.post_id);
  }
}
