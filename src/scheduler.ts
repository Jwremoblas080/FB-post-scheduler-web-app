#!/usr/bin/env node
/**
 * Standalone scheduler process
 * This script runs the scheduler service independently from the main API server
 * Requirements: 6.1, 6.2
 */

import { getDatabase } from './database/init';
import { SchedulerService } from './services/schedulerService';
import { GraphApiClient } from './services/graphApiClient';
import { PostManagementService } from './services/postService';
import { AuthenticationService } from './services/authService';
import dotenv from 'dotenv';

dotenv.config();

// Initialize database
const db = getDatabase();

// Initialize services
const graphApiClient = new GraphApiClient();
const postService = new PostManagementService(db);
const authService = new AuthenticationService(
  process.env.FACEBOOK_APP_ID || '',
  process.env.FACEBOOK_APP_SECRET || '',
  process.env.FACEBOOK_REDIRECT_URI || '',
  db
);
const schedulerService = new SchedulerService(db, graphApiClient, postService, authService);

// Start the scheduler
console.log('Starting Facebook Post Scheduler...');
schedulerService.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down scheduler...');
  schedulerService.stop();
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down scheduler...');
  schedulerService.stop();
  db.close();
  process.exit(0);
});
