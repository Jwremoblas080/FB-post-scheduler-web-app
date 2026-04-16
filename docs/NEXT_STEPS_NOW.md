# 🎯 What To Do Right Now

## ✅ Already Completed
1. ✅ All security vulnerabilities fixed in code
2. ✅ Dependencies installed (`npm install` in lambda/)
3. ✅ TypeScript compiled (`npx tsc` in lambda/)
4. ✅ AWS CLI verified and configured

## 🚀 Do These Steps Now

### Step 1: Set Up AWS Secrets (5 minutes)

Run this PowerShell script:
```powershell
.\setup-secrets-windows.ps1
```

**You'll be asked for:**
- Facebook App ID: `2790308504644722` (or your new one)
- Facebook App Secret: **GET A NEW ONE** from https://developers.facebook.com/apps/
- Facebook Redirect URI: Press Enter (will use placeholder)
- Frontend URL: `https://fb-post-scheduler-web-app-m5uf.vercel.app`
- Allowed Origins: `https://fb-post-scheduler-web-app-m5uf.vercel.app,http://localhost:5173`

**IMPORTANT:** You MUST rotate your Facebook App Secret because the old one is exposed in Git!

### Step 2: Deploy to AWS (5 minutes)

```powershell
cd lambda
npm run deploy
```

**Save the API Gateway URL from the output!** It will look like:
```
https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com
```

### Step 3: Update Facebook Redirect URI (2 minutes)

After deployment, update the redirect URI in AWS SSM:
```powershell
aws ssm put-parameter `
  --name "/fb-scheduler/dev/facebook-redirect-uri" `
  --value "https://YOUR-API-GATEWAY-URL/auth/callback" `
  --type "String" `
  --region "us-east-1" `
  --overwrite
```

Also update it in Facebook Developer Console:
1. Go to https://developers.facebook.com/apps/
2. Select your app
3. Settings → Basic → Add Platform → Website
4. Add your API Gateway URL + `/auth/callback`

### Step 4: Test Locally (Optional)

Before deploying frontend, test the API:
```powershell
# Test health endpoint
curl https://YOUR-API-GATEWAY-URL/health

# Should return: {"status":"ok"}
```

### Step 5: Update Frontend (2 minutes)

In Vercel Dashboard:
1. Go to your project settings
2. Environment Variables
3. Add/Update: `VITE_API_URL` = Your API Gateway URL
4. Redeploy

### Step 6: Clean Up Secrets (CRITICAL)

```powershell
# Delete local .env files
Remove-Item .env -ErrorAction SilentlyContinue
Remove-Item lambda\.env -ErrorAction SilentlyContinue

# Add to .gitignore (already done)
# Remove from Git history (see SETUP_INSTRUCTIONS.md for BFG commands)
```

### Step 7: Test Everything

1. Open your frontend URL
2. Click "Connect with Facebook"
3. Complete OAuth
4. Upload 6-10 photos
5. Verify post is created

---

## 📋 Quick Checklist

- [ ] Run `.\setup-secrets-windows.ps1`
- [ ] Rotate Facebook App Secret
- [ ] Run `cd lambda && npm run deploy`
- [ ] Save API Gateway URL
- [ ] Update Facebook Redirect URI in AWS SSM
- [ ] Update Facebook Redirect URI in Facebook Console
- [ ] Update Vercel environment variable
- [ ] Redeploy frontend
- [ ] Delete local .env files
- [ ] Test login and upload

---

## 🆘 If Something Goes Wrong

### Deployment fails
```powershell
# Check AWS credentials
aws sts get-caller-identity

# Check CloudFormation console
# https://console.aws.amazon.com/cloudformation
```

### Can't connect to API
- Verify CORS origins in SSM match your frontend URL
- Check API Gateway URL is correct
- Look at CloudWatch Logs for errors

### Authentication fails
- Verify Facebook Redirect URI matches API Gateway URL
- Check Facebook App Secret is correct
- Verify JWT_SECRET is set in SSM

---

## 📞 Need Help?

See these files for more details:
- `SETUP_INSTRUCTIONS.md` - Detailed guide
- `DEPLOYMENT_CHECKLIST.md` - Complete checklist
- `SECURITY_FIXES_APPLIED.md` - What was fixed

---

## ⏱️ Estimated Time

- Step 1 (Secrets): 5 minutes
- Step 2 (Deploy): 5 minutes
- Step 3 (Update URI): 2 minutes
- Step 4 (Test): 2 minutes
- Step 5 (Frontend): 2 minutes
- Step 6 (Cleanup): 2 minutes
- Step 7 (Test): 5 minutes

**Total: ~25 minutes**

---

**Ready? Start with Step 1: Run `.\setup-secrets-windows.ps1`** 🚀
