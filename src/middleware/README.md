# Security Middleware

This directory contains security middleware implementations for the Facebook Post Scheduler application.

## Overview

The security middleware implements four key security requirements:

1. **HTTPS Enforcement** (Requirement 9.3)
2. **CORS Policies** (Requirement 9.5)
3. **Input Sanitization** (Requirement 9.4)
4. **Token Exclusion** (Requirement 9.2)

## Middleware Components

### 1. HTTPS Enforcement (`enforceHttps`)

Ensures all communication uses HTTPS in production environments.

**Features:**
- Automatically redirects HTTP requests to HTTPS
- Skips enforcement in development mode
- Supports reverse proxy configurations (checks `x-forwarded-proto` header)

**Usage:**
```typescript
app.use(enforceHttps);
```

### 2. Input Sanitization (`sanitizeInput`)

Validates and sanitizes all user inputs to prevent injection attacks.

**Features:**
- Removes script tags and event handlers (XSS prevention)
- Strips SQL injection patterns
- Sanitizes request body, query parameters, and URL parameters
- Handles nested objects and arrays
- Preserves non-string values

**Protected Against:**
- Cross-Site Scripting (XSS)
- SQL Injection
- Null byte injection

**Usage:**
```typescript
app.use(sanitizeInput);
```

### 3. Token Exclusion (`excludeTokensFromResponse`)

Prevents sensitive tokens from being exposed in API responses.

**Features:**
- Automatically filters out fields containing "token", "secret", or "password"
- Works with nested objects and arrays
- Case-insensitive field name matching

**Usage:**
```typescript
app.use(excludeTokensFromResponse);
```

### 4. CORS Configuration (`getCorsOptions`)

Implements CORS policies to restrict API access to authorized origins.

**Features:**
- Configurable allowed origins via environment variable
- Supports credentials
- Allows common HTTP methods (GET, POST, PUT, DELETE, OPTIONS)
- 24-hour preflight cache

**Configuration:**
Set the `ALLOWED_ORIGINS` environment variable:
```
ALLOWED_ORIGINS=http://localhost:3000,https://example.com
```

**Usage:**
```typescript
import cors from 'cors';
import { getCorsOptions } from './middleware/security';

app.use(cors(getCorsOptions()));
```

## Implementation in Main Application

The security middleware is applied in `src/index.ts`:

```typescript
import { 
  enforceHttps, 
  sanitizeInput, 
  excludeTokensFromResponse, 
  getCorsOptions 
} from './middleware/security';

// Security Middleware (Requirements: 9.2, 9.3, 9.4, 9.5)
app.use(enforceHttps); // HTTPS enforcement
app.use(cors(getCorsOptions())); // CORS policies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeInput); // Input sanitization
app.use(excludeTokensFromResponse); // Token exclusion from responses
```

## Testing

The security middleware includes comprehensive test coverage:

- **Unit Tests** (`security.test.ts`): Tests individual middleware functions
- **Integration Tests** (`security.integration.test.ts`): Tests middleware in realistic scenarios

Run tests:
```bash
npm test -- src/middleware/security.test.ts
npm test -- src/middleware/security.integration.test.ts
```

## Security Considerations

### Input Sanitization Limitations

The input sanitization provides basic protection but should not be the only security measure:

- Use parameterized queries for database operations
- Implement proper authentication and authorization
- Validate business logic constraints
- Use Content Security Policy (CSP) headers

### Token Security

The token exclusion middleware prevents accidental exposure in responses, but:

- Tokens should still be encrypted in storage (handled by `authService`)
- Use secure session management
- Implement token rotation and expiration
- Never log tokens

### CORS Configuration

- Keep the allowed origins list as restrictive as possible
- In production, avoid using wildcards
- Regularly review and update allowed origins

### HTTPS Enforcement

- Ensure SSL/TLS certificates are properly configured
- Use HSTS headers for additional security
- Keep certificates up to date

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `development` | No |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | `http://localhost:3000` | No |

## Requirements Mapping

| Requirement | Middleware | Description |
|-------------|------------|-------------|
| 9.2 | `excludeTokensFromResponse` | Do not expose access tokens in API responses or logs |
| 9.3 | `enforceHttps` | Use HTTPS for all communication |
| 9.4 | `sanitizeInput` | Validate and sanitize all user inputs |
| 9.5 | `getCorsOptions` | Implement CORS policies to restrict API access |
