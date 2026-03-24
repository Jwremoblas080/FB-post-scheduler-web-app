import { Request, Response, NextFunction } from 'express';

/**
 * HTTPS Enforcement Middleware
 * Requirement 9.3: Use HTTPS for all communication
 */
export function enforceHttps(req: Request, res: Response, next: NextFunction): void {
  // Skip HTTPS enforcement in development or if already secure
  if (process.env.NODE_ENV === 'development' || req.secure || req.headers['x-forwarded-proto'] === 'https') {
    return next();
  }

  // Redirect HTTP to HTTPS
  res.redirect(301, `https://${req.headers.host}${req.url}`);
}

/**
 * Input Sanitization Middleware
 * Requirement 9.4: Validate and sanitize all user inputs
 */
// Paths where query params must not be sanitized (OAuth codes, tokens, etc.)
const SKIP_QUERY_SANITIZE_PATHS = ['/auth/callback'];

export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Skip query param sanitization for OAuth callback — the code param must be passed as-is
  if (!SKIP_QUERY_SANITIZE_PATHS.includes(req.path)) {
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }
  }

  // Sanitize URL parameters
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  next();
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeValue(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      sanitized[key] = sanitizeObject(obj[key]);
    }
  }
  return sanitized;
}

/**
 * Sanitize a single value
 * Removes potentially malicious content like script tags and SQL injection patterns
 */
function sanitizeValue(value: any): any {
  if (typeof value !== 'string') {
    return value;
  }

  // Remove script tags and event handlers
  let sanitized = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove common SQL injection patterns (basic protection)
  sanitized = sanitized.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi, '');
  sanitized = sanitized.replace(/(-{2}|\/\*|\*\/|;|')/g, '');

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  return sanitized;
}

/**
 * Token Exclusion Middleware
 * Requirement 9.2: Do not expose access tokens in API responses or logs
 */
export function excludeTokensFromResponse(_req: Request, res: Response, next: NextFunction): void {
  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method to filter tokens
  res.json = function(body: any): Response {
    if (body && typeof body === 'object') {
      body = removeTokens(body);
    }
    return originalJson(body);
  };

  next();
}

/**
 * Recursively remove token fields from response objects
 */
function removeTokens(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeTokens(item));
  }

  const filtered: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      // Skip token-related fields
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('password')) {
        continue; // Exclude this field
      }
      filtered[key] = removeTokens(obj[key]);
    }
  }
  return filtered;
}

/**
 * CORS Configuration
 * Requirement 9.5: Implement CORS policies to restrict API access
 */
export function getCorsOptions() {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    maxAge: 86400 // 24 hours
  };
}
