# 🚨 Security Quick Fixes - Immediate Actions Required

## ⚠️ STOP! Read This First

Your project has **CRITICAL security vulnerabilities** that need immediate attention. Follow these steps in order.

---

## 🔴 Step 1: Remove Secrets from Git (URGENT)

### 1.1 Add to .gitignore
```bash
# Add these lines to .gitignore
.env
lambda/.env
*.pem
*.key
secrets/
```

### 1.2 Remove from Git History
```bash
# Install BFG Repo-Cleaner
brew install bfg  # macOS
# or download from https://rtyley.github.io/bfg-repo-cleaner/

# Remove sensitive files from history
bfg --delete-files '.env'
bfg --delete-files 'lambda/.env'

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (WARNING: Coordinate with team first!)
git push --force
```

### 1.3 Rotate ALL Secrets Immediately
```bash
# 1. Generate new Facebook App Secret
# Go to: https://developers.facebook.com/apps/YOUR_APP_ID/settings/basic/
# Click "Reset App Secret"

# 2. Generate new encryption keys
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Run twice for ENCRYPTION_KEY and ENCRYPTION_SECRET

# 3. Update AWS Secrets Manager (see Step 2)
```

---

## 🔐 Step 2: Move Secrets to AWS Secrets Manager

### 2.1 Create Secrets in AWS
```bash
# Install AWS CLI if not already installed
# Configure: aws configure

# Create secrets
aws secretsmanager create-secret \
  --name /fb-scheduler/facebook-app-id \
  --secret-string "YOUR_NEW_APP_ID"

aws secretsmanager create-secret \
  --name /fb-scheduler/facebook-app-secret \
  --secret-string "YOUR_NEW_APP_SECRET"

aws secretsmanager create-secret \
  --name /fb-scheduler/encryption-key \
  --secret-string "YOUR_NEW_ENCRYPTION_KEY"

aws secretsmanager create-secret \
  --name /fb-scheduler/encryption-secret \
  --secret-string "YOUR_NEW_ENCRYPTION_SECRET"
```

### 2.2 Update serverless.yml
```yaml
# Replace hardcoded values with:
provider:
  environment:
    FACEBOOK_APP_ID: ${ssm:/fb-scheduler/facebook-app-id}
    FACEBOOK_APP_SECRET: ${ssm:/fb-scheduler/facebook-app-secret~true}
    ENCRYPTION_KEY: ${ssm:/fb-scheduler/encryption-key~true}
    ENCRYPTION_SECRET: ${ssm:/fb-scheduler/encryption-secret~true}
```

### 2.3 Grant Lambda Access to Secrets
```yaml
# Add to serverless.yml IAM role
- Effect: Allow
  Action:
    - secretsmanager:GetSecretValue
  Resource:
    - arn:aws:secretsmanager:${aws:region}:${aws:accountId}:secret:/fb-scheduler/*
```

---

## 🔒 Step 3: Add Authentication Middleware

### 3.1 Install Dependencies
```bash
cd lambda
npm install jsonwebtoken express-jwt
```

### 3.2 Create Auth Middleware
Create `lambda/middleware/auth.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export interface AuthRequest extends Request {
  userId?: string;
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: true, message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (e) {
    return res.status(401).json({ error: true, message: 'Invalid or expired token' });
  }
};

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};
```

### 3.3 Apply to Protected Routes
```typescript
import { requireAuth } from '../middleware/auth';

// Protect these endpoints
app.post('/upload/presigned-urls/images', requireAuth, async (req, res) => { ... });
app.post('/upload/presigned-urls/video', requireAuth, async (req, res) => { ... });
app.post('/posts', requireAuth, async (req, res) => { ... });
app.get('/posts', requireAuth, async (req, res) => { ... });
app.delete('/posts/:id', requireAuth, async (req, res) => { ... });
app.patch('/posts/:id', requireAuth, async (req, res) => { ... });
```

---

## 🌐 Step 4: Fix CORS Configuration

### 4.1 Update serverless.yml
```yaml
# Replace AllowedOrigins: ['*'] with:
CorsConfiguration:
  CorsRules:
    - AllowedHeaders: ['*']
      AllowedMethods: [GET, PUT, POST]
      AllowedOrigins: 
        - 'https://fb-post-scheduler-web-app-m5uf.vercel.app'
      MaxAge: 3000
```

### 4.2 Update API Handler
```typescript
const ALLOWED_ORIGINS = [
  'https://fb-post-scheduler-web-app-m5uf.vercel.app'
];

function isOriginAllowed(origin: string): boolean {
  // Only allow localhost in development
  if (process.env.NODE_ENV === 'development') {
    return origin.startsWith('http://localhost:');
  }
  return ALLOWED_ORIGINS.includes(origin);
}
```

---

## 🛡️ Step 5: Add Rate Limiting

### 5.1 Install Dependencies
```bash
cd lambda
npm install express-rate-limit
```

### 5.2 Add Rate Limiter
```typescript
import rateLimit from 'express-rate-limit';

// Create limiters
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 uploads per 15 min
  message: 'Too many upload requests, please try again later'
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 100 requests per 15 min
  message: 'Too many requests, please try again later'
});

// Apply to routes
app.use('/upload/', uploadLimiter);
app.use('/posts', apiLimiter);
```

---

## 🔐 Step 6: Restrict S3 Access

### 6.1 Update serverless.yml
```yaml
# Remove public access
PublicAccessBlockConfiguration:
  BlockPublicAcls: true
  BlockPublicPolicy: true
  IgnorePublicAcls: true
  RestrictPublicBuckets: true

# Remove MediaBucketPolicy (delete entire section)
```

### 6.2 Serve Media Through Lambda
Create `lambda/handlers/api.ts` endpoint:
```typescript
app.get('/media/:key', requireAuth, async (req, res) => {
  const { key } = req.params;
  
  // Validate key format
  if (!key.startsWith('uploads/')) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key
    });
    
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    res.redirect(url);
  } catch (e) {
    res.status(404).json({ error: 'Media not found' });
  }
});
```

---

## ✅ Verification Checklist

After applying fixes, verify:

```bash
# 1. Check no secrets in Git
git log --all --full-history -- "*.env"
# Should return nothing

# 2. Test authentication
curl -X POST https://your-api.com/posts
# Should return 401 Unauthorized

# 3. Test CORS
curl -H "Origin: https://evil.com" https://your-api.com/posts
# Should NOT have Access-Control-Allow-Origin header

# 4. Test rate limiting
for i in {1..101}; do curl https://your-api.com/posts; done
# Should return 429 Too Many Requests after 100 requests

# 5. Test S3 access
curl https://your-bucket.s3.amazonaws.com/uploads/test.jpg
# Should return Access Denied
```

---

## 📋 Deployment Steps

```bash
# 1. Commit changes (without secrets!)
git add .
git commit -m "Security fixes: Remove hardcoded secrets, add auth, fix CORS"

# 2. Deploy to AWS
cd lambda
npm install
npm run deploy

# 3. Update frontend with new auth flow
# (Add JWT token handling to frontend/src/api/client.ts)

# 4. Test thoroughly in staging first!

# 5. Deploy to production
npm run deploy:prod
```

---

## 🚨 Emergency Contacts

If you discover active exploitation:
1. Immediately disable the Lambda functions in AWS Console
2. Rotate all secrets
3. Review CloudWatch logs for suspicious activity
4. Contact AWS Support if needed

---

## 📞 Need Help?

- AWS Security: https://aws.amazon.com/security/
- OWASP: https://owasp.org/
- Security Stack Exchange: https://security.stackexchange.com/

**DO NOT DELAY** - These fixes should be implemented within 24 hours.
