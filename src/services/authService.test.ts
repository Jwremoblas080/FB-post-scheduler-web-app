import { AuthenticationService } from './authService';
import axios from 'axios';
import Database from 'better-sqlite3';
import { AccessToken } from '../types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  let db: Database.Database;
  const mockAppId = 'test_app_id';
  const mockAppSecret = 'test_app_secret';
  const mockRedirectUri = 'http://localhost:3000/auth/callback';

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    
    // Create users table
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        facebook_user_id TEXT UNIQUE NOT NULL,
        access_token TEXT NOT NULL,
        token_expiry INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    authService = new AuthenticationService(mockAppId, mockAppSecret, mockRedirectUri, db);
    jest.clearAllMocks();
  });

  afterEach(() => {
    db.close();
  });

  describe('initiateLogin', () => {
    it('should generate OAuth redirect URL with correct parameters', () => {
      const url = authService.initiateLogin();

      expect(url).toContain('https://www.facebook.com/v18.0/dialog/oauth');
      expect(url).toContain(`client_id=${mockAppId}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(mockRedirectUri)}`);
      expect(url).toContain('scope=manage_pages%2Cpublish_pages');
      expect(url).toContain('response_type=code');
    });

    it('should request manage_pages and publish_pages permissions', () => {
      const url = authService.initiateLogin();

      expect(url).toContain('manage_pages');
      expect(url).toContain('publish_pages');
    });
  });

  describe('handleCallback', () => {
    it('should exchange authorization code for access token', async () => {
      const mockCode = 'test_auth_code';
      const mockAccessToken = 'test_access_token';
      const mockExpiresIn = 3600;

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          access_token: mockAccessToken,
          expires_in: mockExpiresIn
        }
      });

      const result = await authService.handleCallback(mockCode);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('https://graph.facebook.com/v18.0/oauth/access_token')
      );
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`client_id=${mockAppId}`)
      );
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`client_secret=${mockAppSecret}`)
      );
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`code=${mockCode}`)
      );

      expect(result.token).toBe(mockAccessToken);
      expect(result.expiry).toBeInstanceOf(Date);
    });

    it('should calculate correct expiry date', async () => {
      const mockCode = 'test_auth_code';
      const mockAccessToken = 'test_access_token';
      const mockExpiresIn = 3600; // 1 hour

      const beforeCall = new Date();

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          access_token: mockAccessToken,
          expires_in: mockExpiresIn
        }
      });

      const result = await authService.handleCallback(mockCode);

      const afterCall = new Date();
      const expectedExpiry = new Date(beforeCall.getTime() + mockExpiresIn * 1000);

      // Allow 1 second tolerance for test execution time
      expect(result.expiry.getTime()).toBeGreaterThanOrEqual(expectedExpiry.getTime() - 1000);
      expect(result.expiry.getTime()).toBeLessThanOrEqual(afterCall.getTime() + mockExpiresIn * 1000);
    });

    it('should throw error when Facebook returns error response', async () => {
      const mockCode = 'invalid_code';

      const axiosError = {
        isAxiosError: true,
        response: {
          data: {
            error: {
              message: 'Invalid authorization code'
            }
          }
        }
      };

      mockedAxios.get.mockRejectedValueOnce(axiosError);
      (axios.isAxiosError as unknown as jest.Mock) = jest.fn().mockReturnValue(true);

      await expect(authService.handleCallback(mockCode)).rejects.toThrow(
        'Facebook OAuth error: Invalid authorization code'
      );
    });

    it('should throw error when network request fails', async () => {
      const mockCode = 'test_code';

      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
      (axios.isAxiosError as unknown as jest.Mock) = jest.fn().mockReturnValue(false);

      await expect(authService.handleCallback(mockCode)).rejects.toThrow(
        'Failed to exchange authorization code: Network error'
      );
    });

    it('should handle missing error message in Facebook response', async () => {
      const mockCode = 'invalid_code';

      const axiosError = {
        isAxiosError: true,
        response: {
          data: {
            error: {}
          }
        }
      };

      mockedAxios.get.mockRejectedValueOnce(axiosError);
      (axios.isAxiosError as unknown as jest.Mock) = jest.fn().mockReturnValue(true);

      await expect(authService.handleCallback(mockCode)).rejects.toThrow(
        'Facebook OAuth error: Unknown error'
      );
    });
  });

  describe('storeToken', () => {
    it('should store encrypted token in database for new user', () => {
      const facebookUserId = 'fb_user_123';
      const accessToken: AccessToken = {
        token: 'test_access_token',
        expiry: new Date(Date.now() + 3600000) // 1 hour from now
      };

      authService.storeToken(facebookUserId, accessToken);

      const row = db.prepare('SELECT * FROM users WHERE facebook_user_id = ?').get(facebookUserId) as any;
      
      expect(row).toBeDefined();
      expect(row.facebook_user_id).toBe(facebookUserId);
      expect(row.access_token).not.toBe(accessToken.token); // Should be encrypted
      expect(row.access_token).toBeTruthy();
    });

    it('should update token for existing user', () => {
      const facebookUserId = 'fb_user_123';
      const firstToken: AccessToken = {
        token: 'first_token',
        expiry: new Date(Date.now() + 3600000)
      };
      const secondToken: AccessToken = {
        token: 'second_token',
        expiry: new Date(Date.now() + 7200000)
      };

      authService.storeToken(facebookUserId, firstToken);
      authService.storeToken(facebookUserId, secondToken);

      const rows = db.prepare('SELECT * FROM users WHERE facebook_user_id = ?').all(facebookUserId);
      
      expect(rows).toHaveLength(1); // Should only have one record
      
      const retrieved = authService.getStoredToken(facebookUserId);
      expect(retrieved?.token).toBe(secondToken.token);
    });

    it('should store token expiry as unix timestamp', () => {
      const facebookUserId = 'fb_user_123';
      const expiry = new Date('2024-12-31T23:59:59Z');
      const accessToken: AccessToken = {
        token: 'test_token',
        expiry: expiry
      };

      authService.storeToken(facebookUserId, accessToken);

      const row = db.prepare('SELECT token_expiry FROM users WHERE facebook_user_id = ?').get(facebookUserId) as any;
      
      expect(row.token_expiry).toBe(Math.floor(expiry.getTime() / 1000));
    });
  });

  describe('getStoredToken', () => {
    it('should retrieve and decrypt stored token', () => {
      const facebookUserId = 'fb_user_123';
      const accessToken: AccessToken = {
        token: 'my_secret_token',
        expiry: new Date(Date.now() + 3600000)
      };

      authService.storeToken(facebookUserId, accessToken);
      const retrieved = authService.getStoredToken(facebookUserId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.token).toBe(accessToken.token);
      // Compare timestamps in seconds (database stores as unix timestamp in seconds)
      expect(Math.floor(retrieved!.expiry.getTime() / 1000)).toBe(Math.floor(accessToken.expiry.getTime() / 1000));
    });

    it('should return null for non-existent user', () => {
      const retrieved = authService.getStoredToken('non_existent_user');
      
      expect(retrieved).toBeNull();
    });

    it('should correctly convert unix timestamp back to Date', () => {
      const facebookUserId = 'fb_user_123';
      const expiry = new Date('2025-06-15T12:00:00Z');
      const accessToken: AccessToken = {
        token: 'test_token',
        expiry: expiry
      };

      authService.storeToken(facebookUserId, accessToken);
      const retrieved = authService.getStoredToken(facebookUserId);

      expect(retrieved?.expiry.getTime()).toBe(expiry.getTime());
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for expired token', () => {
      const expiredToken: AccessToken = {
        token: 'expired_token',
        expiry: new Date(Date.now() - 1000) // 1 second ago
      };

      expect(authService.isTokenExpired(expiredToken)).toBe(true);
    });

    it('should return false for valid token', () => {
      const validToken: AccessToken = {
        token: 'valid_token',
        expiry: new Date(Date.now() + 3600000) // 1 hour from now
      };

      expect(authService.isTokenExpired(validToken)).toBe(false);
    });

    it('should return true for token expiring exactly now', () => {
      const now = new Date();
      const expiringToken: AccessToken = {
        token: 'expiring_token',
        expiry: now
      };

      expect(authService.isTokenExpired(expiringToken)).toBe(true);
    });
  });

  describe('getValidToken', () => {
    it('should return token if it exists and is not expired', () => {
      const facebookUserId = 'fb_user_123';
      const accessToken: AccessToken = {
        token: 'valid_token',
        expiry: new Date(Date.now() + 3600000)
      };

      authService.storeToken(facebookUserId, accessToken);
      const retrieved = authService.getValidToken(facebookUserId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.token).toBe(accessToken.token);
    });

    it('should return null if token is expired', () => {
      const facebookUserId = 'fb_user_123';
      const expiredToken: AccessToken = {
        token: 'expired_token',
        expiry: new Date(Date.now() - 1000)
      };

      authService.storeToken(facebookUserId, expiredToken);
      const retrieved = authService.getValidToken(facebookUserId);

      expect(retrieved).toBeNull();
    });

    it('should return null if user does not exist', () => {
      const retrieved = authService.getValidToken('non_existent_user');
      
      expect(retrieved).toBeNull();
    });
  });
});
