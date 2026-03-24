import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
export const ddb = DynamoDBDocumentClient.from(client);

export const TABLE = process.env.DYNAMODB_TABLE!;

// ─── Key helpers ────────────────────────────────────────────────────────────

export const userPK = (fbUserId: string) => `USER#${fbUserId}`;
export const userSK = () => 'PROFILE';

export const postPK = (postId: string) => `POST#${postId}`;
export const postSK = () => 'META';

export const pagePK = (fbUserId: string) => `USER#${fbUserId}`;
export const pageSK = (pageId: string) => `PAGE#${pageId}`;

// ─── User operations ─────────────────────────────────────────────────────────

export interface UserRecord {
  PK: string;
  SK: string;
  fbUserId: string;
  accessToken: string;   // encrypted
  tokenExpiry: number;   // unix seconds
  createdAt: number;
  GSI1PK: string;        // 'USERS'
  GSI1SK: string;        // createdAt ISO for sorting
}

export async function upsertUser(fbUserId: string, encryptedToken: string, tokenExpiry: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: userPK(fbUserId),
      SK: userSK(),
      fbUserId,
      accessToken: encryptedToken,
      tokenExpiry,
      createdAt: now,
      GSI1PK: 'USERS',
      GSI1SK: new Date(now * 1000).toISOString(),
    },
  }));
}

export async function getUser(fbUserId: string): Promise<UserRecord | null> {
  const res = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: userPK(fbUserId), SK: userSK() },
  }));
  return (res.Item as UserRecord) ?? null;
}

export async function getLatestUser(): Promise<UserRecord | null> {
  const res = await ddb.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': 'USERS' },
    ScanIndexForward: false,
    Limit: 1,
  }));
  return (res.Items?.[0] as UserRecord) ?? null;
}

// ─── Page cache operations ────────────────────────────────────────────────────

export interface PageRecord {
  PK: string;
  SK: string;
  pageId: string;
  pageName: string;
  pageAccessToken: string; // encrypted
  createdAt: number;
}

export async function upsertPage(fbUserId: string, pageId: string, pageName: string, encryptedToken: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: pagePK(fbUserId),
      SK: pageSK(pageId),
      pageId,
      pageName,
      pageAccessToken: encryptedToken,
      createdAt: now,
    },
  }));
}

export async function getPagesByUser(fbUserId: string): Promise<PageRecord[]> {
  const res = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': pagePK(fbUserId),
      ':prefix': 'PAGE#',
    },
  }));
  return (res.Items ?? []) as PageRecord[];
}

export async function getPageToken(pageId: string): Promise<string | null> {
  // Scan GSI or do a full scan — pages are few so scan is fine
  const res = await ddb.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: 'pageId = :pid',
    ExpressionAttributeValues: { ':pid': pageId },
  }));
  const item = res.Items?.[0] as PageRecord | undefined;
  return item?.pageAccessToken ?? null;
}

// ─── Post operations ──────────────────────────────────────────────────────────

export interface PostRecord {
  PK: string;
  SK: string;
  postId: string;
  userId: string;          // fbUserId
  caption: string;
  mediaUrls: string[];
  mediaType: 'image' | 'video';
  scheduledTime: number;   // unix seconds
  status: 'pending' | 'posted' | 'failed';
  pageId: string;
  createdAt: number;
  errorMessage?: string;
  GSI1PK: string;          // 'POSTS'
  GSI1SK: string;          // scheduledTime ISO
}

export async function createPost(post: Omit<PostRecord, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK'>): Promise<PostRecord> {
  const item: PostRecord = {
    ...post,
    PK: postPK(post.postId),
    SK: postSK(),
    GSI1PK: 'POSTS',
    GSI1SK: new Date(post.scheduledTime * 1000).toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

export async function getAllPosts(): Promise<PostRecord[]> {
  const res = await ddb.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': 'POSTS' },
    ScanIndexForward: true,
  }));
  return (res.Items ?? []) as PostRecord[];
}

export async function getPendingDuePosts(): Promise<PostRecord[]> {
  const nowIso = new Date().toISOString();
  const res = await ddb.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK <= :now',
    FilterExpression: '#s = :pending',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: {
      ':pk': 'POSTS',
      ':now': nowIso,
      ':pending': 'pending',
    },
  }));
  return (res.Items ?? []) as PostRecord[];
}

export async function updatePostStatus(
  postId: string,
  status: 'pending' | 'posted' | 'failed',
  errorMessage?: string,
): Promise<void> {
  const expr = errorMessage
    ? 'SET #s = :s, errorMessage = :e'
    : 'SET #s = :s REMOVE errorMessage';
  const values: Record<string, any> = { ':s': status };
  if (errorMessage) values[':e'] = errorMessage;

  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: postPK(postId), SK: postSK() },
    UpdateExpression: expr,
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: values,
  }));
}

export async function updatePost(
  postId: string,
  fields: { caption?: string; scheduledTime?: number; pageId?: string },
): Promise<void> {
  const sets: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, any> = {};

  if (fields.caption !== undefined) {
    sets.push('#caption = :caption');
    names['#caption'] = 'caption';
    values[':caption'] = fields.caption;
  }
  if (fields.scheduledTime !== undefined) {
    sets.push('scheduledTime = :st, GSI1SK = :gsi1sk');
    values[':st'] = fields.scheduledTime;
    values[':gsi1sk'] = new Date(fields.scheduledTime * 1000).toISOString();
  }
  if (fields.pageId !== undefined) {
    sets.push('pageId = :pageId');
    values[':pageId'] = fields.pageId;
  }

  if (sets.length === 0) return;

  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: postPK(postId), SK: postSK() },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
    ExpressionAttributeValues: values,
  }));
}

export async function deletePost(postId: string): Promise<void> {
  await ddb.send(new DeleteCommand({
    TableName: TABLE,
    Key: { PK: postPK(postId), SK: postSK() },
  }));
}

export async function getPost(postId: string): Promise<PostRecord | null> {
  const res = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: postPK(postId), SK: postSK() },
  }));
  return (res.Item as PostRecord) ?? null;
}
