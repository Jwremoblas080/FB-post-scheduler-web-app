import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes, { initializeAuthRoutes } from './routes/authRoutes';
import postRoutes, { initializePostRoutes } from './routes/postRoutes';
import uploadRoutes from './routes/uploadRoutes';
import { getDatabase } from './database/init';
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

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Facebook Post Scheduler API is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
