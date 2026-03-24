# Scheduler Service

## Overview

The Scheduler Service is responsible for automatically publishing scheduled posts to Facebook Pages at their designated times. It runs as a background process that polls the database every 60 seconds to check for posts that are ready to be published.

## Requirements

This implementation satisfies the following requirements:
- **Requirement 6.1**: The Scheduler executes every 60 seconds to check for posts ready to publish
- **Requirement 6.2**: When the current time is greater than or equal to a post's scheduled time and status is "pending", the Scheduler attempts to publish the post

## Architecture

The scheduler service consists of:

1. **SchedulerService class** (`schedulerService.ts`): Core scheduling logic
   - `start()`: Starts the polling mechanism (runs every 60 seconds)
   - `stop()`: Stops the polling mechanism
   - `checkAndPublishPosts()`: Queries pending posts and publishes those that are due
   - `getPendingPosts()`: Queries the database for posts with status "pending" and scheduled_time <= current time

2. **Standalone scheduler process** (`scheduler.ts`): Entry point for running the scheduler independently
   - Initializes database connection
   - Creates service instances
   - Starts the scheduler
   - Handles graceful shutdown (SIGINT, SIGTERM)

## Usage

### Running the Scheduler

**Development mode:**
```bash
npm run scheduler
```

**Production mode:**
```bash
npm run build
npm run scheduler:prod
```

### Integration with Main Application

The scheduler can also be integrated into the main application server:

```typescript
import { getDatabase } from './database/init';
import { SchedulerService } from './services/schedulerService';
import { GraphApiClient } from './services/graphApiClient';
import { PostManagementService } from './services/postService';

const db = getDatabase();
const graphApiClient = new GraphApiClient();
const postService = new PostManagementService(db);
const schedulerService = new SchedulerService(db, graphApiClient, postService);

// Start the scheduler
schedulerService.start();

// Stop the scheduler when needed
schedulerService.stop();
```

## Database Query

The scheduler queries the database using the following logic:

```sql
SELECT * FROM posts
WHERE status = 'pending' 
  AND scheduled_time <= current_timestamp
ORDER BY scheduled_time ASC
```

This ensures:
- Only pending posts are considered
- Only posts whose scheduled time has passed are selected
- Posts are processed in chronological order (earliest first)

## Polling Mechanism

The scheduler uses `setInterval` to run every 60 seconds:

1. On `start()`, the scheduler immediately runs `checkAndPublishPosts()`
2. Then it sets up an interval to run `checkAndPublishPosts()` every 60,000 milliseconds (60 seconds)
3. On `stop()`, the interval is cleared and the scheduler stops polling

## Logging

The scheduler logs the following events:
- Scheduler start/stop events
- Number of pending posts found in each polling cycle
- Individual post publishing attempts (placeholder in Task 10.1, full implementation in Task 10.2)

Example log output:
```
Starting Facebook Post Scheduler...
Scheduler started - checking for posts every 60 seconds
[2024-01-15T10:00:00.000Z] Found 3 pending post(s) to publish
[2024-01-15T10:00:00.100Z] Publishing post 1...
[2024-01-15T10:00:00.200Z] Publishing post 2...
[2024-01-15T10:00:00.300Z] Publishing post 3...
[2024-01-15T10:01:00.000Z] No pending posts to publish
```

## Testing

The scheduler service includes comprehensive unit tests:

```bash
npm test -- schedulerService.test.ts
```

Test coverage includes:
- Querying pending posts with scheduled time <= current time
- Handling cases when no pending posts are due
- Querying multiple pending posts in chronological order
- Only querying posts with status "pending" (not "posted" or "failed")
- Starting and stopping the scheduler
- Preventing duplicate scheduler instances
- Verifying the 60-second polling interval

## Future Enhancements (Task 10.2+)

The following features will be implemented in subsequent tasks:

- **Task 10.2**: Full post publishing logic
  - Call Facebook Graph API based on media type
  - Update post status to "posted" on success
  - Update post status to "failed" on error with error message
  
- **Task 10.3**: Rate limiting and retry logic
  - Exponential backoff for failed attempts
  - Handle rate limit errors with wait time
  - Track API requests per hour (max 200 per user)
  - Queue posts when approaching rate limits

- **Task 10.4**: Enhanced logging
  - Log all publishing attempts with timestamps
  - Log error details for failed attempts
  - Store error messages in database

## Notes

- The scheduler runs independently of the main API server
- Multiple scheduler instances should not be run simultaneously (they would conflict)
- The scheduler requires a valid database connection
- Post publishing logic is a placeholder in Task 10.1 and will be fully implemented in Task 10.2
