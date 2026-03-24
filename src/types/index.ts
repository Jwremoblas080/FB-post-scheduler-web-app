// Domain types for the Facebook Post Scheduler

export interface User {
  id: number;
  facebookUserId: string;
  accessToken: string;
  tokenExpiry: Date;
  createdAt: Date;
}

export interface Post {
  id: number;
  userId: number;
  caption: string;
  mediaUrls: string[];
  mediaType: 'image' | 'video';
  scheduledTime: string;
  status: 'pending' | 'posted' | 'failed';
  pageId: string;
  createdAt: string;
  errorMessage?: string;
}

export interface PostData {
  caption: string;
  mediaUrls: string[];
  mediaType: 'image' | 'video';
  scheduledTime: Date;
  pageId: string;
  userId: number;
}

export interface FacebookPage {
  id: string;
  name: string;
  accessToken: string;
}

export interface Configuration {
  databasePath: string;
  uploadDirectory: string;
  facebookAppId: string;
  facebookAppSecret: string;
  schedulerInterval?: number;
  maxFileSize?: number;
}

export interface AccessToken {
  token: string;
  expiry: Date;
}

export interface PublishResult {
  success: boolean;
  postId?: string;
  error?: string;
}

export interface ApiError {
  error: boolean;
  message: string;
  code: string;
  details?: any;
}
