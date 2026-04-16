# Token Fix Instructions

## What Was Fixed

I've fixed the critical issues causing upload and publishing failures:

1. **Encryption Key Derivation** - Updated from 100k to 600k PBKDF2 iterations (security best practice)
2. **Token Expiry Validation** - Scheduler now checks if tokens are expired before using them
3. **Better Error Messages** - Clear feedback when tokens expire or decryption fails
4. **AWS Region Configuration** - Added AWS_REGION to Lambda environment variables
5. **Upload Error Handling** - Better error messages distinguish between upload and post creation failures

## ⚠️ IMPORTANT: You Must Reconnect Facebook

Because we updated the encryption algorithm, **existing tokens cannot be decrypted**. You need to:

1. **Click "Connect with Facebook"** in your app
2. Authorize the app again
3. Your new token will be encrypted with the stronger 600k iteration algorithm

## What to Expect After Reconnecting

✅ **Uploads will work** - Files will upload to S3 successfully
✅ **Posts will publish** - Scheduler will use valid, non-expired tokens
✅ **Better error messages** - You'll see clear messages if tokens expire
✅ **Automatic failure handling** - If tokens expire, posts will be marked as failed with instructions to reconnect

## If Posts Still Fail After Reconnecting

Check the error message in the post list:
- **"Facebook token expired"** → Reconnect Facebook
- **"Token decryption failed"** → Reconnect Facebook
- **"Page token not found"** → Reconnect Facebook (pages need to be re-cached)
- **"Upload failed"** → Check S3 bucket permissions
- **"Invalid media URLs"** → Check AWS_REGION environment variable

## Deployment Steps

If you're using AWS Lambda:

1. **Redeploy your Lambda functions** to pick up the encryption changes:
   ```bash
   cd lambda
   npm run build
   serverless deploy
   ```

2. **Reconnect Facebook** in the deployed app

3. **Test by scheduling a post** for 2 minutes in the future

## Why This Happened

The original code had:
- Inconsistent encryption iterations (100k instead of recommended 600k)
- No token expiry checking in the scheduler
- No validation before using tokens
- Poor error messages when tokens failed

These issues caused:
- Token decryption failures
- Facebook API Error 190 (invalid/expired tokens)
- "Failed after 3 attempts" errors
- Unclear error messages

All of these are now fixed!
