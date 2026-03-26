import serverless from 'serverless-http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { AuthService } from '../services/authService';
import { GraphApiClient } from '../services/graphApiClient';
import { uploadImages, uploadVideo } from '../services/s3Upload';
import {
  createPost,
  getAllPosts,
  getPost,
  deletePost,
  updatePost,
  updatePostStatus,
  getLatestUser,
  getPagesByUser,
  ddb,
  TABLE,
  userPK,
  userSK,
} from '../services/dynamoDb';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return cb(null, true);
    if (origin.endsWith('.vercel.app') || origin.includes('vercel.app')) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.length === 0) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // handle preflight for all routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const auth = new AuthService();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ─── Auth routes ─────────────────────────────────────────────────────────────

app.post('/auth/login', (req, res) => {
  try {
    const origin = req.headers.origin || req.headers.referer || FRONTEND_URL;
    let frontendBase = FRONTEND_URL;
    try {
      const u = new URL(origin);
      frontendBase = `${u.protocol}//${u.host}`;
    } catch { /* use default */ }
    const redirectUrl = auth.initiateLogin(frontendBase);
    res.json({ redirectUrl });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

app.get('/auth/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, error: oauthError, error_description, state } = req.query;

  // Decode frontend URL from state param (set during login)
  let frontendBase = FRONTEND_URL;
  if (state && typeof state === 'string') {
    try {
      frontendBase = Buffer.from(state, 'base64url').toString('utf8');
    } catch { /* use default */ }
  }

  if (oauthError) {
    const desc = encodeURIComponent((error_description as string) || String(oauthError));
    res.redirect(`${frontendBase}/auth/callback?error=${oauthError}&error_description=${desc}`);
    return;
  }

  if (!code || typeof code !== 'string') {
    res.redirect(`${frontendBase}/auth/callback?error=missing_code&error_description=${encodeURIComponent('Authorization code is required')}`);
    return;
  }

  try {
    await auth.handleCallback(code);
    res.redirect(`${frontendBase}/auth/callback`);
  } catch (e: any) {
    const desc = encodeURIComponent(e.message || 'Authentication failed');
    res.redirect(`${frontendBase}/auth/callback?error=auth_failed&error_description=${desc}`);
  }
});

app.get('/auth/pages', async (_req, res): Promise<void> => {
  try {
    const cached = await auth.getCachedPages();
    if (cached.length > 0) {
      res.json({ success: true, pages: cached });
      return;
    }
    const user = await getLatestUser();
    if (!user) {
      res.status(401).json({ error: true, message: 'Not connected. Please connect with Facebook first.', code: 'MISSING_ACCESS_TOKEN' });
      return;
    }
    res.json({ success: true, pages: [], hint: 'Please reconnect with Facebook to load your pages.' });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// ─── Upload routes ────────────────────────────────────────────────────────────

app.post('/upload/images', upload.array('images', 10), async (req: Request, res: Response): Promise<void> => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) { res.status(400).json({ error: true, message: 'No image files provided' }); return; }
    const filePaths = await uploadImages(files.map(f => ({ originalName: f.originalname, size: f.size, buffer: f.buffer, mimetype: f.mimetype })));
    res.json({ success: true, filePaths });
  } catch (e: any) {
    res.status(400).json({ error: true, message: e.message });
  }
});

app.post('/upload/video', upload.single('video'), async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ error: true, message: 'No video file provided' }); return; }
    const filePath = await uploadVideo({ originalName: file.originalname, size: file.size, buffer: file.buffer, mimetype: file.mimetype });
    res.json({ success: true, filePath });
  } catch (e: any) {
    res.status(400).json({ error: true, message: e.message });
  }
});

// ─── Post routes ──────────────────────────────────────────────────────────────

app.post('/posts', async (req: Request, res: Response): Promise<void> => {
  try {
    const { caption, mediaPaths, mediaUrls, mediaType, scheduledTime, pageId } = req.body;

    const user = await getLatestUser();
    if (!user) {
      res.status(401).json({ error: true, message: 'Not logged in. Please connect with Facebook first.', code: 'NOT_AUTHENTICATED' });
      return;
    }

    const resolvedUrls: string[] = mediaPaths || mediaUrls || [];
    const scheduledDate = new Date(scheduledTime);

    if (!caption?.trim()) throw new Error('Missing required fields: caption');
    if (resolvedUrls.length === 0) throw new Error('Missing required fields: media');
    if (!pageId?.trim()) throw new Error('Missing required fields: pageId');
    if (isNaN(scheduledDate.getTime())) throw new Error('Missing required fields: scheduledTime');
    if (scheduledDate <= new Date()) throw new Error('Scheduled time must be in the future');
    if (mediaType !== 'image' && mediaType !== 'video') throw new Error('Invalid media type. Must be "image" or "video"');

    const postId = uuid();
    const post = await createPost({
      postId,
      userId: user.fbUserId,
      caption,
      mediaUrls: resolvedUrls,
      mediaType,
      scheduledTime: Math.floor(scheduledDate.getTime() / 1000),
      status: 'pending',
      pageId,
      createdAt: Math.floor(Date.now() / 1000),
    });

    res.status(201).json({
      success: true,
      post: {
        id: post.postId,
        caption: post.caption,
        mediaUrls: post.mediaUrls,
        mediaType: post.mediaType,
        scheduledTime: new Date(post.scheduledTime * 1000).toISOString(),
        status: post.status,
        pageId: post.pageId,
        createdAt: new Date(post.createdAt * 1000).toISOString(),
      },
    });
  } catch (e: any) {
    const isValidation = e.message.includes('Missing required fields') ||
      e.message.includes('Scheduled time must be in the future') ||
      e.message.includes('Invalid media type');
    res.status(isValidation ? 400 : 500).json({ error: true, message: e.message });
  }
});

app.get('/posts', async (_req, res): Promise<void> => {
  try {
    const rows = await getAllPosts();
    const posts = rows.map(p => ({
      id: p.postId,
      caption: p.caption,
      mediaUrls: p.mediaUrls,
      mediaType: p.mediaType,
      scheduledTime: new Date(p.scheduledTime * 1000).toISOString(),
      status: p.status,
      pageId: p.pageId,
      createdAt: new Date(p.createdAt * 1000).toISOString(),
      errorMessage: p.errorMessage,
    }));
    res.json({ success: true, posts });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

app.delete('/posts/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const post = await getPost(id);
    if (!post) { res.status(404).json({ error: true, message: 'Post not found' }); return; }
    if (post.status === 'posted') { res.status(403).json({ error: true, message: 'Cannot delete a post that has already been posted' }); return; }
    await deletePost(id);
    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// PATCH /posts/:id — edit caption, scheduledTime, or pageId
app.patch('/posts/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { caption, scheduledTime, pageId } = req.body;

    const post = await getPost(id);
    if (!post) { res.status(404).json({ error: true, message: 'Post not found' }); return; }
    if (post.status === 'posted') { res.status(403).json({ error: true, message: 'Cannot edit a post that has already been posted' }); return; }

    const fields: { caption?: string; scheduledTime?: number; pageId?: string } = {};

    if (caption !== undefined) {
      if (!caption.trim()) { res.status(400).json({ error: true, message: 'Caption cannot be empty' }); return; }
      fields.caption = caption.trim();
    }
    if (scheduledTime !== undefined) {
      const d = new Date(scheduledTime);
      if (isNaN(d.getTime())) { res.status(400).json({ error: true, message: 'Invalid scheduledTime' }); return; }
      if (d <= new Date()) { res.status(400).json({ error: true, message: 'Scheduled time must be in the future' }); return; }
      fields.scheduledTime = Math.floor(d.getTime() / 1000);
    }
    if (pageId !== undefined) {
      if (!pageId.trim()) { res.status(400).json({ error: true, message: 'pageId cannot be empty' }); return; }
      fields.pageId = pageId.trim();
    }

    await updatePost(id, fields);

    const updated = await getPost(id);
    res.json({
      success: true,
      post: {
        id: updated!.postId,
        caption: updated!.caption,
        mediaUrls: updated!.mediaUrls,
        mediaType: updated!.mediaType,
        scheduledTime: new Date(updated!.scheduledTime * 1000).toISOString(),
        status: updated!.status,
        pageId: updated!.pageId,
        createdAt: new Date(updated!.createdAt * 1000).toISOString(),
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// POST /posts/:id/retry — reset a failed post back to pending
app.post('/posts/:id/retry', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const post = await getPost(id);
    if (!post) { res.status(404).json({ error: true, message: 'Post not found' }); return; }
    if (post.status !== 'failed') { res.status(400).json({ error: true, message: 'Only failed posts can be retried' }); return; }

    // Bump scheduled time to 2 minutes from now if it's in the past
    const nowSec = Math.floor(Date.now() / 1000);
    const fields: { scheduledTime?: number } = {};
    if (post.scheduledTime <= nowSec) {
      fields.scheduledTime = nowSec + 120;
    }
    if (Object.keys(fields).length) await updatePost(id, fields);
    await updatePostStatus(id, 'pending');

    res.json({ success: true, message: 'Post queued for retry' });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// DELETE /auth/disconnect — clear stored user session
app.delete('/auth/disconnect', async (_req, res): Promise<void> => {
  try {
    const user = await getLatestUser();
    if (user) {
      const pages = await getPagesByUser(user.fbUserId);
      for (const page of pages) {
        await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: page.PK, SK: page.SK } }));
      }
      await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: userPK(user.fbUserId), SK: userSK() } }));
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: true, message: 'Not found' }));

export const handler = serverless(app);
