# ⚡ Quick Start - Security Fixes Deployment

## What's Been Done ✅
- ✅ All security vulnerabilities fixed
- ✅ Dependencies installed (`lambda/node_modules`)
- ✅ TypeScript compiled (`lambda/dist/`)
- ✅ Code ready for deployment

## What You Need To Do 🎯

### 1️⃣ Set Up AWS Secrets (5 minutes)
```bash
# Option 1: Use the script
chmod +x scripts/setup-secrets.sh
./scripts/setup-secrets.sh dev us-east-1

# Option 2: Manual AWS CLI commands
# See SETUP_INSTRUCTIONS.md for full commands
```

**You'll need:**
- New Facebook App Secret (rotate the old one!)
- Your API Gateway URL (get after first deploy)
- Your frontend URL

### 2️⃣ Deploy to AWS (5 minutes)
```bash
cd lambda
npm run deploy
```

**Save the API Gateway URL from the output!**

### 3️⃣ Update Frontend (2 minutes)
```bash
# In Vercel Dashboard:
# Settings → Environment Variables
# Add: VITE_API_URL = YOUR_API_GATEWAY_URL

# Then redeploy
cd frontend
npm run build
```

### 4️⃣ Clean Up Secrets (2 minutes)
```bash
# Delete local files
rm .env lambda/.env

# Remove from Git (use BFG Repo-Cleaner)
# See SETUP_INSTRUCTIONS.md for commands
```

### 5️⃣ Test (5 minutes)
- Login with Facebook
- Upload 6-10 photos
- Verify authentication works
- Check rate limiting

---

## 🔑 Key Changes

| What | Before | After |
|------|--------|-------|
| Secrets | Hardcoded | AWS SSM |
| Auth | None | JWT |
| Rate Limit | None | 100/15min |
| CORS | Wildcard | Restricted |
| S3 Access | Public | Private |
| Encryption | 100k iter | 600k iter |

---

## 📚 Full Documentation

- `SETUP_INSTRUCTIONS.md` - Detailed step-by-step guide
- `SECURITY_FIXES_APPLIED.md` - What was fixed
- `DEPLOYMENT_CHECKLIST.md` - Complete checklist
- `SECURITY_FIX_SUMMARY.md` - Quick summary

---

## ⚠️ CRITICAL

1. **Rotate Facebook App Secret** before deploying
2. **Remove .env files** from Git history
3. **Test thoroughly** before production use

---

## 🆘 Stuck?

Check `SETUP_INSTRUCTIONS.md` for:
- Detailed commands
- Troubleshooting
- Common issues
- Alternative methods

**Total Time: ~20 minutes** ⏱️
