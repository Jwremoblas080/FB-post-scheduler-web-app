# Facebook Post Scheduler - Feature Summary

## User Portal

**Post Creation** — create scheduled posts with caption editor (63,206 char limit with counter), media type toggle (images/video), drag-and-drop upload zone with previews. Multi-image support (up to 10 images, 20MB each). Video support (100MB max). Page selector with Facebook OAuth integration. Quick-pick scheduling buttons (Tomorrow 9am/12pm/6pm, Mon 10am, Sat 11am). Ctrl+Enter to submit.

**Post Management** — view all posts in table with status badges (Pending/Posted/Failed), scheduled time display, media thumbnails. Edit caption, scheduled time, or target page for pending posts. Delete pending/failed posts (posted posts locked). Retry failed posts with automatic time bump if past due. Real-time status updates.

**Authentication** — OAuth 2.0 flow with Facebook. JWT token stored in localStorage. Auto-redirect to callback handler. Token refresh on 401 responses. Disconnect option to clear all user data.

## Backend Services

**API Handler** — Express.js Lambda with serverless-http wrapper. Routes: auth (login/callback/pages/disconnect), uploads (images/video/presigned-urls), posts (CRUD + retry). JWT middleware for protected routes. Rate limiting (100 req/15min general, 20 uploads/15min, 10 auth/15min). Input sanitization middleware. Security headers (CSP, XSS, HSTS, frame options).

**Scheduler Service** — cron Lambda runs every minute. Queries DynamoDB for pending posts due now. Publishes to Facebook Graph API with retry logic (3 attempts, exponential backoff). Updates post status (posted/failed) with error messages. Handles both image and video posts. Page access token validation.

**Storage** — DynamoDB single-table design with PK/SK pattern. GSI for time-based queries. User records with encrypted Facebook tokens. Post records with media URLs, status, timestamps. S3 bucket for media with CORS config. Presigned URLs for direct browser uploads (bypasses 6MB Lambda limit). Public read access for published content.

## Cross-cutting Features

**Security** — JWT authentication with 7-day expiration. AES-256-GCM encryption for Facebook tokens. Input sanitization (XSS/script tag removal). Media URL validation (S3 bucket whitelist). Page ID format validation. CORS with origin whitelist (Vercel deployments + localhost). Rate limiting per IP with dev mode bypass.

**Error Handling** — validation errors return 400 with descriptive messages. Auth failures return 401 with error codes (MISSING_ACCESS_TOKEN, NOT_AUTHENTICATED). Network errors caught with user-friendly messages. Failed posts stored with error details for debugging. Retry mechanism for transient failures.

**Media Pipeline** — legacy multipart upload endpoints (backward compatibility). Presigned URL generation for direct S3 uploads (new approach). File validation (format, size limits). Unique key generation with timestamp + random hash. Public URL construction with region (`s3.{region}.amazonaws.com`). Content-Type preservation.

## Recent Fixes

**S3 URL Format** — fixed region mismatch in URL generation. Changed from `s3.amazonaws.com` to `s3.us-east-1.amazonaws.com` to match validation regex. Updated `getPublicUrl()` to include `AWS_REGION` env var. Deployed to production.

**TypeScript Config** — added `middleware/**/*` to lambda tsconfig includes array. Compiler now recognizes auth/validation/security/rateLimiter modules. Build succeeds without errors.

**Validation Alignment** — `validateMediaUrls()` regex now matches actual S3 URL format. Pattern: `^https://{bucket}\.s3\.[a-z0-9-]+\.amazonaws\.com/`. Prevents false rejections of valid uploads.

## Tech Stack

Frontend: React 18, TypeScript, Vite, Axios, Vercel hosting
Backend: Node.js 20, Express, AWS Lambda, Serverless Framework
Storage: DynamoDB (PAY_PER_REQUEST), S3 with CORS
Auth: Facebook OAuth 2.0, JWT (jsonwebtoken)
Security: express-rate-limit, input sanitization, helmet-style headers
Media: multer (legacy), presigned URLs (current), sharp for processing
