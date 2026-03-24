import axios, { AxiosError } from 'axios';
import { FacebookPage, PublishResult } from '../types';

/**
 * Facebook Graph API Client
 * Handles authentication, page retrieval, and publishing different types of media
 * Requirements: 2.1, 2.2, 6.3, 6.4
 */
export class GraphApiClient {
  private readonly baseUrl = 'https://graph.facebook.com/v18.0';

  /**
   * Retrieve all Facebook Pages the user has permission to manage
   * Requirements: 2.1, 2.2
   */
  async getPages(accessToken: string): Promise<FacebookPage[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/me/accounts`, {
        params: {
          access_token: accessToken
        }
      });

      if (!response.data || !response.data.data) {
        throw new Error('Invalid response from Facebook API');
      }

      return response.data.data.map((page: any) => ({
        id: page.id,
        name: page.name,
        accessToken: page.access_token
      }));
    } catch (error) {
      throw this.handleApiError(error, 'Failed to retrieve Facebook Pages');
    }
  }

  /**
   * Publish a single photo to a Facebook Page
   * Requirements: 6.3
   */
  async publishPhoto(
    pageId: string,
    pageAccessToken: string,
    photoUrl: string,
    caption: string
  ): Promise<PublishResult> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${pageId}/photos`,
        {
          url: photoUrl,
          caption: caption
        },
        {
          params: {
            access_token: pageAccessToken
          }
        }
      );

      return {
        success: true,
        postId: response.data.id
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Publish multiple photos to a Facebook Page (album/carousel)
   * Requirements: 6.3
   */
  async publishPhotos(
    pageId: string,
    pageAccessToken: string,
    photoUrls: string[],
    caption: string
  ): Promise<PublishResult> {
    try {
      // Step 1: Upload all photos and get their IDs
      const photoIds: string[] = [];
      
      for (const photoUrl of photoUrls) {
        const uploadResponse = await axios.post(
          `${this.baseUrl}/${pageId}/photos`,
          {
            url: photoUrl,
            published: false // Don't publish yet
          },
          {
            params: {
              access_token: pageAccessToken
            }
          }
        );
        
        photoIds.push(uploadResponse.data.id);
      }

      // Step 2: Create a multi-photo post with all uploaded photos
      const attachedMedia = photoIds.map(id => ({
        media_fbid: id
      }));

      const response = await axios.post(
        `${this.baseUrl}/${pageId}/feed`,
        {
          message: caption,
          attached_media: attachedMedia
        },
        {
          params: {
            access_token: pageAccessToken
          }
        }
      );

      return {
        success: true,
        postId: response.data.id
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Publish a video to a Facebook Page
   * Requirements: 6.4
   */
  async publishVideo(
    pageId: string,
    pageAccessToken: string,
    videoUrl: string,
    caption: string
  ): Promise<PublishResult> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${pageId}/videos`,
        {
          file_url: videoUrl,
          description: caption
        },
        {
          params: {
            access_token: pageAccessToken
          }
        }
      );

      return {
        success: true,
        postId: response.data.id
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Extract a descriptive error message from API errors
   * Requirements: 2.4
   */
  private extractErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      
      if (axiosError.response?.data?.error) {
        const fbError = axiosError.response.data.error;
        return `Facebook API Error: ${fbError.message || 'Unknown error'} (Code: ${fbError.code || 'N/A'})`;
      }
      
      if (axiosError.message) {
        return `Network error: ${axiosError.message}`;
      }
    }
    
    if (error instanceof Error) {
      return error.message;
    }
    
    return 'An unknown error occurred';
  }

  /**
   * Handle API errors and throw with descriptive messages
   * Requirements: 2.4
   */
  private handleApiError(error: unknown, context: string): Error {
    const errorMessage = this.extractErrorMessage(error);
    return new Error(`${context}: ${errorMessage}`);
  }
}
