import request from 'supertest';
import express, { Request, Response } from 'express';
import {
  sanitizeInput,
  excludeTokensFromResponse,
  getCorsOptions
} from './security';
import cors from 'cors';

describe('Security Middleware Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Input Sanitization Integration', () => {
    it('should sanitize malicious input in POST request', async () => {
      app.use(sanitizeInput);
      app.post('/test', (req: Request, res: Response) => {
        res.json({ received: req.body });
      });

      const response = await request(app)
        .post('/test')
        .send({ message: '<script>alert("xss")</script>Hello' })
        .expect(200);

      expect(response.body.received.message).not.toContain('<script>');
      expect(response.body.received.message).toContain('Hello');
    });

    it('should sanitize SQL injection patterns', async () => {
      app.use(sanitizeInput);
      app.post('/test', (req: Request, res: Response) => {
        res.json({ received: req.body });
      });

      const response = await request(app)
        .post('/test')
        .send({ query: "'; DROP TABLE users; --" })
        .expect(200);

      expect(response.body.received.query).not.toContain('DROP');
      expect(response.body.received.query).not.toContain('--');
    });
  });

  describe('Token Exclusion Integration', () => {
    it('should exclude tokens from API responses', async () => {
      app.use(excludeTokensFromResponse);
      app.get('/test', (_req: Request, res: Response) => {
        res.json({
          user: 'john',
          access_token: 'secret123',
          refresh_token: 'refresh456',
          data: 'public'
        });
      });

      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.body.user).toBe('john');
      expect(response.body.data).toBe('public');
      expect(response.body.access_token).toBeUndefined();
      expect(response.body.refresh_token).toBeUndefined();
    });

    it('should exclude nested tokens', async () => {
      app.use(excludeTokensFromResponse);
      app.get('/test', (_req: Request, res: Response) => {
        res.json({
          user: {
            name: 'john',
            token: 'secret123'
          },
          data: 'public'
        });
      });

      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.body.user.name).toBe('john');
      expect(response.body.user.token).toBeUndefined();
      expect(response.body.data).toBe('public');
    });
  });

  describe('CORS Integration', () => {
    it('should allow requests from allowed origins', async () => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
      app.use(cors(getCorsOptions()));
      app.get('/test', (_req: Request, res: Response) => {
        res.json({ message: 'success' });
      });

      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.body.message).toBe('success');
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
  });

  describe('Combined Security Middleware', () => {
    it('should apply all security measures together', async () => {
      app.use(sanitizeInput);
      app.use(excludeTokensFromResponse);
      app.post('/test', (req: Request, res: Response) => {
        res.json({
          received: req.body,
          access_token: 'should_be_removed',
          status: 'success'
        });
      });

      const response = await request(app)
        .post('/test')
        .send({ message: '<script>alert("xss")</script>Safe text' })
        .expect(200);

      // Input should be sanitized
      expect(response.body.received.message).not.toContain('<script>');
      expect(response.body.received.message).toContain('Safe text');

      // Token should be excluded
      expect(response.body.access_token).toBeUndefined();
      expect(response.body.status).toBe('success');
    });
  });
});
