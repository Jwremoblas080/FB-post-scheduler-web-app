import Database from 'better-sqlite3';

/**
 * Rate Limiter for Facebook Graph API requests
 * Requirements: 8.3, 8.4
 */
export class RateLimiter {
  private db: Database.Database;
  private readonly MAX_REQUESTS_PER_HOUR = 200;
  private readonly NEAR_LIMIT_THRESHOLD = 180; // 90% of max

  constructor(db: Database.Database) {
    this.db = db;
    this.initializeTable();
  }

  /**
   * Initialize the rate limiting table
   */
  private initializeTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS api_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        endpoint TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_api_requests_user_timestamp 
      ON api_requests(user_id, timestamp);
    `);
  }

  /**
   * Record an API request
   * Requirements: 8.3
   */
  recordRequest(userId: number, endpoint: string): void {
    const timestamp = Math.floor(Date.now() / 1000);
    
    this.db.prepare(`
      INSERT INTO api_requests (user_id, timestamp, endpoint)
      VALUES (?, ?, ?)
    `).run(userId, timestamp, endpoint);

    // Clean up old records (older than 1 hour)
    this.cleanupOldRequests();
  }

  /**
   * Get the number of requests made by a user in the last hour
   * Requirements: 8.3
   */
  getRequestCount(userId: number): number {
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
    
    const result = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM api_requests
      WHERE user_id = ? AND timestamp > ?
    `).get(userId, oneHourAgo) as { count: number };

    return result.count;
  }

  /**
   * Check if user is approaching rate limit
   * Requirements: 8.4
   */
  isApproachingLimit(userId: number): boolean {
    const count = this.getRequestCount(userId);
    return count >= this.NEAR_LIMIT_THRESHOLD;
  }

  /**
   * Check if user has exceeded rate limit
   * Requirements: 8.3
   */
  hasExceededLimit(userId: number): boolean {
    const count = this.getRequestCount(userId);
    return count >= this.MAX_REQUESTS_PER_HOUR;
  }

  /**
   * Get time until rate limit resets (in seconds)
   * Requirements: 8.4
   */
  getTimeUntilReset(userId: number): number {
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
    
    const result = this.db.prepare(`
      SELECT MIN(timestamp) as oldest_timestamp
      FROM api_requests
      WHERE user_id = ? AND timestamp > ?
    `).get(userId, oneHourAgo) as { oldest_timestamp: number | null };

    if (!result.oldest_timestamp) {
      return 0;
    }

    const resetTime = result.oldest_timestamp + 3600;
    const now = Math.floor(Date.now() / 1000);
    
    return Math.max(0, resetTime - now);
  }

  /**
   * Clean up API request records older than 1 hour
   */
  private cleanupOldRequests(): void {
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
    
    this.db.prepare(`
      DELETE FROM api_requests
      WHERE timestamp <= ?
    `).run(oneHourAgo);
  }
}
