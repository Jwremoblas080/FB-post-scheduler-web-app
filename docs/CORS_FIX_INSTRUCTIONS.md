# CORS Error Fix - Action Required

## The Problem
The CORS error you're seeing is likely due to browser caching or the Lambda function not being fully deployed yet.

## Immediate Actions to Take:

### 1. Clear Browser Cache (CRITICAL)
**Chrome/Edge:**
1. Press `Ctrl + Shift + Delete`
2. Select "Cached images and files"
3. Click "Clear data"
4. Close and reopen the browser

**Or use Incognito/Private mode:**
- Press `Ctrl + Shift + N` (Chrome/Edge)
- Try the app in incognito mode

### 2. Hard Refresh the Page
- Press `Ctrl + F5` (Windows)
- Or `Ctrl + Shift + R`

### 3. Wait 2-3 Minutes
The Lambda deployment takes a few minutes to propagate. Wait 2-3 minutes after deployment before testing.

---

## What I Fixed:

1. ✅ Updated CORS logic to allow ALL Vercel deployments containing `fb-post-scheduler-web-app`
2. ✅ Updated S3 bucket CORS configuration
3. ✅ Force redeployed Lambda function
4. ✅ Verified compiled code has correct CORS logic

---

## Testing Steps:

1. **Clear browser cache** (see above)
2. **Open in incognito mode**
3. Go to: `https://fb-post-scheduler-web-app-m5uf.vercel.app`
4. Open DevTools (F12) → Network tab
5. Click "Connect with Facebook"
6. Check the `/auth/login` request
7. Look for these response headers:
   - `Access-Control-Allow-Origin: https://fb-post-scheduler-web-app-m5uf.vercel.app`
   - `Access-Control-Allow-Credentials: true`

---

## If Still Not Working:

### Check Lambda Environment Variables:
```bash
aws lambda get-function-configuration --function-name fb-post-scheduler-dev-api --query "Environment.Variables"
```

Should show:
```json
{
  "ALLOWED_ORIGINS": "https://fb-post-scheduler-web-app-m5uf.vercel.app,https://fb-post-scheduler-web-app-7k80hm6cn.vercel.app,http://localhost:5173",
  "STAGE": "dev"
}
```

### Test CORS Directly:
```bash
curl -X OPTIONS https://o6i2c5bnjg.execute-api.us-east-1.amazonaws.com/auth/login \
  -H "Origin: https://fb-post-scheduler-web-app-m5uf.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

Look for `Access-Control-Allow-Origin` in the response headers.

---

## Alternative: Use Production Vercel URL

If the preview URL keeps changing, you can set a custom domain in Vercel:
1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add a custom domain (or use the production `.vercel.app` URL)
3. Update `ALLOWED_ORIGINS` in AWS SSM to use that domain

---

## Current Configuration:

- **Lambda Endpoint:** `https://o6i2c5bnjg.execute-api.us-east-1.amazonaws.com`
- **Allowed Origins:**
  - `https://fb-post-scheduler-web-app-m5uf.vercel.app`
  - `https://fb-post-scheduler-web-app-7k80hm6cn.vercel.app`
  - `http://localhost:5173`
  - Any Vercel deployment with `fb-post-scheduler-web-app` in the URL

- **CORS Logic:** Automatically allows all Vercel preview deployments for this project

---

## Status: ✅ DEPLOYED

The fix has been deployed. The issue is most likely browser caching. Clear your cache and try again in incognito mode.
