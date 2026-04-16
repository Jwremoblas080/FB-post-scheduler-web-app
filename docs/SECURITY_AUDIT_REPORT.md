# 🔒 Security Audit Report - Facebook Post Scheduler

**Audit Date:** April 15, 2026  
**Auditor:** Senior Web Developer  
**Severity Levels:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | ℹ️ Info

---

## Executive Summary

Found **7 security vulnerabilities** ranging from Critical to Low severity. The most critical issues involve hardcoded secrets in version control and overly permissive CORS/S3 policies.

**Risk Score: 7.5/10** (High Risk)

---

## 🔴 CRITICAL VULNERABILITIES

### 1. Hardcoded Secrets in Version Control
**Severity:** 🔴 CRITICAL  
**Location:** `lambda/serverless.yml`, `.env`, `lambda/.env`  
**CWE:** CWE-798 (Use of Hard-coded Credentials)

**Issue:**
```yaml
# serverless.yml - Lines 10-13
FACEBOOK_APP_ID: '2790308504644722'
FACEBOOK_APP_SECRET: '50e5bd23e3798dc46ecb1de6d280924c'
ENCRYPTION_KEY: 'opEIH795ydKhJtMZ6Dk2cjsuVAWNvbSG'
ENCRYPTION_SECRET: 'opEIH795ydKhJtMZ6Dk2cjsuVAWNvbSG'
```

**Impact:**
- Facebook App Secret exposed → Attackers can impersonate your app
- Encryption keys exposed → All encrypted tokens can be decrypted
- Anyone with repo access can steal user data
- Secrets are in Git history forever

**Remediation:**
```yaml
# Use AWS Systems Manager Parameter Store or Secrets Manager
environment:
  FACEBOOK_APP_ID: ${ssm:/fb-scheduler/app-id}
  FACEBOOK_APP_SECRET: ${ssm:/fb-scheduler/app-secret~true}
  ENCRYPTION_KEY: ${ssm:/fb-scheduler/encryption-key~true}
  ENCRYPTION_SECRET: ${ssm:/fb-scheduler/encryption-secret~true}
```

**Steps:**
1. Store secrets in AWS Secrets Manager or SSM Parameter Store
2. Update serverless.yml to reference secrets
3. Remove `.env` and `lambda/.env` from Git
4. Add to `.gitignore`
5. Rotate all exposed secrets immediately
6. Use `git filter-branch` or BFG Repo-Cleaner to remove from history

---

### 2. No Authentication/Authorization on API Endpoints
**Severity:** 🔴 CRITICAL  
**Location:** `lambda/handlers/api.ts`  
**CWE:** CWE-306 (Missing Authentication for Critical Function)

**Issue:**
```typescript
// Anyone can call these endpoints without authentication:
app.post('/upload/presigned-urls/images', async (req, res) => { ... });
app.post('/posts', async (req, res) => { ... });
app.get('/posts', async (req, res) => { ... });
app.delete('/posts/:id', async (req, res) => { ... });
app.patch('/posts/:id', async (req, res) => { ... });
```

**Impact:**
- Anyone can create posts on your Facebook pages
- Anyone can delete posts
- Anyone can generate presigned S3 URLs
- No user isolation - single-user app design flaw

**Remediation:**
```typescript
// Add authentication middleware
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    // Verify JWT or session token
    const user = await verifyToken(token);
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Apply to protected routes
app.post('/posts', requireAuth, async (req, res) => { ... });
app.get('/posts', requireAuth, async (req, res) => { ... });
```

**Alternative:** Use AWS API Gateway authorizers (Lambda or Cognito)

---

## 🟠 HIGH SEVERITY VULNERABILITIES

### 3. Overly Permissive CORS Policy
**Severity:** 🟠 HIGH  
**Location:** `lambda/serverless.yml` (Lines 107-110), `lambda/handlers/api.ts` (Lines 23-25)  
**CWE:** CWE-942 (Overly Permissive Cross-domain Whitelist)

**Issue:**
```yaml
# S3 CORS allows ANY origin
AllowedOrigins: ['*']
```

```typescript
// API allows any .vercel.app subdomain
if (origin.endsWith('.vercel.app')) return true;
```

**Impact:**
- Any website can make requests to your API
- Any Vercel app can access your S3 bucket
- CSRF attacks possible
- Data exfiltration risk

**Remediation:**
```yaml
# Restrict to specific origins
AllowedOrigins: 
  - 'https://fb-post-scheduler-web-app-m5uf.vercel.app'
  - 'https://yourdomain.com'
```

```typescript
const ALLOWED_ORIGINS = [
  'https://fb-post-scheduler-web-app-m5uf.vercel.app',
  'https://yourdomain.com'
];

function isOriginAllowed(origin: string): boolean {
  if (process.env.NODE_ENV === 'development') {
    return origin.startsWith('http://localhost:');
  }
  return ALLOWED_ORIGINS.includes(origin);
}
```

---

### 4. S3 Bucket Publicly Readable
**Severity:** 🟠 HIGH  
**Location:** `lambda/serverless.yml` (Lines 111-114, 116-123)  
**CWE:** CWE-732 (Incorrect Permission Assignment for Critical Resource)

**Issue:**
```yaml
PublicAccessBlockConfiguration:
  BlockPublicAcls: false
  BlockPublicPolicy: false
  IgnorePublicAcls: false
  RestrictPublicBuckets: false

MediaBucketPolicy:
  Statement:
    - Effect: Allow
      Principal: '*'
      Action: s3:GetObject
```

**Impact:**
- Anyone can list and download all uploaded media
- User privacy violation
- Potential GDPR/compliance issues
- No access control on sensitive content

**Remediation:**
```yaml
# Remove public access
PublicAccessBlockConfiguration:
  BlockPublicAcls: true
  BlockPublicPolicy: true
  IgnorePublicAcls: true
  RestrictPublicBuckets: true

# Use CloudFront with signed URLs instead
# Or use S3 presigned URLs for read access
```

**Alternative:** Serve media through Lambda with authentication checks

---

### 5. No Rate Limiting on API Endpoints
**Severity:** 🟠 HIGH  
**Location:** `lambda/handlers/api.ts`  
**CWE:** CWE-770 (Allocation of Resources Without Limits)

**Issue:**
- No rate limiting on presigned URL generation
- No rate limiting on post creation
- No rate limiting on authentication endpoints

**Impact:**
- DDoS attacks possible
- Resource exhaustion
- Cost explosion (Lambda invocations, S3 requests)
- Abuse of Facebook API quota

**Remediation:**
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later'
});

app.use('/upload/', limiter);
app.use('/posts', limiter);
```

**Alternative:** Use AWS API Gateway throttling settings

---

## 🟡 MEDIUM SEVERITY VULNERABILITIES

### 6. Weak Encryption Key Derivation
**Severity:** 🟡 MEDIUM  
**Location:** `lambda/utils/encryption.ts` (Line 11)  
**CWE:** CWE-916 (Use of Password Hash With Insufficient Computational Effort)

**Issue:**
```typescript
// Only 100,000 iterations - NIST recommends 600,000+ for PBKDF2-SHA256
return crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, 'sha256');
```

**Impact:**
- Faster brute-force attacks on encrypted data
- If encryption key leaks, tokens can be cracked faster

**Remediation:**
```typescript
// Increase to NIST recommended minimum
return crypto.pbkdf2Sync(secret, salt, 600000, KEY_LENGTH, 'sha256');

// Or use Argon2 (better choice)
import argon2 from 'argon2';
const key = await argon2.hash(secret, {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4
});
```

---

### 7. No Input Sanitization
**Severity:** 🟡 MEDIUM  
**Location:** `lambda/handlers/api.ts` (Multiple endpoints)  
**CWE:** CWE-20 (Improper Input Validation)

**Issue:**
```typescript
// No sanitization on user inputs
const { caption, mediaPaths, mediaUrls, mediaType, scheduledTime, pageId } = req.body;
```

**Impact:**
- XSS attacks via caption field
- NoSQL injection in DynamoDB queries
- Path traversal in file names
- Prototype pollution

**Remediation:**
```typescript
import validator from 'validator';
import DOMPurify from 'isomorphic-dompurify';

// Sanitize caption
const sanitizedCaption = DOMPurify.sanitize(caption);

// Validate URLs
if (!mediaPaths.every(url => validator.isURL(url))) {
  throw new Error('Invalid media URL');
}

// Validate pageId format
if (!validator.isAlphanumeric(pageId)) {
  throw new Error('Invalid page ID');
}
```

---

## 🟢 LOW SEVERITY / BEST PRACTICES

### 8. Missing Security Headers
**Severity:** 🟢 LOW  
**Location:** `lambda/handlers/api.ts`

**Issue:** No security headers set

**Remediation:**
```typescript
import helmet from 'helmet';
app.use(helmet());

// Or manually:
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

---

### 9. No Logging/Monitoring for Security Events
**Severity:** 🟢 LOW  
**Location:** All files

**Issue:** No security event logging (failed auth, suspicious activity)

**Remediation:**
- Add CloudWatch Logs for security events
- Set up AWS CloudTrail
- Monitor for anomalies (unusual API calls, failed auth attempts)
- Set up alerts for critical events

---

### 10. Presigned URL Expiry Too Long
**Severity:** ℹ️ INFO  
**Location:** `lambda/services/s3Upload.ts` (Line 77)

**Issue:**
```typescript
const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 minutes
```

**Recommendation:** 5 minutes is reasonable, but consider 2-3 minutes for tighter security

---

## 📋 Remediation Priority

### Immediate (Within 24 hours)
1. 🔴 Remove hardcoded secrets from Git
2. 🔴 Rotate all exposed secrets
3. 🔴 Add authentication to API endpoints
4. 🟠 Restrict CORS to specific origins

### Short-term (Within 1 week)
5. 🟠 Implement S3 access controls
6. 🟠 Add rate limiting
7. 🟡 Increase PBKDF2 iterations
8. 🟡 Add input sanitization

### Long-term (Within 1 month)
9. 🟢 Add security headers
10. 🟢 Implement security logging
11. Conduct penetration testing
12. Set up security monitoring

---

## 🛡️ Security Checklist

- [ ] Secrets moved to AWS Secrets Manager
- [ ] All secrets rotated
- [ ] Authentication middleware implemented
- [ ] CORS restricted to specific origins
- [ ] S3 bucket access controls configured
- [ ] Rate limiting enabled
- [ ] Input validation/sanitization added
- [ ] Security headers configured
- [ ] Logging and monitoring set up
- [ ] Regular security audits scheduled
- [ ] Dependency vulnerability scanning (npm audit)
- [ ] WAF rules configured (if using CloudFront)

---

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/)
- [CWE Top 25](https://cwe.mitre.org/top25/)

---

**Next Steps:** Review this report with the team and create tickets for each vulnerability in priority order.
