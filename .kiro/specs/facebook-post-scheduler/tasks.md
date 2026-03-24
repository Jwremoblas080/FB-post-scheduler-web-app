# Implementation Plan: Facebook Post Scheduler

## Overview

This implementation plan breaks down the Facebook Post Scheduler into discrete coding tasks. The system will be built using TypeScript/Node.js for the backend, React for the frontend, and SQLite for data persistence. Tasks are organized to build incrementally, starting with core infrastructure, then authentication, data management, scheduling, and finally the frontend interface.

## Tasks

- [x] 1. Set up project structure and database schema
  - [x] 1.1 Initialize Node.js/TypeScript backend project with Express
    - Create package.json with dependencies (express, sqlite3, typescript, etc.)
    - Configure TypeScript with tsconfig.json
    - Set up project directory structure (src/, uploads/, etc.)
    - _Requirements: 10.4_
  
  - [x] 1.2 Create SQLite database schema and initialization
    - Implement database initialization script
    - Create Users table with encrypted token storage
    - Create Posts table with foreign key constraints
    - Create index on scheduled_time and status columns
    - _Requirements: 10.1, 10.2, 10.3, 10.5_
  
  - [ ]* 1.3 Write property test for database schema
    - **Property 32: Foreign Key Constraint Enforcement**
    - **Validates: Requirements 10.3**

- [x] 2. Implement Configuration Parser
  - [x] 2.1 Create configuration parser and validator
    - Implement parse() method to read configuration files
    - Implement validate() method to check required fields
    - Implement prettyPrint() method to format configuration
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  
  - [ ]* 2.2 Write property test for configuration round-trip
    - **Property 35: Configuration Parsing Success**
    - **Property 36: Invalid Configuration Error Reporting**
    - **Property 38: Configuration Round-Trip Preservation**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.5**

- [x] 3. Implement Authentication Service
  - [x] 3.1 Create Facebook OAuth flow handlers
    - Implement initiateLogin() to generate OAuth redirect URL
    - Implement handleCallback() to exchange authorization code for access token
    - Request manage_pages and publish_pages permissions
    - _Requirements: 1.1, 1.2, 1.5_
  
  - [x] 3.2 Implement token storage with encryption
    - Create encryption/decryption utilities
    - Implement getStoredToken() to retrieve encrypted tokens
    - Implement token expiry checking
    - _Requirements: 1.3, 1.4, 9.1_
  
  - [ ]* 3.3 Write property tests for authentication
    - **Property 1: OAuth Code Exchange**
    - **Property 2: Token Storage Round-Trip**
    - **Property 3: Expired Token Detection**
    - **Property 29: Token Encryption in Storage**
    - **Validates: Requirements 1.2, 1.3, 1.4, 9.1**

- [x] 4. Implement Facebook Graph API Client
  - [x] 4.1 Create Graph API wrapper with authentication
    - Implement getPages() to retrieve user's Facebook Pages
    - Implement publishPhoto() for single image posts
    - Implement publishPhotos() for multi-image posts
    - Implement publishVideo() for video posts
    - Handle authentication headers and API responses
    - _Requirements: 2.1, 2.2, 6.3, 6.4_
  
  - [ ]* 4.2 Write property tests for Graph API client
    - **Property 4: Page List Rendering Completeness**
    - **Property 5: API Error Message Propagation**
    - **Property 21: API Error Detail Logging**
    - **Validates: Requirements 2.3, 2.4, 7.1**

- [x] 5. Checkpoint - Ensure authentication and API client tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Upload Service
  - [x] 6.1 Create file upload handler with validation
    - Implement uploadImages() to handle multiple image uploads
    - Implement uploadVideo() to handle single video upload
    - Implement validateFile() to check file types and sizes
    - Store files in /uploads directory and return file paths
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  
  - [x] 6.2 Implement upload error handling and cleanup
    - Implement deleteFile() for cleanup on failures
    - Handle oversized files (>100MB) with appropriate errors
    - Clean up partial uploads on failure
    - _Requirements: 3.6, 7.5_
  
  - [ ]* 6.3 Write property tests for upload service
    - **Property 6: Valid File Format Acceptance**
    - **Property 7: Multiple Image Upload Support**
    - **Property 8: Uploaded File Accessibility**
    - **Property 24: Failed Upload Cleanup**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.7, 7.5**

- [x] 7. Implement Post Management Service
  - [x] 7.1 Create post CRUD operations
    - Implement createPost() with validation
    - Implement getPosts() to retrieve user's posts
    - Implement deletePost() with status restrictions
    - Implement updatePostStatus() for scheduler updates
    - _Requirements: 4.2, 4.3, 4.6, 5.1, 5.5, 5.6_
  
  - [x] 7.2 Implement post validation and business logic
    - Validate required fields (caption, media, scheduled time, page ID)
    - Reject posts with scheduled time in the past
    - Enforce deletion restrictions (only pending/failed posts)
    - Store multi-image paths as JSON array
    - _Requirements: 4.2, 4.5, 5.6, 11.1_
  
  - [ ]* 7.3 Write property tests for post management
    - **Property 9: Required Field Validation**
    - **Property 10: New Post Initial State**
    - **Property 11: Post Creation Round-Trip**
    - **Property 14: Post Deletion Removes Record**
    - **Property 15: Deletion Status Restriction**
    - **Property 33: Multi-Image Path Storage Format**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.6, 5.5, 5.6, 11.1**

- [x] 8. Implement Backend API Endpoints
  - [x] 8.1 Create Express routes for authentication
    - POST /auth/login - Initiate OAuth flow
    - GET /auth/callback - Handle OAuth callback
    - GET /auth/pages - Retrieve user's Facebook Pages
    - _Requirements: 1.1, 1.2, 2.1_
  
  - [x] 8.2 Create Express routes for post management
    - POST /posts - Create new scheduled post
    - GET /posts - Retrieve user's posts
    - DELETE /posts/:id - Delete a post
    - _Requirements: 4.1, 5.1, 5.5_
  
  - [x] 8.3 Create Express routes for media upload
    - POST /upload/images - Upload multiple images
    - POST /upload/video - Upload single video
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [x] 8.4 Implement security middleware
    - Add HTTPS enforcement
    - Implement CORS policies
    - Add input sanitization middleware
    - Implement token exclusion from responses
    - _Requirements: 9.2, 9.3, 9.4, 9.5_
  
  - [ ]* 8.5 Write property tests for security
    - **Property 30: Token Exclusion from Responses**
    - **Property 31: Input Sanitization**
    - **Validates: Requirements 9.2, 9.4**

- [x] 9. Checkpoint - Ensure backend API tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Scheduler Service
  - [x] 10.1 Create scheduler polling mechanism
    - Implement checkAndPublishPosts() to run every 60 seconds
    - Query database for posts with status "pending" and scheduled_time <= now
    - _Requirements: 6.1, 6.2_
  
  - [x] 10.2 Implement post publishing logic
    - Implement publishPost() to call Graph API based on media type
    - Include caption in all publish requests
    - Update post status to "posted" on success
    - Update post status to "failed" on error with error message
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.7_
  
  - [x] 10.3 Implement rate limiting and retry logic
    - Implement exponential backoff for failed attempts
    - Handle rate limit errors with wait time
    - Track API requests per hour (max 200 per user)
    - Queue posts when approaching rate limits
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [x] 10.4 Implement scheduler logging
    - Log all publishing attempts with timestamps
    - Log error details for failed attempts
    - Store error messages in database
    - _Requirements: 6.8, 7.1, 7.2_
  
  - [ ]* 10.5 Write property tests for scheduler
    - **Property 16: Due Post Publishing Trigger**
    - **Property 17: Caption Inclusion in Publish Request**
    - **Property 18: Successful Publish Status Update**
    - **Property 19: Failed Publish Status Update**
    - **Property 20: Publishing Attempt Logging**
    - **Property 22: Failed Post Error Persistence**
    - **Property 25: Rate Limit Error Handling**
    - **Property 26: Exponential Backoff Timing**
    - **Property 27: API Request Rate Limiting**
    - **Property 28: Near-Limit Post Queuing**
    - **Validates: Requirements 6.2, 6.5, 6.6, 6.7, 6.8, 7.1, 7.2, 8.1, 8.2, 8.3, 8.4**

- [x] 11. Implement React Frontend
  - [x] 11.1 Set up React project with TypeScript
    - Initialize React app with TypeScript template
    - Configure API client for backend communication
    - Set up routing (if needed)
    - _Requirements: 4.1_
  
  - [x] 11.2 Create authentication UI components
    - Create login button that initiates OAuth flow
    - Handle OAuth callback redirect
    - Display authentication errors
    - _Requirements: 1.1, 1.4_
  
  - [x] 11.3 Create post creation form
    - Build form with caption input, media upload, scheduled time picker, and page selector
    - Implement multi-image upload with preview
    - Implement single video upload with preview
    - Display validation errors
    - _Requirements: 4.1, 4.2, 11.4_
  
  - [x] 11.4 Create post list view
    - Display posts sorted by scheduled time (ascending)
    - Show caption, media preview, scheduled time, page name, and status
    - Implement status indicators with distinct visual styles
    - Display thumbnails for multi-image posts
    - Add delete button for pending/failed posts
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 11.4_
  
  - [x] 11.5 Implement error display components
    - Create user-friendly error message display
    - Show appropriate HTTP status code errors
    - Display Graph API errors in non-technical format
    - _Requirements: 7.3, 7.4_
  
  - [ ]* 11.6 Write property tests for frontend
    - **Property 12: Post List Rendering Completeness**
    - **Property 13: Post List Chronological Ordering**
    - **Property 23: Error HTTP Status Code Mapping**
    - **Property 34: Multi-Image Thumbnail Display**
    - **Validates: Requirements 5.2, 5.3, 7.4, 11.4**

- [x] 12. Integration and wiring
  - [x] 12.1 Wire backend services together
    - Connect authentication service to API routes
    - Connect upload service to post management
    - Connect Graph API client to scheduler
    - Ensure all services use shared database connection
    - _Requirements: All_
  
  - [x] 12.2 Wire frontend to backend API
    - Connect authentication flow end-to-end
    - Connect post creation form to backend
    - Connect post list to backend
    - Handle all API responses and errors
    - _Requirements: All_
  
  - [x] 12.3 Set up scheduler as separate process
    - Create scheduler entry point
    - Configure scheduler to run independently
    - Ensure scheduler shares database with backend
    - _Requirements: 6.1_
  
  - [ ]* 12.4 Write integration tests
    - Test complete user flow: login → create post → view posts → delete post
    - Test scheduler publishing flow
    - Test error handling across layers
    - _Requirements: All_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript for type safety across frontend and backend
