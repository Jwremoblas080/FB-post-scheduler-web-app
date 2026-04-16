# 🏗️ Deployment Architecture

This document explains where and how the Facebook Post Scheduler is deployed.

---

## 📍 Deployment Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         USER BROWSER                         │
│                  (Anywhere in the world)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                         │
│  URL: https://fb-post-scheduler-web-app-m5uf.vercel.app    │
│  - React 18 + TypeScript                                    │
│  - Hosted on Vercel's Global CDN                            │
│  - Auto-deploys from Git                                    │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS + JWT Token
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (AWS Lambda + API Gateway)              │
│  URL: https://o6i2c5bnjg.execute-api.us-east-1.amazonaws.com│
│  Region: us-east-1 (N. Virginia)                            │
│  - AWS Lambda Functions (Node.js 20)                        │
│  - API Gateway (HTTP API)                                   │
│  - Serverless Framework                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌─────────┐   ┌──────────┐   ┌──────────┐
    │DynamoDB │   │    S3    │   │   SSM    │
    │Database │   │  Bucket  │   │ Secrets  │
    └─────────┘   └──────────┘   └──────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│           SCHEDULER (AWS Lambda + EventBridge)               │
│  - Runs every 60 seconds                                     │
│  - Checks for posts ready to publish                         │
│  - Publishes to Facebook Graph API                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
                ┌─────────────────┐
                │  Facebook API   │
                │  Graph API      │
                └─────────────────┘
```

---

## 🌐 Frontend Deployment (Vercel)

### Where It's Deployed
- **Platform**: Vercel (Serverless hosting)
- **URL**: https://fb-post-scheduler-web-app-m5uf.vercel.app
- **Region**: Global CDN (automatically distributed worldwide)

### What's Deployed
- React 18 application built with Vite
- Static files (HTML, CSS, JavaScript)
- Optimized and minified production build

### How It's Deployed
1. **Automatic Deployment**:
   - Connected to Git repository
   - Auto-deploys when you push to `main` branch
   - Build command: `npm run build`
   - Output directory: `dist/`

2. **Manual Deployment**:
   ```bash
   cd frontend
   vercel --prod
   ```

### Environment Variables (Vercel)
- `VITE_API_URL`: Points to AWS API Gateway URL

### Configuration Files
- `frontend/vercel.json` - Vercel configuration
- `frontend/vite.config.ts` - Build configuration
- `frontend/package.json` - Dependencies and scripts

---

## ☁️ Backend Deployment (AWS)

### Where It's Deployed
- **Platform**: AWS (Amazon Web Services)
- **Region**: us-east-1 (N. Virginia)
- **Account ID**: 839000214990
- **Stage**: dev

### AWS Services Used

#### 1. AWS Lambda Functions
Two Lambda functions deployed:

**API Function** (`fb-post-scheduler-dev-api`):
- **Handler**: `dist/handlers/api.handler`
- **Runtime**: Node.js 20.x
- **Memory**: 512 MB
- **Timeout**: 29 seconds
- **Purpose**: Handles all API requests (auth, posts, uploads)
- **Trigger**: API Gateway HTTP requests

**Scheduler Function** (`fb-post-scheduler-dev-scheduler`):
- **Handler**: `dist/handlers/scheduler.handler`
- **Runtime**: Node.js 20.x
- **Memory**: 512 MB
- **Timeout**: 300 seconds (5 minutes)
- **Purpose**: Auto-publishes scheduled posts
- **Trigger**: EventBridge (every 60 seconds)

#### 2. API Gateway (HTTP API)
- **Type**: HTTP API (v2)
- **URL**: https://o6i2c5bnjg.execute-api.us-east-1.amazonaws.com
- **Stage**: $default (auto-deploy)
- **Routes**:
  - `ANY /` - Root endpoint
  - `ANY /{proxy+}` - All other endpoints

#### 3. DynamoDB (Database)
- **Table Name**: `fb-post-scheduler-dev`
- **Billing**: Pay-per-request (on-demand)
- **Keys**:
  - Primary: PK (partition key), SK (sort key)
  - GSI1: GSI1PK, GSI1SK (for queries)
- **Features**: TTL enabled for automatic cleanup

#### 4. S3 (File Storage)
- **Bucket Name**: `fb-post-scheduler-uploads-dev`
- **Region**: us-east-1
- **Purpose**: Store uploaded images/videos
- **Access**: Private (presigned URLs for uploads)
- **CORS**: Configured for Vercel and localhost

#### 5. SSM Parameter Store (Secrets)
All secrets stored securely:
- `/fb-scheduler/dev/facebook-app-id`
- `/fb-scheduler/dev/facebook-app-secret`
- `/fb-scheduler/dev/facebook-redirect-uri`
- `/fb-scheduler/dev/encryption-key`
- `/fb-scheduler/dev/encryption-secret`
- `/fb-scheduler/dev/jwt-secret`
- `/fb-scheduler/dev/frontend-url`
- `/fb-scheduler/dev/allowed-origins`

#### 6. EventBridge (Scheduler)
- **Rule**: Triggers scheduler Lambda every 1 minute
- **Expression**: `rate(1 minute)`
- **Status**: Enabled

#### 7. CloudWatch Logs
- `/aws/lambda/fb-post-scheduler-dev-api` - API logs
- `/aws/lambda/fb-post-scheduler-dev-scheduler` - Scheduler logs

### How It's Deployed

**Using Serverless Framework**:
```bash
cd lambda
npm run deploy
```

This command:
1. Compiles TypeScript to JavaScript (`dist/` folder)
2. Packages code and dependencies into a ZIP file
3. Uploads to S3 deployment bucket
4. Creates/updates CloudFormation stack
5. Deploys Lambda functions
6. Creates/updates API Gateway
7. Creates/updates DynamoDB table
8. Creates/updates S3 bucket
9. Sets up IAM roles and permissions

### Configuration Files
- `lambda/serverless.yml` - Infrastructure as Code (IaC)
- `lambda/tsconfig.json` - TypeScript configuration
- `lambda/package.json` - Dependencies and scripts

---

## 🔄 Data Flow

### 1. User Creates a Post

```
User Browser
    ↓ (1) User fills form and uploads photos
Frontend (Vercel)
    ↓ (2) POST /upload/presigned-urls (get S3 URLs)
API Lambda
    ↓ (3) Generate presigned URLs
S3 Bucket
    ↓ (4) Browser uploads directly to S3
Frontend
    ↓ (5) POST /posts (create post with S3 URLs)
API Lambda
    ↓ (6) Save post to database
DynamoDB
```

### 2. Scheduler Publishes Post

```
EventBridge (every 60 seconds)
    ↓ (1) Trigger scheduler Lambda
Scheduler Lambda
    ↓ (2) Query posts ready to publish
DynamoDB
    ↓ (3) Get pending posts
Scheduler Lambda
    ↓ (4) Download media from S3
S3 Bucket
    ↓ (5) Publish to Facebook
Facebook Graph API
    ↓ (6) Update post status
DynamoDB
```

### 3. User Views Posts

```
User Browser
    ↓ (1) GET /posts
Frontend (Vercel)
    ↓ (2) Request with JWT token
API Lambda
    ↓ (3) Verify JWT
    ↓ (4) Query user's posts
DynamoDB
    ↓ (5) Return posts
API Lambda
    ↓ (6) Send response
Frontend
    ↓ (7) Display posts
User Browser
```

---

## 💰 Cost Breakdown

### Vercel (Frontend)
- **Free Tier**: Hobby plan (sufficient for this project)
- **Cost**: $0/month

### AWS (Backend)
Estimated monthly costs for low-medium usage:

- **Lambda**: ~$5-10/month
  - API: ~1M requests/month
  - Scheduler: ~43,200 invocations/month (60 seconds × 24 hours × 30 days)
  
- **API Gateway**: ~$1-3/month
  - HTTP API: $1 per million requests
  
- **DynamoDB**: ~$1-5/month
  - Pay-per-request pricing
  - Depends on read/write volume
  
- **S3**: ~$1-5/month
  - Storage: $0.023 per GB
  - Requests: Minimal cost
  
- **Data Transfer**: ~$1-5/month
  - First 1 GB free
  - $0.09 per GB after

**Total Estimated Cost**: $10-30/month (depending on usage)

---

## 🔐 Security

### Frontend (Vercel)
- HTTPS enforced
- Environment variables encrypted
- DDoS protection included
- Global CDN with edge caching

### Backend (AWS)
- All traffic over HTTPS
- JWT authentication on all endpoints
- Rate limiting (100 req/15min)
- Input sanitization
- Secrets in SSM (encrypted)
- Private S3 bucket
- IAM roles with least privilege
- CloudWatch logging enabled

---

## 📊 Monitoring & Logs

### Frontend (Vercel)
- **Dashboard**: https://vercel.com/dashboard
- **Logs**: Real-time function logs
- **Analytics**: Page views, performance metrics

### Backend (AWS)
- **CloudWatch Logs**:
  ```bash
  cd lambda
  npm run logs:api        # View API logs
  npm run logs:scheduler  # View scheduler logs
  ```

- **CloudWatch Dashboard**: AWS Console → CloudWatch
- **Lambda Metrics**: Invocations, errors, duration
- **API Gateway Metrics**: Requests, latency, errors
- **DynamoDB Metrics**: Read/write capacity, throttles

---

## 🚀 Deployment Commands

### Deploy Frontend
```bash
cd frontend
npm run build           # Build locally
vercel --prod          # Deploy to Vercel
```

### Deploy Backend
```bash
cd lambda
npm install            # Install dependencies
npx tsc               # Compile TypeScript
npm run deploy        # Deploy to AWS
```

### View Logs
```bash
cd lambda
npm run logs:api       # API logs
npm run logs:scheduler # Scheduler logs
```

### Remove Deployment (Cleanup)
```bash
cd lambda
npm run remove         # Remove all AWS resources
```

---

## 🌍 Regions & Availability

### Frontend (Vercel)
- **Global**: Deployed to Vercel's global CDN
- **Edge Locations**: 100+ locations worldwide
- **Availability**: 99.99% uptime SLA

### Backend (AWS)
- **Region**: us-east-1 (N. Virginia)
- **Availability Zones**: Multi-AZ (automatic)
- **Availability**: 99.95% uptime SLA

---

## 📝 URLs Summary

| Component | URL | Purpose |
|-----------|-----|---------|
| Frontend | https://fb-post-scheduler-web-app-m5uf.vercel.app | User interface |
| Backend API | https://o6i2c5bnjg.execute-api.us-east-1.amazonaws.com | REST API |
| S3 Bucket | fb-post-scheduler-uploads-dev | Media storage |
| DynamoDB | fb-post-scheduler-dev | Database |

---

## 🔄 CI/CD Pipeline

### Frontend (Automatic)
```
Git Push → GitHub → Vercel
    ↓
  Build (npm run build)
    ↓
  Deploy to CDN
    ↓
  Live in ~30 seconds
```

### Backend (Manual)
```
Code Changes → Git Commit
    ↓
  npm run deploy
    ↓
  Serverless Framework
    ↓
  CloudFormation Stack Update
    ↓
  Lambda Functions Updated
    ↓
  Live in ~2-3 minutes
```

---

## 🆘 Troubleshooting Deployments

### Frontend Issues
```bash
# Check Vercel deployment status
vercel ls

# View deployment logs
vercel logs <deployment-url>

# Redeploy
vercel --prod --force
```

### Backend Issues
```bash
# Check CloudFormation stack
aws cloudformation describe-stacks \
  --stack-name fb-post-scheduler-dev \
  --region us-east-1

# View Lambda function
aws lambda get-function \
  --function-name fb-post-scheduler-dev-api \
  --region us-east-1

# Check API Gateway
aws apigatewayv2 get-apis --region us-east-1
```

---

**Last Updated**: April 2026  
**Deployment Status**: ✅ Production Ready
