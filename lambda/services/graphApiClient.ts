import axios, { AxiosError } from 'axios';

export interface FacebookPage {
  id: string;
  name: string;
  accessToken: string;
}

export interface PublishResult {
  success: boolean;
  postId?: string;
  error?: string;
}

export class GraphApiClient {
  private readonly baseUrl = 'https://graph.facebook.com/v18.0';

  async getPages(accessToken: string): Promise<FacebookPage[]> {
    const res = await axios.get(`${this.baseUrl}/me/accounts`, {
      params: { access_token: accessToken },
    });
    if (!res.data?.data) throw new Error('Invalid response from Facebook API');
    return res.data.data.map((p: any) => ({ id: p.id, name: p.name, accessToken: p.access_token }));
  }

  async publishPhoto(pageId: string, pageToken: string, photoUrl: string, caption: string): Promise<PublishResult> {
    try {
      const res = await axios.post(`${this.baseUrl}/${pageId}/photos`,
        { url: photoUrl, caption },
        { params: { access_token: pageToken } }
      );
      return { success: true, postId: res.data.id };
    } catch (e) {
      return { success: false, error: this.extractError(e) };
    }
  }

  async publishPhotos(pageId: string, pageToken: string, photoUrls: string[], caption: string): Promise<PublishResult> {
    try {
      const ids: string[] = [];
      for (const url of photoUrls) {
        const r = await axios.post(`${this.baseUrl}/${pageId}/photos`,
          { url, published: false },
          { params: { access_token: pageToken } }
        );
        ids.push(r.data.id);
      }
      const res = await axios.post(`${this.baseUrl}/${pageId}/feed`,
        { message: caption, attached_media: ids.map(id => ({ media_fbid: id })) },
        { params: { access_token: pageToken } }
      );
      return { success: true, postId: res.data.id };
    } catch (e) {
      return { success: false, error: this.extractError(e) };
    }
  }

  async publishVideo(pageId: string, pageToken: string, videoUrl: string, caption: string): Promise<PublishResult> {
    try {
      const res = await axios.post(`${this.baseUrl}/${pageId}/videos`,
        { file_url: videoUrl, description: caption },
        { params: { access_token: pageToken } }
      );
      return { success: true, postId: res.data.id };
    } catch (e) {
      return { success: false, error: this.extractError(e) };
    }
  }

  private extractError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const fb = (error as AxiosError<any>).response?.data?.error;
      if (fb) return `Facebook API Error: ${fb.message} (Code: ${fb.code})`;
      return `Network error: ${(error as AxiosError).message}`;
    }
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
