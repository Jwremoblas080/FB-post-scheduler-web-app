import { Request, Response, NextFunction } from 'express';
import {
  enforceHttps,
  sanitizeInput,
  excludeTokensFromResponse,
  getCorsOptions
} from './security';

describe('Security Middleware', () => {
  let mockReq: any;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      secure: false,
      url: '/test',
      body: {},
      query: {},
      params: {}
    };
    mockRes = {
      redirect: jest.fn(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  describe('enforceHttps', () => {
    it('should skip HTTPS enforcement in development', () => {
      process.env.NODE_ENV = 'development';
      enforceHttps(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    it('should skip HTTPS enforcement if request is already secure', () => {
      process.env.NODE_ENV = 'production';
      mockReq.secure = true;
      enforceHttps(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    it('should skip HTTPS enforcement if x-forwarded-proto is https', () => {
      process.env.NODE_ENV = 'production';
      mockReq.headers = { 'x-forwarded-proto': 'https' };
      enforceHttps(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    it('should redirect HTTP to HTTPS in production', () => {
      process.env.NODE_ENV = 'production';
      mockReq.secure = false;
      mockReq.headers = { host: 'example.com' };
      mockReq.url = '/test';
      enforceHttps(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.redirect).toHaveBeenCalledWith(301, 'https://example.com/test');
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize script tags from body', () => {
      mockReq.body = {
        caption: 'Hello <script>alert("xss")</script> World'
      };
      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
      expect(mockReq.body.caption).toBe('Hello  World');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize event handlers from body', () => {
      mockReq.body = {
        caption: '<div onclick="alert(1)">Click me</div>'
      };
      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
      expect(mockReq.body.caption).not.toContain('onclick');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize SQL injection patterns from body', () => {
      mockReq.body = {
        caption: "'; DROP TABLE users; --"
      };
      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
      expect(mockReq.body.caption).not.toContain('DROP');
      expect(mockReq.body.caption).not.toContain('--');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize query parameters', () => {
      mockReq.query = {
        search: '<script>alert("xss")</script>'
      };
      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
      expect(mockReq.query.search).toBe('');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize URL parameters', () => {
      mockReq.params = {
        id: "1' OR '1'='1"
      };
      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
      // The sanitization should remove SQL keywords and special characters
      expect(mockReq.params.id).not.toContain("'");
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle nested objects', () => {
      mockReq.body = {
        user: {
          name: '<script>alert("xss")</script>',
          bio: 'Normal text'
        }
      };
      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
      expect(mockReq.body.user.name).toBe('');
      expect(mockReq.body.user.bio).toBe('Normal text');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle arrays', () => {
      mockReq.body = {
        tags: ['<script>alert(1)</script>', 'safe tag', 'DROP TABLE']
      };
      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
      expect(mockReq.body.tags[0]).toBe('');
      expect(mockReq.body.tags[1]).toBe('safe tag');
      expect(mockReq.body.tags[2]).not.toContain('DROP');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should preserve non-string values', () => {
      mockReq.body = {
        count: 42,
        active: true,
        data: null
      };
      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
      expect(mockReq.body.count).toBe(42);
      expect(mockReq.body.active).toBe(true);
      expect(mockReq.body.data).toBe(null);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('excludeTokensFromResponse', () => {
    it('should exclude access_token from response', () => {
      const responseData = {
        user: 'john',
        access_token: 'secret123',
        data: 'public'
      };

      let filteredData: any;
      mockRes.json = jest.fn((body: any) => {
        filteredData = body;
        return mockRes as Response;
      });

      excludeTokensFromResponse(mockReq as Request, mockRes as Response, mockNext);
      (mockRes.json as jest.Mock)(responseData);

      expect(filteredData).toBeDefined();
      expect(filteredData.user).toBe('john');
      expect(filteredData.data).toBe('public');
      expect(filteredData.access_token).toBeUndefined();
    });

    it('should exclude fields with "token" in the name', () => {
      const responseData = {
        user: 'john',
        accessToken: 'secret123',
        refresh_token: 'refresh456',
        data: 'public'
      };

      let filteredData: any;
      mockRes.json = jest.fn((body: any) => {
        filteredData = body;
        return mockRes as Response;
      });

      excludeTokensFromResponse(mockReq as Request, mockRes as Response, mockNext);
      (mockRes.json as jest.Mock)(responseData);

      expect(filteredData).toBeDefined();
      expect(filteredData.user).toBe('john');
      expect(filteredData.data).toBe('public');
      expect(filteredData.accessToken).toBeUndefined();
      expect(filteredData.refresh_token).toBeUndefined();
    });

    it('should exclude fields with "secret" in the name', () => {
      const responseData = {
        user: 'john',
        client_secret: 'secret123',
        data: 'public'
      };

      let filteredData: any;
      mockRes.json = jest.fn((body: any) => {
        filteredData = body;
        return mockRes as Response;
      });

      excludeTokensFromResponse(mockReq as Request, mockRes as Response, mockNext);
      (mockRes.json as jest.Mock)(responseData);

      expect(filteredData).toBeDefined();
      expect(filteredData.user).toBe('john');
      expect(filteredData.data).toBe('public');
      expect(filteredData.client_secret).toBeUndefined();
    });

    it('should exclude fields with "password" in the name', () => {
      const responseData = {
        user: 'john',
        password: 'pass123',
        data: 'public'
      };

      let filteredData: any;
      mockRes.json = jest.fn((body: any) => {
        filteredData = body;
        return mockRes as Response;
      });

      excludeTokensFromResponse(mockReq as Request, mockRes as Response, mockNext);
      (mockRes.json as jest.Mock)(responseData);

      expect(filteredData).toBeDefined();
      expect(filteredData.user).toBe('john');
      expect(filteredData.data).toBe('public');
      expect(filteredData.password).toBeUndefined();
    });

    it('should handle nested objects', () => {
      const responseData = {
        user: {
          name: 'john',
          access_token: 'secret123'
        },
        data: 'public'
      };

      let filteredData: any;
      mockRes.json = jest.fn((body: any) => {
        filteredData = body;
        return mockRes as Response;
      });

      excludeTokensFromResponse(mockReq as Request, mockRes as Response, mockNext);
      (mockRes.json as jest.Mock)(responseData);

      expect(filteredData).toBeDefined();
      expect(filteredData.user.name).toBe('john');
      expect(filteredData.user.access_token).toBeUndefined();
      expect(filteredData.data).toBe('public');
    });

    it('should handle arrays', () => {
      const responseData = {
        users: [
          { name: 'john', token: 'secret1' },
          { name: 'jane', token: 'secret2' }
        ]
      };

      let filteredData: any;
      mockRes.json = jest.fn((body: any) => {
        filteredData = body;
        return mockRes as Response;
      });

      excludeTokensFromResponse(mockReq as Request, mockRes as Response, mockNext);
      (mockRes.json as jest.Mock)(responseData);

      expect(filteredData).toBeDefined();
      expect(filteredData.users[0].name).toBe('john');
      expect(filteredData.users[0].token).toBeUndefined();
      expect(filteredData.users[1].name).toBe('jane');
      expect(filteredData.users[1].token).toBeUndefined();
    });
  });

  describe('getCorsOptions', () => {
    it('should allow requests from allowed origins', (done) => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://example.com';
      const corsOptions = getCorsOptions();

      if (typeof corsOptions.origin === 'function') {
        corsOptions.origin('http://localhost:3000', (err, allow) => {
          expect(err).toBeNull();
          expect(allow).toBe(true);
          done();
        });
      }
    });

    it('should reject requests from disallowed origins', (done) => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
      const corsOptions = getCorsOptions();

      if (typeof corsOptions.origin === 'function') {
        corsOptions.origin('http://evil.com', (err) => {
          expect(err).toBeInstanceOf(Error);
          expect(err?.message).toBe('Not allowed by CORS');
          done();
        });
      }
    });

    it('should allow requests with no origin', (done) => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
      const corsOptions = getCorsOptions();

      if (typeof corsOptions.origin === 'function') {
        corsOptions.origin(undefined, (err, allow) => {
          expect(err).toBeNull();
          expect(allow).toBe(true);
          done();
        });
      }
    });

    it('should have correct CORS configuration', () => {
      const corsOptions = getCorsOptions();
      expect(corsOptions.credentials).toBe(true);
      expect(corsOptions.methods).toEqual(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);
      expect(corsOptions.allowedHeaders).toEqual(['Content-Type', 'Authorization']);
      expect(corsOptions.maxAge).toBe(86400);
    });
  });
});
