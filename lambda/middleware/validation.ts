import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize input middleware - removes potentially malicious content
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

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

function sanitizeValue(value: any): any {
  if (typeof value !== 'string') {
    return value;
  }

  // Use DOMPurify to sanitize HTML/XSS
  return DOMPurify.sanitize(value, { ALLOWED_TAGS: [] });
}

/**
 * Validate media URLs - ensure they're from our S3 bucket
 */
export function validateMediaUrls(urls: string[]): boolean {
  const S3_BUCKET = process.env.S3_BUCKET;
  if (!S3_BUCKET) return false;

  const validPattern = new RegExp(`^https://${S3_BUCKET}\\.s3\\.[a-z0-9-]+\\.amazonaws\\.com/`);
  
  return urls.every(url => {
    try {
      return validPattern.test(url);
    } catch {
      return false;
    }
  });
}

/**
 * Validate page ID format
 */
export function validatePageId(pageId: string): boolean {
  // Facebook page IDs are numeric strings
  return /^\d+$/.test(pageId);
}
