# 🪟 Windows PowerShell Setup Guide

## ✅ Already Done
- Dependencies installed
- TypeScript compiled
- AWS CLI verified

## 🚀 Easy Setup for Windows

### Step 1: Run the PowerShell Script

I've created a PowerShell script specifically for Windows. Just run:

```powershell
.\setup-secrets-windows.ps1
```

**The script will ask you for:**
1. Facebook App ID
2. Facebook App Secret (NEW ONE - rotate it!)
3. Facebook Redirect URI (press Enter to use placeholder)
4. Frontend URL
5. Allowed Origins

**It will automatically:**
- Generate encryption keys
- Create all AWS SSM parameters
- Show you what was created

### Step 2: Deploy to AWS

```powershell
cd lambda
npm run deploy
```

**Save the API Gateway URL!** It looks like:
```
https://abc123xyz.execute-api.us-east-1.amazonaws.com
```

### Step 3: Update Redirect URI

After deployment, update the redirect URI:

```powershell
aws ssm put-parameter `
  --name "/fb-scheduler/dev/facebook-redirect-uri" `
  --value "https://YOUR-ACTUAL-API-GATEWAY-URL/auth/callback" `
  --type "String" `
  --region "us-east-1" `
  --overwrite
```

Replace `YOUR-ACTUAL-API-GATEWAY-URL` with the URL from Step 2.

### Step 4: Clean Up

```powershell
# Delete local .env files
Remove-Item .env -ErrorAction SilentlyContinue
Remove-Item lambda\.env -ErrorAction SilentlyContinue
```

### Step 5: Test

Open your frontend and try:
1. Login with Facebook
2. Upload photos
3. Create a post

---

## 🆘 Troubleshooting

### Script won't run?

```powershell
# Allow script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then run again
.\setup-secrets-windows.ps1
```

### AWS CLI errors?

```powershell
# Check credentials
aws sts get-caller-identity

# If not configured, run:
aws configure
```

### Deployment fails?

Check CloudFormation in AWS Console:
https://console.aws.amazon.com/cloudformation

---

## ⏱️ Total Time: ~15 minutes

1. Run script (5 min)
2. Deploy (5 min)
3. Update URI (2 min)
4. Clean up (1 min)
5. Test (2 min)

---

**Start now: `.\setup-secrets-windows.ps1`** 🚀
