import axios from 'axios';
import Database from 'better-sqlite3';
import { AccessToken } from '../types';
import { encrypt, decrypt } from '../utils/encryption';

export class AuthenticationService {
  private appId: string;
  private appSecret: string;
  private redirectUri: string;
  private db: Database.Database;

  constructor(appId: string, appSecret: string, redirectUri: string, db: Database.Database) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.redirectUri = redirectUri;
    this.db = db;
  }

  /**
   * Generate Facebook OAuth redirect URL
   * Requirements: 1.1, 1.5
   */
  initiateLogin(): string {
    const permissions = ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'];
    const scope = permissions.join(',');
    
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      scope: scope,
      response_type: 'code'
    });

    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * Requirements: 1.2
   */
  async handleCallback(code: string): Promise<AccessToken> {
    try {
      const params = new URLSearchParams({
        client_id: this.appId,
        client_secret: this.appSecret,
        redirect_uri: this.redirectUri,
        code: code
      });

      const response = await axios.get(
        `https://graph.facebook.com/v18.0/oauth/access_token?${params.toString()}`
      );

      const { access_token, expires_in } = response.data;

      // Calculate expiry date — default to 60 days if expires_in not provided
      const expiry = new Date();
      expiry.setSeconds(expiry.getSeconds() + (expires_in || 60 * 24 * 60 * 60));

      return {
        token: access_token,
        expiry: expiry
      };
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data;
        throw new Error(
          `Facebook OAuth error: ${errorData.error?.message || 'Unknown error'}`
        );
      }
      throw new Error(`Failed to exchange authorization code: ${error.message}`);
    }
  }

  /**
   * Store access token with encryption in the database
   * Requirements: 1.3, 9.1
   */
  storeToken(facebookUserId: string, accessToken: AccessToken): number {
    const encryptedToken = encrypt(accessToken.token);
    const tokenExpiryTimestamp = Math.floor(accessToken.expiry.getTime() / 1000);
    const createdAtTimestamp = Math.floor(Date.now() / 1000);

    // Check if user already exists
    const existingUser = this.db.prepare(
      'SELECT id FROM users WHERE facebook_user_id = ?'
    ).get(facebookUserId) as { id: number } | undefined;

    if (existingUser) {
      this.db.prepare(`
        UPDATE users 
        SET access_token = ?, token_expiry = ?
        WHERE facebook_user_id = ?
      `).run(encryptedToken, tokenExpiryTimestamp, facebookUserId);
      return existingUser.id;
    } else {
      const result = this.db.prepare(`
        INSERT INTO users (facebook_user_id, access_token, token_expiry, created_at)
        VALUES (?, ?, ?, ?)
      `).run(facebookUserId, encryptedToken, tokenExpiryTimestamp, createdAtTimestamp);
      return result.lastInsertRowid as number;
    }
  }

  /**
   * Cache Facebook Pages for a user so they can be served without a live API call
   */
  storePages(userId: number, pages: Array<{ id: string; name: string; accessToken: string }>): void {
    const now = Math.floor(Date.now() / 1000);
    // Delete old pages for this user first
    this.db.prepare('DELETE FROM pages WHERE user_id = ?').run(userId);
    const insert = this.db.prepare(`
      INSERT INTO pages (user_id, page_id, page_name, page_access_token, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const page of pages) {
      insert.run(userId, page.id, page.name, encrypt(page.accessToken), now);
    }
  }

  /**
   * Retrieve cached pages for the most recent user
   */
  getCachedPages(): Array<{ id: string; name: string }> {
    const rows = this.db.prepare(`
      SELECT p.page_id, p.page_name
      FROM pages p
      INNER JOIN users u ON u.id = p.user_id
      ORDER BY u.created_at DESC
    `).all() as Array<{ page_id: string; page_name: string }>;
    return rows.map(r => ({ id: r.page_id, name: r.page_name }));
  }

  /**
   * Retrieve cached page access token by page_id
   */
  getCachedPageToken(pageId: string): string | null {
    const row = this.db.prepare(
      'SELECT page_access_token FROM pages WHERE page_id = ?'
    ).get(pageId) as { page_access_token: string } | undefined;
    if (!row) return null;
    try { return decrypt(row.page_access_token); } catch { return null; }
  }

  /**
   * Retrieve and decrypt stored access token
   * Requirements: 1.3, 9.1
   */
  getStoredToken(facebookUserId: string): AccessToken | null {
    const row = this.db.prepare(`
      SELECT access_token, token_expiry 
      FROM users 
      WHERE facebook_user_id = ?
    `).get(facebookUserId) as { access_token: string; token_expiry: number } | undefined;

    if (!row) {
      return null;
    }

    const decryptedToken = decrypt(row.access_token);
    const expiry = new Date(row.token_expiry * 1000);

    return {
      token: decryptedToken,
      expiry: expiry
    };
  }

  /**
   * Check if a token is expired
   * Requirements: 1.4
   */
  isTokenExpired(accessToken: AccessToken): boolean {
    const now = new Date();
    return accessToken.expiry <= now;
  }

  /**
   * Get stored token and check if it's expired
   * Returns null if token doesn't exist or is expired
   * Requirements: 1.3, 1.4
   */
  getValidToken(facebookUserId: string): AccessToken | null {
    const token = this.getStoredToken(facebookUserId);
    
    if (!token) {
      return null;
    }

    if (this.isTokenExpired(token)) {
      return null;
    }

    return token;
  }
}
