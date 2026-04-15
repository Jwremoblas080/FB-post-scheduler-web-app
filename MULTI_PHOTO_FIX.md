# Multi-Photo Upload Fix (6-10 Photos)

## Problem
Posts with 6-10 photos were failing due to AWS Lambda's 6MB payload limit when uploading through API Gateway.

## Solution
Implemented **S3 Presigned URL Upload** pattern:
1. Frontend requests presigned URLs from Lambda
2. Browser uploads files directly to S3 (bypasses Lambda payload limit)
3. Frontend sends S3 public URLs to Lambda for post creation

## Changes Made

### 1. Backend - S3 Upload Service (`lambda/services/s3Upload.ts`)
- Added `@aws-sdk/s3-request-presigner` import
- Created `generatePresignedUrls()` function
- Added validation for presigned URL requests
- Generates 5-minute expiring presigned URLs

### 2. Backend - API Handler (`lambda/handlers/api.ts`)
- Added `POST /upload/presigned-urls/images` endpoint
- Added `POST /upload/presigned-urls/video` endpoint
- Kept legacy endpoints for backward compatibility

### 3. Frontend - Post Form (`frontend/src/components/posts/PostForm.tsx`)
- Modified `handleSubmit()` to use presigned URLs
- Uploads files directly to S3 using `fetch()` with PUT method
- Parallel uploads using `Promise.all()` for better performance

### 4. Dependencies (`lambda/package.json`)
- Added `@aws-sdk/s3-request-presigner` package

## Benefits
✅ No more 6MB Lambda payload limit
✅ Faster uploads (parallel instead of sequential)
✅ No Lambda timeout issues with large files
✅ Reduced Lambda execution time and cost
✅ Better user experience with 6-10 photo posts

## Testing
To test the fix:
1. Install dependencies: `cd lambda && npm install`
2. Deploy: `npm run deploy`
3. Upload 6-10 photos in the frontend
4. Verify all photos appear in the post preview
5. Schedule and publish the post
6. Confirm all photos appear on Facebook

## Backward Compatibility
Legacy endpoints (`/upload/images` and `/upload/video`) are maintained for any existing integrations.

## Security
- Presigned URLs expire after 5 minutes
- S3 bucket CORS configured to allow PUT from frontend origins
- File validation happens before presigned URL generation
- Public read access only for uploaded files
