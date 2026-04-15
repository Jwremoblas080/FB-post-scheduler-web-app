# 🚀 Setup Instructions - Complete These Steps

## ✅ Step 1: Dependencies Installed
Dependencies have been installed successfully!

## ✅ Step 2: TypeScript Compiled
Code has been compiled to JavaScript in `lambda/dist/`

---

## 🔐 Step 3: Set Up AWS Secrets (REQUIRED BEFORE DEPLOYMENT)

You need to store your secrets in AWS SSM Parameter Store. Here are two options:

### Option A: Using the Script (Recommended)

1. **Make the script executable:**
   ```bash
   chmod +x scripts/setup-secrets.sh
   ```

2. **Run the script:**
   ```bash
   ./scripts/setup-secrets.sh dev us-east-1
   ```

3. **Follow the prompts** to enter:
   - Facebook App ID
   - Facebook App Secret (get new one from Facebook Developer Console)
   - Facebook Redirect URI
   - Frontend URL
   - Allowed Origins

### Option B: Manual Setup via AWS CLI

Run these commands one by one:

```bash
# Set your stage and region
STAGE=dev
REGION=us-east-1

# Generate new encryption keys
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
ENCRYPTION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('base64'))")

# Store Facebook App credentials
aws ssm put-parameter \
  --name "/fb-scheduler/$STAGE/facebook-app-id" \
  --value "YOUR_FACEBOOK_APP_ID" \
  --type "String" \
  --region "$REGION" \
  --overwrite

aws ssm put-parameter \
  --name "/fb-scheduler/$STAGE/facebook-app-secret" \
  --value "YOUR_NEW_FACEBOOK_APP_SECRET" \
  --type "SecureString" \
  --region "$REGION" \
  --overwrite

aws ssm put-parameter \
  --name "/fb-scheduler/$STAGE/facebook-redirect-uri" \
  --value "https://YOUR-API-GATEWAY-URL/auth/callback" \
  --type "String" \
  --region "$REGION" \
  --overwrite

# Store encryption keys
aws ssm put-parameter \
  --name "/fb-scheduler/$STAGE/encryption-key" \
  --value "$ENCRYPTION_KEY" \
  --type "SecureString" \
  --region "$REGION" \
  --overwrite

aws ssm put-parameter \
  --name "/fb-scheduler/$STAGE/encryption-secret" \
  --value "$ENCRYPTION_SECRET" \
  --type "SecureString" \
  --region "$REGION" \
  --overwrite

aws ssm put-parameter \
  --name "/fb-scheduler/$STAGE/jwt-secret" \
  --value "$JWT_SECRET" \
  --type "SecureString" \
  --region "$REGION" \
  --overwrite

# Store frontend URL
aws ssm put-parameter \
  --name "/fb-scheduler/$STAGE/frontend-url" \
  --value "https://fb-post-scheduler-web-app-m5uf.vercel.app" \
  --type "String" \
  --region "$REGION" \
  --overwrite

# Store allowed origins
aws ssm put-parameter \
  --name "/fb-scheduler/$STAGE/allowed-origins" \
  --value "https://fb-post-scheduler-web-app-m5uf.vercel.app,http://localhost:5173" \
  --type "String" \
  --region "$REGION" \
  --overwrite
```

### Option C: Using AWS Console (GUI)

1. Go to AWS Systems Manager → Parameter Store
2. Create each parameter manually:
   - Name: `/fb-scheduler/dev/facebook-app-id`
   - Type: String
   - Value: Your Facebook App ID
3. Repeat for all parameters listed above

---

## 🔄 Step 4: Rotate Facebook App Secret

**IMPORTANT:** Your old Facebook App Secret is exposed in Git. You MUST rotate it:

1. Go to https://developers.facebook.com/apps/
2. Select your app (ID: 2790308504644722)
3. Go to Settings → Basic
4. Click "Reset App Secret"
5. Copy the new secret
6. Use it in Step 3 above

---

## 🚀 Step 5: Deploy to AWS

Once secrets are set up, deploy:

```bash
cd lambda
npm run deploy
```

This will:
- Package your Lambda functions
- Deploy to AWS
- Create/update S3 bucket
- Create/update DynamoDB table
- Set up API Gateway

**Note the API Gateway URL from the output!**

---

## 🌐 Step 6: Update Frontend

1. **Update Vercel environment variables:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add/Update: `VITE_API_URL` = Your API Gateway URL from Step 5

2. **Redeploy frontend:**
   ```bash
   cd frontend
   npm run build
   # Or trigger redeploy in Vercel dashboard
   ```

---

## 🧹 Step 7: Clean Up Secrets

**CRITICAL:** Remove secrets from your local machine and Git:

```bash
# Delete local .env files
rm .env
rm lambda/.env

# Remove from Git history (IMPORTANT!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env lambda/.env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (coordinate with team first!)
git push --force
```

Or use BFG Repo-Cleaner (recommended):
```bash
# Install BFG
# Windows: Download from https://rtyley.github.io/bfg-repo-cleaner/
# Mac: brew install bfg

# Remove .env files from history
bfg --delete-files '.env'
bfg --delete-files 'lambda/.env'

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

---

## ✅ Step 8: Test Everything

### Test Authentication
1. Open your frontend URL
2. Click "Connect with Facebook"
3. Complete OAuth flow
4. Check browser DevTools → Application → Local Storage
5. Verify `auth_token` is stored

### Test Upload
1. Try uploading 1 photo → Should work
2. Try uploading 6-10 photos → Should work
3. Open DevTools → Network tab
4. Verify `Authorization: Bearer ...` header in requests

### Test Security
```bash
# Test without auth (should fail with 401)
curl https://YOUR-API-URL/posts

# Test with auth (should work)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://YOUR-API-URL/posts

# Test rate limiting (should fail after 100 requests)
for i in {1..101}; do 
  curl -H "Authorization: Bearer YOUR_TOKEN" \
    https://YOUR-API-URL/posts
done
```

---

## 📊 Current Status

- ✅ Dependencies installed
- ✅ TypeScript compiled
- ⏳ Secrets need to be set up in AWS SSM
- ⏳ Deploy to AWS
- ⏳ Update frontend
- ⏳ Clean up local secrets
- ⏳ Test everything

---

## 🆘 Need Help?

### Common Issues

**Issue: AWS CLI not configured**
```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and region
```

**Issue: Permission denied on script**
```bash
chmod +x scripts/setup-secrets.sh
```

**Issue: Deployment fails**
- Check AWS credentials: `aws sts get-caller-identity`
- Verify region is correct
- Check CloudFormation console for errors

**Issue: Frontend can't connect**
- Verify CORS origins in SSM match your frontend URL
- Check API Gateway URL is correct
- Verify JWT token is being sent

---

## 📞 Next Steps

1. **Set up AWS SSM secrets** (Step 3)
2. **Rotate Facebook App Secret** (Step 4)
3. **Deploy to AWS** (Step 5)
4. **Update frontend** (Step 6)
5. **Clean up secrets** (Step 7)
6. **Test everything** (Step 8)

**Once complete, your app will be fully secure and production-ready! 🎉**
