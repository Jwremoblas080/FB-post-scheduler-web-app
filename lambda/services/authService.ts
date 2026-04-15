import axios from 'axios';
import { encrypt, decrypt } from '../utils/encryption';
import {
  upsertUser,
  upsertPage,
  getUser,
  getLatestUser,
  getPagesByUser,
  getPageToken,
} from './dynamoDb';
import { GraphApiClient } from './graphApiClient';

export interface AccessToken {
  token: string;
  expiry: Date;
}

export class AuthService {
  private appId: string;
  private appSecret: string;
  private redirectUri: string;
  private graphApi: GraphApiClient;

  constructor() {
    this.appId = process.env.FACEBOOK_APP_ID!;
    this.appSecret = process.env.FACEBOOK_APP_SECRET!;
    this.redirectUri = process.env.FACEBOOK_REDIRECT_URI!;
    this.graphApi = new GraphApiClient();
  }

  initiateLogin(frontendUrl?: string): string {
    const scope = ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'].join(',');
    const state = frontendUrl ? Buffer.from(frontendUrl).toString('base64url') : '';
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      scope,
      response_type: 'code',
      ...(state ? { state } : {}),
    });
    return `https://www.facebook.com/v18.0/dialog/oauth?${params}`;
  }

  async handleCallback(code: string): Promise<{ fbUserId: string; token: AccessToken }> {
    const params = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: this.redirectUri,
      code,
    });
    const res = await axios.get(`https://graph.facebook.com/v18.0/oauth/access_token?${params}`);
    const { access_token, expires_in } = res.data;

    const expiry = new Date();
    expiry.setSeconds(expiry.getSeconds() + (expires_in || 60 * 24 * 60 * 60));

    const token: AccessToken = { token: access_token, expiry };
    const fbUserId = access_token; // use token as unique ID (no extra API call)

    // Store user
    await upsertUser(fbUserId, encrypt(access_token), Math.floor(expiry.getTime() / 1000));

    // Cache pages
    try {
      const pages = await this.graphApi.getPages(access_token);
      for (const page of pages) {
        await upsertPage(fbUserId, page.id, page.name, encrypt(page.accessToken));
      }
    } catch (e) {
      console.warn('Could not cache pages during OAuth:', (e as Error).message);
    }

    return { fbUserId, token };
  }

  async getCachedPages(): Promise<Array<{ id: string; name: string }>> {
    const user = await getLatestUser();
    if (!user) return [];
    const pages = await getPagesByUser(user.fbUserId);
    return pages.map(p => ({ id: p.pageId, name: p.pageName }));
  }

  async getCachedPageToken(pageId: string): Promise<string | null> {
    const encrypted = await getPageToken(pageId);
    if (!encrypted) return null;
    try { return decrypt(encrypted); } catch { return null; }
  }

  async getLatestUserToken(): Promise<string | null> {
    const user = await getLatestUser();
    if (!user) return null;
    try { return decrypt(user.accessToken); } catch { return null; }
  }
}
