# Deployment Guide - Multi-Photo Fix

## Prerequisites
- AWS CLI configured with appropriate credentials
- Node.js 20.x installed
- Serverless Framework (installed via npm)

## Step-by-Step Deployment

### 1. Install Dependencies
```bash
cd lambda
npm install
```

This will install the new `@aws-sdk/s3-request-presigner` package.

### 2. Build TypeScript
```bash
cd lambda
npx tsc
```

Verify the `dist/` folder is created with compiled JavaScript.

### 3. Deploy to AWS
```bash
cd lambda
npm run deploy
```

Or for production:
```bash
npm run deploy:prod
```

### 4. Verify Deployment
Check the deployment output for:
- ✅ API endpoint URL
- ✅ Lambda functions deployed (api, scheduler)
- ✅ S3 bucket created/updated
- ✅ DynamoDB table created/updated

### 5. Test the Fix

#### Test Presigned URL Generation
```bash
curl -X POST https://YOUR-API-ENDPOINT/upload/presigned-urls/images \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {"fileName": "test1.jpg", "fileSize": 1000000, "contentType": "image/jpeg"},
      {"fileName": "test2.jpg", "fileSize": 1000000, "contentType": "image/jpeg"}
    ]
  }'
```

Expected response:
```json
{
  "success": true,
  "urls": [
    {
      "uploadUrl": "https://s3.amazonaws.com/...",
      "key": "uploads/test1_...",
      "publicUrl": "https://bucket.s3.amazonaws.com/uploads/test1_..."
    },
    ...
  ]
}
```

#### Test in Frontend
1. Open the frontend application
2. Click "Connect with Facebook"
3. Select a page
4. Upload 6-10 photos
5. Add caption and schedule time
6. Click "Schedule Post"
7. Verify all photos appear in the post list
8. Wait for scheduled time or check scheduler logs

### 6. Monitor Logs

#### API Logs
```bash
cd lambda
npm run logs:api
```

#### Scheduler Logs
```bash
npm run logs:scheduler
```

Look for successful upload confirmations and post publishing.

## Rollback (if needed)
```bash
cd lambda
serverless deploy --stage dev --force
```

Or restore from previous deployment:
```bash
serverless rollback --timestamp TIMESTAMP
```

## Troubleshooting

### Issue: "Module not found: @aws-sdk/s3-request-presigner"
**Solution**: Run `npm install` in the lambda directory

### Issue: CORS errors in browser
**Solution**: Verify S3 bucket CORS configuration in `serverless.yml`

### Issue: Presigned URL expired
**Solution**: URLs expire after 5 minutes. Generate new ones if needed.

### Issue: S3 upload fails with 403
**Solution**: Check IAM role permissions in `serverless.yml` include `s3:PutObject`

## Performance Notes
- Presigned URLs are valid for 5 minutes
- Parallel uploads significantly faster than sequential
- No Lambda timeout issues with large files
- Reduced Lambda execution time = lower costs

## Security Checklist
- ✅ Presigned URLs expire after 5 minutes
- ✅ File validation before URL generation
- ✅ S3 bucket has public read-only access
- ✅ CORS configured for allowed origins only
- ✅ IAM roles follow least privilege principle
