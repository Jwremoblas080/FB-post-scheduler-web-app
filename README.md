# Facebook Post Scheduler

A web application that enables users to schedule and automatically publish posts (images, videos, and captions) to their Facebook Pages at specified times.

## Features

- Facebook OAuth authentication
- Schedule posts with images or videos
- Automatic publishing at scheduled times
- Multi-image post support
- Post management (view, delete)
- Error handling and retry logic
- Rate limit compliance

## Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Database**: SQLite
- **Frontend**: React (to be implemented)
- **Testing**: Jest, fast-check (property-based testing)

## Project Structure

```
facebook-post-scheduler/
├── src/
│   ├── index.ts              # Application entry point
│   ├── types/                # TypeScript type definitions
│   ├── services/             # Business logic services
│   ├── routes/               # Express route handlers
│   ├── middleware/           # Express middleware
│   ├── utils/                # Utility functions
│   └── database/             # Database initialization and access
├── uploads/                  # Media file storage
├── dist/                     # Compiled JavaScript output
├── package.json
├── tsconfig.json
└── README.md
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Update `.env` with your Facebook App credentials and other settings.

4. Build the project:
```bash
npm run build
```

5. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Running the Scheduler

The scheduler runs as a **separate process** from the API server and shares the same SQLite database.

In development, run both processes in separate terminals:
```bash
# Terminal 1 - API server
npm run dev

# Terminal 2 - Scheduler
npm run scheduler
```

In production, run both after building:
```bash
npm run build

# Terminal 1 - API server
npm start

# Terminal 2 - Scheduler
npm run scheduler:prod
```

The scheduler polls the database every 60 seconds (configurable via `SCHEDULER_INTERVAL` in `.env`) and publishes any pending posts whose scheduled time has passed. It handles graceful shutdown on `SIGINT`/`SIGTERM`.

## Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## API Endpoints

(To be documented as routes are implemented)

## License

ISC
