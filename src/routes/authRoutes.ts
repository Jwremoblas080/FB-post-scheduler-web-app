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
    if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
      res.status(500).json({
        error: true,
        message: 'Facebook App ID or Secret not configured. Check your .env file.',
        code: 'MISSING_CONFIG'
      });
      return;
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
    const facebookUserId = accessToken.token;

    // Store the access token in database, get back the user id
    const userId = authService.storeToken(facebookUserId, accessToken);

    // Fetch and cache pages while we have a live connection (best-effort)
    try {
      const pages = await graphApiClient.getPages(accessToken.token);
      authService.storePages(userId, pages);
    } catch (pageErr) {
      console.warn('Could not fetch pages during OAuth (will retry on /auth/pages):', (pageErr as Error).message);
    }

    // Redirect browser to frontend callback route to show success
    res.redirect(`${frontendUrl}/auth/callback`);
  } catch (error: any) {
    const desc = encodeURIComponent(error.message || 'Failed to complete authentication');
    res.redirect(`${frontendUrl}/auth/callback?error=auth_failed&error_description=${desc}`);
  }
});

/**
 * GET /auth/pages
 * Retrieve user's Facebook Pages — served from DB cache, live API as fallback
 * Requirements: 2.1
 */
router.get('/pages', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Try cached pages first (no network needed)
    const cached = authService.getCachedPages();
    if (cached.length > 0) {
      res.json({ success: true, pages: cached });
      return;
    }

    // No cache — check if user exists at all
    const row = (db as any).prepare(
      'SELECT id, facebook_user_id FROM users ORDER BY created_at DESC LIMIT 1'
    ).get() as { id: number; facebook_user_id: string } | undefined;

    if (!row) {
      res.status(401).json({
        error: true,
        message: 'Not connected. Please connect with Facebook first.',
        code: 'MISSING_ACCESS_TOKEN'
      });
      return;
    }

    // User exists but no cached pages — need to re-authenticate to fetch pages
    // Return empty pages with a hint so the frontend can prompt re-auth
    res.json({
      success: true,
      pages: [],
      hint: 'Please reconnect with Facebook to load your pages.'
    });
  } catch (error: any) {
    const isNetworkError = error.message?.includes('ENOTFOUND') ||
                           error.message?.includes('ECONNREFUSED') ||
                           error.message?.includes('network');
    res.status(isNetworkError ? 503 : 500).json({
      error: true,
      message: isNetworkError
        ? 'Cannot reach Facebook API. Check your internet connection.'
        : 'Failed to retrieve Facebook Pages',
      code: isNetworkError ? 'NETWORK_ERROR' : 'PAGES_RETRIEVAL_FAILED',
      details: error.message
    });
  }
});

// Initialize services on module load - will be overridden by initializeAuthRoutes(db) from index.ts
// initializeAuthRoutes();

export default router;
