import request from 'supertest';
import express from 'express';
import authRoutes, { initializeAuthRoutes } from './authRoutes';
import { initializeDatabase } from '../database/init';
import Database from 'better-sqlite3';

describe('Authentication Routes', () => {
  let app: express.Application;
  let db: Database.Database;

  beforeAll(() => {
    // Set environment variables BEFORE initializing routes
    process.env.FACEBOOK_APP_ID = 'test_app_id';
    process.env.FACEBOOK_APP_SECRET = 'test_app_secret';
    process.env.FACEBOOK_REDIRECT_URI = 'http://localhost:3000/auth/callback';
    
    // Use in-memory database for testing
    db = initializeDatabase(':memory:');
    
    // Initialize routes with test database
    initializeAuthRoutes(db);
    
    // Set up Express app
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
  });

  afterAll(() => {
    db.close();
  });

  describe('POST /auth/login', () => {
    it('should return a redirect URL for Facebook OAuth', async () => {
      const response = await request(app)
        .post('/auth/login')
        .expect(200);

      expect(response.body).toHaveProperty('redirectUrl');
      expect(response.body.redirectUrl).toContain('facebook.com');
      expect(response.body.redirectUrl).toContain('test_app_id');
      expect(response.body.redirectUrl).toContain('manage_pages');
      expect(response.body.redirectUrl).toContain('publish_pages');
    });
  });

  describe('GET /auth/callback', () => {
    it('should return 400 when authorization code is missing', async () => {
      const response = await request(app)
        .get('/auth/callback')
        .expect(400);

      expect(response.body).toHaveProperty('error', true);
      expect(response.body).toHaveProperty('code', 'MISSING_AUTH_CODE');
    });

    it('should return 400 when authorization code is not a string', async () => {
      const response = await request(app)
        .get('/auth/callback?code[]=invalid')
        .expect(400);

      expect(response.body).toHaveProperty('error', true);
      expect(response.body).toHaveProperty('code', 'MISSING_AUTH_CODE');
    });

    // Note: Testing successful callback requires mocking Facebook API
    // which is beyond the scope of this basic route test
  });

  describe('GET /auth/pages', () => {
    it('should return 401 when access token is missing', async () => {
      const response = await request(app)
        .get('/auth/pages')
        .expect(401);

      expect(response.body).toHaveProperty('error', true);
      expect(response.body).toHaveProperty('code', 'MISSING_ACCESS_TOKEN');
    });

    it('should return 401 when Authorization header is malformed', async () => {
      const response = await request(app)
        .get('/auth/pages')
        .set('Authorization', 'InvalidFormat token123')
        .expect(401);

      expect(response.body).toHaveProperty('error', true);
      expect(response.body).toHaveProperty('code', 'MISSING_ACCESS_TOKEN');
    });

    // Note: Testing successful page retrieval requires mocking Facebook API
    // which is beyond the scope of this basic route test
  });
});
