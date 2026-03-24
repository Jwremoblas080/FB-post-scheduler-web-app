import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes, { initializeAuthRoutes } from './routes/authRoutes';
import postRoutes, { initializePostRoutes } from './routes/postRoutes';
import uploadRoutes from './routes/uploadRoutes';
import { getDatabase } from './database/init';
import { SchedulerService } from './services/schedulerService';
import { GraphApiClient } from './services/graphApiClient';
import { PostManagementService } from './services/postService';
import { AuthenticationService } from './services/authService';
import { 
  enforceHttps, 
  sanitizeInput, 
  excludeTokensFromResponse, 
  getCorsOptions 
} from './middleware/security';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create a single shared database connection
const db = getDatabase();

// Initialize route services with shared db connection
initializeAuthRoutes(db);
initializePostRoutes(db);

// Security Middleware (Requirements: 9.2, 9.3, 9.4, 9.5)
app.use(enforceHttps); // HTTPS enforcement
app.use(cors(getCorsOptions())); // CORS policies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeInput); // Input sanitization
app.use(excludeTokensFromResponse); // Token exclusion from responses

// Routes
app.use('/auth', authRoutes);
app.use('/posts', postRoutes);
app.use('/upload', uploadRoutes);

// Serve uploaded files as static assets
const uploadDir = path.resolve(process.env.UPLOAD_DIRECTORY || './uploads');
app.use('/uploads', express.static(uploadDir));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Facebook Post Scheduler API is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  // Start the scheduler inline so it runs with the API server
  const graphApiClient = new GraphApiClient();
  const postService = new PostManagementService(db);
  const authService = new AuthenticationService(
    process.env.FACEBOOK_APP_ID || '',
    process.env.FACEBOOK_APP_SECRET || '',
    process.env.FACEBOOK_REDIRECT_URI || '',
    db
  );
  const scheduler = new SchedulerService(db, graphApiClient, postService, authService);
  scheduler.start();
});

export default app;
