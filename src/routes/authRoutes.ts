import { Router, Request, Response } from 'express';
import { AuthenticationService } from '../services/authService';
import { GraphApiClient } from '../services/graphApiClient';
import { getDatabase } from '../database/init';
import Database from 'better-sqlite3';

const router = Router();

// Initialize database and services
let db: Database.Database;
let authService: AuthenticationService;
let graphApiClient: GraphApiClient;

// Initialize services with database
export function initializeAuthRoutes(database?: Database.Database) {
  db = database || getDatabase();
  authService = new AuthenticationService(
    process.env.FACEBOOK_APP_ID || '',
    process.env.FACEBOOK_APP_SECRET || '',
    process.env.FACEBOOK_REDIRECT_URI || '',
    db
  );
  graphApiClient = new GraphApiClient();
}

/**
 * POST /auth/login
 * Initiate Facebook OAuth flow
 * Requirements: 1.1
 */
router.post('/login', (_req: Request, res: Response) => {
  try {
    if (!authService) {
      initializeAuthRoutes();
    }
    const redirectUrl = authService.initiateLogin();
    res.json({ redirectUrl });
  } catch (error: any) {
    res.status(500).json({
      error: true,
      message: 'Failed to initiate login',
      code: 'LOGIN_INIT_FAILED',
      details: error.message
    });
  }
});

/**
 * GET /auth/callback
 * Handle Facebook OAuth callback
 * Requirements: 1.2
 */
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    const { code, error: oauthError, error_description, error_code, error_message } = req.query;

    if (oauthError || error_code) {
      const errMsg = error_description || error_message || oauthError || 'OAuth error';
      const desc = encodeURIComponent(errMsg as string);
      res.redirect(`${frontendUrl}/auth/callback?error=${oauthError || error_code}&error_description=${desc}`);
      return;
    }

    if (!code || typeof code !== 'string') {
      res.redirect(`${frontendUrl}/auth/callback?error=missing_code&error_description=${encodeURIComponent('Authorization code is required')}`);
      return;
    }

    const accessToken = await authService.handleCallback(code);

    // Use the access token itself as a unique identifier for the user.
    // The token is unique per user/session and avoids an extra Graph API call.
    const facebookUserId = accessToken.token;

    // Store the access token in database
    authService.storeToken(facebookUserId, accessToken);

    // Redirect browser to frontend callback route to show success
    res.redirect(`${frontendUrl}/auth/callback`);
  } catch (error: any) {
    const desc = encodeURIComponent(error.message || 'Failed to complete authentication');
    res.redirect(`${frontendUrl}/auth/callback?error=auth_failed&error_description=${desc}`);
  }
});

/**
 * GET /auth/pages
 * Retrieve user's Facebook Pages
 * Requirements: 2.1
 */
router.get('/pages', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Single-user app: retrieve the most recently stored token from the database
    const row = (db as any).prepare(
      'SELECT facebook_user_id FROM users ORDER BY created_at DESC LIMIT 1'
    ).get() as { facebook_user_id: string } | undefined;

    if (!row) {
      res.status(401).json({
        error: true,
        message: 'Access token not found. Please log in again.',
        code: 'MISSING_ACCESS_TOKEN'
      });
      return;
    }

    const accessToken = authService.getStoredToken(row.facebook_user_id);

    if (!accessToken) {
      res.status(401).json({
        error: true,
        message: 'Access token not found. Please log in again.',
        code: 'MISSING_ACCESS_TOKEN'
      });
      return;
    }

    // Retrieve Facebook Pages using Graph API
    const pages = await graphApiClient.getPages(accessToken.token);

    res.json({
      success: true,
      pages: pages
    });
  } catch (error: any) {
    res.status(500).json({
      error: true,
      message: 'Failed to retrieve Facebook Pages',
      code: 'PAGES_RETRIEVAL_FAILED',
      details: error.message
    });
  }
});

// Initialize services on module load - will be overridden by initializeAuthRoutes(db) from index.ts
// initializeAuthRoutes();

export default router;
