# 🚀 Deployment Checklist - Security Fixes

## Pre-Deployment

### 1. Secret Management
- [ ] Run `scripts/setup-secrets.sh` to configure AWS SSM
- [ ] Verify all secrets are in SSM Parameter Store
- [ ] Delete `.env` and `lambda/.env` from local machine
- [ ] Remove secrets from Git history using BFG Repo-Cleaner

### 2. Dependency Installation
- [ ] Run `cd lambda && npm install`
- [ ] Run `cd frontend && npm install`
- [ ] Verify no security vulnerabilities: `npm audit`

### 3. Code Compilation
- [ ] Run `cd lambda && npx tsc`
- [ ] Verify no TypeScript errors
- [ ] Check `lambda/dist/` folder created

---

## Deployment

### 4. Backend Deployment
- [ ] Run `cd lambda && npm run deploy`
- [ ] Note the API Gateway URL from output
- [ ] Verify Lambda functions deployed (api, scheduler)
- [ ] Check S3 bucket created/updated
- [ ] Verify DynamoDB table exists

### 5. Frontend Deployment
- [ ] Update `VITE_API_URL` in Vercel environment variables
- [ ] Run `cd frontend && npm run build`
- [ ] Deploy to Vercel
- [ ] Verify deployment successful

---

## Post-Deployment Testing

### 6. Authentication Testing
- [ ] Open frontend URL
- [ ] Click "Connect with Facebook"
- [ ] Complete OAuth flow
- [ ] Verify JWT token stored in localStorage
- [ ] Check token appears in API requests (DevTools Network tab)

### 7. Upload Testing
- [ ] Upload 1 photo - should work
- [ ] Upload 6-10 photos - should work (presigned URLs)
- [ ] Upload without authentication - should fail with 401
- [ ] Verify files in S3 bucket (private)
- [ ] Try accessing S3 URL directly - should fail

### 8. Rate Limiting Testing
```bash
# Test API rate limit (should fail after 100 requests)
for i in {1..101}; do 
  curl -H "Authorization: Bearer YOUR_TOKEN" \
    https://your-api.com/posts
done
```
- [ ] Verify 429 error after 100 requests
- [ ] Wait 15 minutes and verify reset

### 9. CORS Testing
```bash
# Test from unauthorized origin (should fail)
curl -H "Origin: https://evil.com" \
  https://your-api.com/posts
```
- [ ] Verify no Access-Control-Allow-Origin header
- [ ] Test from authorized origin - should work

### 10. Security Headers Testing
```bash
# Check security headers
curl -I https://your-api.com/health
```
- [ ] Verify X-Content-Type-Options: nosniff
- [ ] Verify X-Frame-Options: DENY
- [ ] Verify Strict-Transport-Security present
- [ ] Verify Content-Security-Policy present

---

## Security Verification

### 11. Secret Verification
- [ ] Verify no secrets in `lambda/serverless.yml`
- [ ] Check `.env` files not in Git: `git log --all -- "*.env"`
- [ ] Verify SSM parameters exist: `aws ssm get-parameter --name /fb-scheduler/dev/facebook-app-id`

### 12. S3 Security
- [ ] Try accessing S3 bucket URL directly - should fail
- [ ] Verify public access blocks enabled
- [ ] Check bucket policy removed
- [ ] Test presigned URL works (within 5 minutes)

### 13. Input Validation
- [ ] Try XSS in caption: `<script>alert('xss')</script>`
- [ ] Verify sanitized (no script tags)
- [ ] Try invalid page ID: `../../../etc/passwd`
- [ ] Verify rejected with validation error

---

## Monitoring Setup

### 14. CloudWatch Alarms
- [ ] Set up alarm for Lambda errors
- [ ] Set up alarm for 4xx/5xx errors
- [ ] Set up alarm for high request rate
- [ ] Set up alarm for failed authentications

### 15. Logging Verification
- [ ] Check CloudWatch Logs for Lambda
- [ ] Verify authentication attempts logged
- [ ] Check rate limit violations logged
- [ ] Verify error details captured

---

## Documentation

### 16. Update Documentation
- [ ] Update README with new auth flow
- [ ] Document JWT token usage
- [ ] Add security best practices section
- [ ] Update deployment instructions

### 17. Team Communication
- [ ] Notify team of security updates
- [ ] Share new deployment process
- [ ] Document secret rotation procedure
- [ ] Schedule security review meeting

---

## Rollback Plan

### 18. Prepare Rollback
- [ ] Note current Lambda version
- [ ] Save previous serverless.yml
- [ ] Document rollback command:
  ```bash
  serverless rollback --timestamp TIMESTAMP
  ```
- [ ] Test rollback in dev environment

---

## Final Checks

### 19. Production Readiness
- [ ] All tests passing
- [ ] No console errors in browser
- [ ] No Lambda errors in CloudWatch
- [ ] Performance acceptable (< 2s response time)
- [ ] All features working as expected

### 20. Security Audit
- [ ] Run `npm audit` - no high/critical vulnerabilities
- [ ] Check OWASP Top 10 compliance
- [ ] Verify all 10 vulnerabilities fixed
- [ ] Document any remaining risks

---

## Sign-Off

**Deployed By:** ___________________  
**Date:** ___________________  
**Environment:** [ ] Dev [ ] Staging [ ] Production  
**Version:** ___________________  

**Approvals:**
- [ ] Technical Lead
- [ ] Security Team
- [ ] Product Owner

---

## Emergency Contacts

**If issues arise:**
1. Check CloudWatch Logs
2. Review recent deployments
3. Contact: [Your contact info]
4. AWS Support: [Support plan details]

---

## Post-Deployment Monitoring (First 24 Hours)

- [ ] Hour 1: Check error rates
- [ ] Hour 4: Verify no authentication issues
- [ ] Hour 8: Check rate limiting working
- [ ] Hour 24: Review all metrics

**All checks passed? Congratulations! 🎉**
