# Requirements Document

## Introduction

The Facebook Post Scheduler is a web application that enables users to schedule and automatically publish posts (images, videos, and captions) to their Facebook Pages at specified times. The system authenticates users via Facebook OAuth, manages media uploads, stores scheduled posts, and executes automated publishing through the Facebook Graph API.

## Glossary

- **System**: The Facebook Post Scheduler web application
- **User**: A person who authenticates and uses the application to schedule posts
- **Facebook_Page**: A Facebook Page that the User has permission to manage
- **Post**: A scheduled publication containing media (images or video) and caption text
- **Media**: Image files or video files uploaded by the User
- **Scheduler**: The background service that monitors and executes scheduled posts
- **Graph_API**: Facebook's Graph API used for authentication and posting
- **Access_Token**: OAuth token that grants permission to post to Facebook_Pages
- **Status**: The current state of a Post (pending, posted, or failed)
- **Caption**: Text content that accompanies the media in a Post
- **Scheduled_Time**: The date and time when a Post should be published
- **Upload_Service**: The component that handles media file storage
- **Database**: SQLite database that stores Post records
- **Frontend**: React-based user interface (client application)
- **Backend**: Node.js + Express server application
- **Authentication_Service**: The component that handles Facebook OAuth flow

## Requirements

### Requirement 1: User Authentication

**User Story:** As a User, I want to authenticate with my Facebook account, so that I can manage posts on my Facebook Pages.

#### Acceptance Criteria

1. WHEN a User initiates login, THE Authentication_Service SHALL redirect the User to Facebook OAuth authorization
2. WHEN Facebook OAuth returns an authorization code, THE Authentication_Service SHALL exchange it for an Access_Token
3. THE Authentication_Service SHALL store the Access_Token securely for subsequent API requests
4. WHEN the Access_Token is invalid or expired, THE System SHALL prompt the User to re-authenticate
5. THE Authentication_Service SHALL request permissions to manage_pages and publish_pages from Facebook

### Requirement 2: Facebook Page Retrieval

**User Story:** As a User, I want to view my Facebook Pages, so that I can select which page to post to.

#### Acceptance Criteria

1. WHEN a User is authenticated, THE System SHALL retrieve all Facebook_Pages the User has permission to manage
2. THE System SHALL use the Graph_API with the Access_Token to fetch page information
3. THE Frontend SHALL display a list of available Facebook_Pages with their names and IDs
4. WHEN the Graph_API request fails, THE System SHALL return a descriptive error message to the User

### Requirement 3: Media Upload

**User Story:** As a User, I want to upload images or videos, so that I can include them in my scheduled posts.

#### Acceptance Criteria

1. THE Upload_Service SHALL accept image files in JPEG, PNG, and GIF formats
2. THE Upload_Service SHALL accept video files in MP4, MOV, and AVI formats
3. WHEN a User uploads images, THE Upload_Service SHALL accept multiple image files
4. WHEN a User uploads a video, THE Upload_Service SHALL accept only one video file per Post
5. THE Upload_Service SHALL store uploaded Media files in the /uploads directory
6. WHEN a file exceeds 100MB, THE Upload_Service SHALL reject the upload and return an error message
7. THE Upload_Service SHALL return the file path for each successfully uploaded Media file

### Requirement 4: Post Creation

**User Story:** As a User, I want to create a scheduled post with media and caption, so that it publishes automatically at my chosen time.

#### Acceptance Criteria

1. THE Frontend SHALL provide a form with fields for Caption, Media upload, Scheduled_Time, and Facebook_Page selection
2. WHEN a User submits the form, THE Backend SHALL validate that all required fields are provided
3. THE Backend SHALL store the Post in the Database with Status set to "pending"
4. THE Database SHALL record the Caption, media file paths, media type, Scheduled_Time, Facebook_Page ID, and creation timestamp
5. WHEN the Scheduled_Time is in the past, THE Backend SHALL reject the Post creation and return an error
6. THE Backend SHALL return the created Post details to the Frontend upon successful creation

### Requirement 5: Scheduled Post Management

**User Story:** As a User, I want to view my scheduled posts, so that I can track what will be published.

#### Acceptance Criteria

1. THE Backend SHALL provide an endpoint to retrieve all Posts for the authenticated User
2. THE Frontend SHALL display a list of Posts showing Caption, Media preview, Scheduled_Time, Facebook_Page name, and Status
3. THE Frontend SHALL sort Posts by Scheduled_Time in ascending order
4. THE Frontend SHALL display Status indicators with distinct visual styles for "pending", "posted", and "failed" states
5. WHEN a User requests to delete a Post, THE Backend SHALL remove it from the Database
6. THE Backend SHALL only allow deletion of Posts with Status "pending" or "failed"

### Requirement 6: Automated Post Publishing

**User Story:** As a User, I want my posts to publish automatically at the scheduled time, so that I don't have to manually post them.

#### Acceptance Criteria

1. THE Scheduler SHALL execute every 60 seconds to check for Posts ready to publish
2. WHEN the current time is greater than or equal to a Post's Scheduled_Time and Status is "pending", THE Scheduler SHALL attempt to publish the Post
3. WHEN publishing an image Post, THE Scheduler SHALL use the Graph_API endpoint /page-id/photos
4. WHEN publishing a video Post, THE Scheduler SHALL use the Graph_API endpoint /page-id/videos
5. THE Scheduler SHALL include the Caption in the Graph_API request
6. WHEN the Graph_API request succeeds, THE Scheduler SHALL update the Post Status to "posted"
7. WHEN the Graph_API request fails, THE Scheduler SHALL update the Post Status to "failed"
8. THE Scheduler SHALL log all publishing attempts with timestamps and results

### Requirement 7: Error Handling and Recovery

**User Story:** As a User, I want to see clear error messages when something goes wrong, so that I can understand and resolve issues.

#### Acceptance Criteria

1. WHEN a Graph_API request fails, THE System SHALL log the error details including error code and message
2. WHEN a Post fails to publish, THE System SHALL store the error message in the Database
3. THE Frontend SHALL display error messages to the User in a clear, non-technical format
4. WHEN the Backend encounters an error, THE Backend SHALL return appropriate HTTP status codes (400 for client errors, 500 for server errors)
5. WHEN file upload fails, THE Upload_Service SHALL clean up any partially uploaded files

### Requirement 8: API Rate Limit Compliance

**User Story:** As a system administrator, I want the application to respect Facebook's API rate limits, so that the service remains available.

#### Acceptance Criteria

1. WHEN the Graph_API returns a rate limit error, THE System SHALL log the error and retry after the specified wait time
2. THE Scheduler SHALL implement exponential backoff for failed publishing attempts
3. THE System SHALL not exceed 200 Graph_API requests per hour per User
4. WHEN approaching rate limits, THE System SHALL queue Posts for delayed execution

### Requirement 9: Security and Token Management

**User Story:** As a User, I want my Facebook credentials to be secure, so that my account is protected.

#### Acceptance Criteria

1. THE Backend SHALL store Access_Tokens encrypted in the Database
2. THE Backend SHALL not expose Access_Tokens in API responses or logs
3. THE Backend SHALL use HTTPS for all communication between Frontend and Backend
4. THE Backend SHALL validate and sanitize all User inputs to prevent injection attacks
5. THE Backend SHALL implement CORS policies to restrict API access to authorized origins

### Requirement 10: Database Schema and Persistence

**User Story:** As a developer, I want a well-defined database schema, so that data is stored consistently and reliably.

#### Acceptance Criteria

1. THE Database SHALL contain a Posts table with columns: id, caption, media_url, media_type, scheduled_time, status, page_id, created_at, error_message
2. THE Database SHALL contain a Users table with columns: id, facebook_user_id, access_token, token_expiry, created_at
3. THE Database SHALL enforce foreign key relationships between Posts and Users
4. THE Database SHALL use SQLite as the storage engine
5. WHEN the application starts, THE Backend SHALL initialize the Database schema if it does not exist

### Requirement 11: Multi-Image Post Support

**User Story:** As a User, I want to upload multiple images in a single post, so that I can create photo albums.

#### Acceptance Criteria

1. WHEN a User uploads multiple images, THE Upload_Service SHALL store all image file paths as a JSON array
2. WHEN publishing a multi-image Post, THE Scheduler SHALL use the Graph_API batch upload endpoint
3. THE System SHALL support up to 10 images per Post
4. THE Frontend SHALL display thumbnails of all uploaded images in the Post creation form

### Requirement 12: Configuration Parser and Validation

**User Story:** As a developer, I want to parse and validate configuration files, so that the application starts with correct settings.

#### Acceptance Criteria

1. WHEN the application starts, THE Config_Parser SHALL parse the configuration file into a Configuration object
2. WHEN an invalid configuration file is provided, THE Config_Parser SHALL return a descriptive error message
3. THE Config_Validator SHALL verify that required fields (database_path, upload_directory, facebook_app_id, facebook_app_secret) are present
4. THE Pretty_Printer SHALL format Configuration objects back into valid configuration files
5. FOR ALL valid Configuration objects, parsing then printing then parsing SHALL produce an equivalent object (round-trip property)
