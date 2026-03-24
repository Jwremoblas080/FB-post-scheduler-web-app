import { Router, Request, Response } from 'express';
import { PostManagementService } from '../services/postService';
import { getDatabase } from '../database/init';
import Database from 'better-sqlite3';
import { PostData } from '../types';

const router = Router();

// Initialize database and services
let db: Database.Database;
let postService: PostManagementService;

// Initialize services with database
export function initializePostRoutes(database?: Database.Database) {
  db = database || getDatabase();
  postService = new PostManagementService(db);
}

/**
 * POST /posts
 * Create new scheduled post
 * Requirements: 4.1, 5.1
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { caption, mediaPaths, mediaUrls, mediaType, scheduledTime, pageId } = req.body;

    // Single-user app: look up the most recently logged-in user
    const userRow = (db as any).prepare(
      'SELECT id FROM users ORDER BY created_at DESC LIMIT 1'
    ).get() as { id: number } | undefined;

    if (!userRow) {
      res.status(401).json({
        error: true,
        message: 'Not logged in. Please connect with Facebook first.',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    const resolvedMediaUrls = mediaPaths || mediaUrls;
    const scheduledDate = new Date(scheduledTime);

    const postData: PostData = {
      caption,
      mediaUrls: resolvedMediaUrls,
      mediaType,
      scheduledTime: scheduledDate,
      pageId,
      userId: userRow.id
    };

    const createdPost = postService.createPost(postData);

    res.status(201).json({
      success: true,
      post: createdPost
    });
  } catch (error: any) {
    // Determine if it's a client error (validation) or server error
    const isValidationError = error.message.includes('Missing required fields') ||
                              error.message.includes('Scheduled time must be in the future') ||
                              error.message.includes('Invalid media type') ||
                              error.message.includes('Cannot upload more than');

    const statusCode = isValidationError ? 400 : 500;

    res.status(statusCode).json({
      error: true,
      message: error.message,
      code: isValidationError ? 'VALIDATION_ERROR' : 'POST_CREATION_FAILED'
    });
  }
});

/**
 * GET /posts
 * Retrieve user's posts
 * Requirements: 5.1
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    // In single-user mode, fetch all posts if no userId provided
    let posts;
    if (userId) {
      const userIdNum = parseInt(userId as string, 10);
      if (isNaN(userIdNum)) {
        res.status(400).json({
          error: true,
          message: 'Invalid user ID format',
          code: 'INVALID_USER_ID'
        });
        return;
      }
      posts = postService.getPosts(userIdNum);
    } else {
      posts = postService.getAllPosts();
    }

    res.json({ success: true, posts });
  } catch (error: any) {
    res.status(500).json({
      error: true,
      message: 'Failed to retrieve posts',
      code: 'POSTS_RETRIEVAL_FAILED',
      details: error.message
    });
  }
});

/**
 * DELETE /posts/:id
 * Delete a post
 * Requirements: 5.5
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const postId = parseInt(id, 10);

    if (isNaN(postId)) {
      res.status(400).json({
        error: true,
        message: 'Invalid post ID format',
        code: 'INVALID_POST_ID'
      });
      return;
    }

    postService.deletePost(postId);

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error: any) {
    // Determine if it's a client error (not found, status restriction) or server error
    const isClientError = error.message.includes('Post not found') ||
                          error.message.includes('Cannot delete a post that has already been posted');

    const statusCode = isClientError ? 
      (error.message.includes('Cannot delete') ? 403 : 404) : 
      500;

    res.status(statusCode).json({
      error: true,
      message: error.message,
      code: isClientError ? 
        (error.message.includes('Cannot delete') ? 'DELETE_FORBIDDEN' : 'POST_NOT_FOUND') :
        'POST_DELETION_FAILED'
    });
  }
});

// Initialize services on module load - will be overridden by initializePostRoutes(db) from index.ts
// initializePostRoutes();

export default router;
