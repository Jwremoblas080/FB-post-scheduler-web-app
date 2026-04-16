import { getPendingDuePosts, updatePostStatus, getLatestUser } from '../services/dynamoDb';
import { GraphApiClient } from '../services/graphApiClient';
import { AuthService } from '../services/authService';
import { decrypt } from '../utils/encryption';

const graphApi = new GraphApiClient();
const auth = new AuthService();

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function publishWithRetry(
  postId: string,
  pageId: string,
  pageToken: string,
  mediaUrls: string[],
  mediaType: 'image' | 'video',
  caption: string,
): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt - 1));

    let result;
    if (mediaType === 'video') {
      result = await graphApi.publishVideo(pageId, pageToken, mediaUrls[0], caption);
    } else if (mediaUrls.length === 1) {
      result = await graphApi.publishPhoto(pageId, pageToken, mediaUrls[0], caption);
    } else {
      result = await graphApi.publishPhotos(pageId, pageToken, mediaUrls, caption);
    }

    if (result.success) return result;
    console.warn(`[scheduler] Post ${postId} attempt ${attempt + 1} failed: ${result.error}`);
  }
  return { success: false, error: `Failed after ${MAX_RETRIES} attempts` };
}

export async function handler(): Promise<void> {
  console.log(`[scheduler] Running at ${new Date().toISOString()}`);

  const posts = await getPendingDuePosts();
  if (posts.length === 0) {
    console.log('[scheduler] No pending posts due');
    return;
  }

  console.log(`[scheduler] Found ${posts.length} post(s) to publish`);

  // Get user token once (single-user app)
  const user = await getLatestUser();
  if (!user) {
    console.error('[scheduler] No user found, cannot publish');
    return;
  }

  // Check if token is expired
  const nowSec = Math.floor(Date.now() / 1000);
  if (user.tokenExpiry <= nowSec) {
    console.error('[scheduler] User token expired. Token expiry:', new Date(user.tokenExpiry * 1000).toISOString());
    // Mark all pending posts as failed with clear message
    for (const post of posts) {
      await updatePostStatus(post.postId, 'failed', 'Facebook token expired. Please reconnect your Facebook account.');
    }
    return;
  }

  let userToken: string;
  try {
    userToken = decrypt(user.accessToken);
  } catch (e) {
    console.error('[scheduler] Failed to decrypt user token:', (e as Error).message);
    // Mark all pending posts as failed
    for (const post of posts) {
      await updatePostStatus(post.postId, 'failed', 'Token decryption failed. Please reconnect your Facebook account.');
    }
    return;
  }

  for (const post of posts) {
    console.log(`[scheduler] Publishing post ${post.postId}...`);

    // Get page token from cache
    let pageToken = await auth.getCachedPageToken(post.pageId);

    // Fallback: fetch live from Facebook
    if (!pageToken) {
      try {
        const pages = await graphApi.getPages(userToken);
        const page = pages.find(p => p.id === post.pageId);
        pageToken = page?.accessToken ?? null;
      } catch (e) {
        console.error(`[scheduler] Could not get page token for post ${post.postId}:`, (e as Error).message);
        await updatePostStatus(post.postId, 'failed', 'Could not retrieve page access token');
        continue;
      }
    }

    if (!pageToken) {
      await updatePostStatus(post.postId, 'failed', `Page token not found for page ${post.pageId}`);
      continue;
    }

    const result = await publishWithRetry(
      post.postId,
      post.pageId,
      pageToken,
      post.mediaUrls,
      post.mediaType,
      post.caption,
    );

    if (result.success) {
      console.log(`[scheduler] Post ${post.postId} published successfully`);
      await updatePostStatus(post.postId, 'posted');
    } else {
      console.error(`[scheduler] Post ${post.postId} failed: ${result.error}`);
      await updatePostStatus(post.postId, 'failed', result.error);
    }
  }
}
