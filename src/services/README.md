# Services

## Authentication Service

### Overview

The `AuthenticationService` handles Facebook OAuth 2.0 authentication flow for the Facebook Post Scheduler application.

### Features

- Generate OAuth redirect URLs with required permissions
- Exchange authorization codes for access tokens
- Request `manage_pages` and `publish_pages` permissions
- Store and retrieve encrypted access tokens
- Validate token expiry

### Usage

```typescript
import { AuthenticationService } from './services/authService';

const authService = new AuthenticationService(
  'your_app_id',
  'your_app_secret',
  'http://localhost:3000/auth/callback',
  db
);

// Step 1: Generate OAuth redirect URL
const redirectUrl = authService.initiateLogin();
// Redirect user to this URL

// Step 2: Handle callback with authorization code
const accessToken = await authService.handleCallback(code);
// Store accessToken.token and accessToken.expiry
```

### API Reference

#### `initiateLogin(): string`

Generates a Facebook OAuth redirect URL with the required permissions.

**Returns:** OAuth redirect URL string

**Requirements:** 1.1, 1.5

#### `handleCallback(code: string): Promise<AccessToken>`

Exchanges an authorization code for an access token.

**Parameters:**
- `code`: Authorization code from Facebook OAuth callback

**Returns:** Promise resolving to `AccessToken` object with `token` and `expiry` fields

**Throws:** Error if the exchange fails

**Requirements:** 1.2

### Error Handling

The service throws descriptive errors for:
- Invalid authorization codes
- Network failures
- Facebook API errors

All errors include the original error message for debugging.

---

## Graph API Client

### Overview

The `GraphApiClient` provides a wrapper around Facebook's Graph API for retrieving pages and publishing content (photos and videos) to Facebook Pages.

### Features

- Retrieve user's Facebook Pages with permissions
- Publish single photos to Facebook Pages
- Publish multiple photos (albums/carousels) to Facebook Pages
- Publish videos to Facebook Pages
- Handle authentication headers automatically
- Parse and format API error responses

### Usage

```typescript
import { GraphApiClient } from './services/graphApiClient';

const client = new GraphApiClient();

// Retrieve user's Facebook Pages
const pages = await client.getPages(userAccessToken);

// Publish a single photo
const result = await client.publishPhoto(
  pageId,
  pageAccessToken,
  'https://example.com/photo.jpg',
  'My photo caption'
);

// Publish multiple photos
const multiResult = await client.publishPhotos(
  pageId,
  pageAccessToken,
  [
    'https://example.com/photo1.jpg',
    'https://example.com/photo2.jpg',
    'https://example.com/photo3.jpg'
  ],
  'Album caption'
);

// Publish a video
const videoResult = await client.publishVideo(
  pageId,
  pageAccessToken,
  'https://example.com/video.mp4',
  'Video description'
);
```

### API Reference

#### `getPages(accessToken: string): Promise<FacebookPage[]>`

Retrieves all Facebook Pages the user has permission to manage.

**Parameters:**
- `accessToken`: User's Facebook access token

**Returns:** Promise resolving to array of `FacebookPage` objects with `id`, `name`, and `accessToken` fields

**Throws:** Error if the API request fails

**Requirements:** 2.1, 2.2

#### `publishPhoto(pageId: string, pageAccessToken: string, photoUrl: string, caption: string): Promise<PublishResult>`

Publishes a single photo to a Facebook Page.

**Parameters:**
- `pageId`: Facebook Page ID
- `pageAccessToken`: Page-specific access token
- `photoUrl`: URL of the photo to publish
- `caption`: Caption text for the photo

**Returns:** Promise resolving to `PublishResult` with `success` boolean and optional `postId` or `error`

**Requirements:** 6.3

#### `publishPhotos(pageId: string, pageAccessToken: string, photoUrls: string[], caption: string): Promise<PublishResult>`

Publishes multiple photos as an album/carousel to a Facebook Page.

**Parameters:**
- `pageId`: Facebook Page ID
- `pageAccessToken`: Page-specific access token
- `photoUrls`: Array of photo URLs to publish
- `caption`: Caption text for the album

**Returns:** Promise resolving to `PublishResult` with `success` boolean and optional `postId` or `error`

**Requirements:** 6.3

#### `publishVideo(pageId: string, pageAccessToken: string, videoUrl: string, caption: string): Promise<PublishResult>`

Publishes a video to a Facebook Page.

**Parameters:**
- `pageId`: Facebook Page ID
- `pageAccessToken`: Page-specific access token
- `videoUrl`: URL of the video to publish
- `caption`: Description text for the video

**Returns:** Promise resolving to `PublishResult` with `success` boolean and optional `postId` or `error`

**Requirements:** 6.4

### Error Handling

The client provides robust error handling:
- Extracts descriptive error messages from Facebook API responses
- Includes error codes when available
- Handles network errors gracefully
- Returns structured error results for publish operations
- Throws errors with context for page retrieval failures

All publish methods return a `PublishResult` object instead of throwing, allowing the caller to handle failures gracefully.
