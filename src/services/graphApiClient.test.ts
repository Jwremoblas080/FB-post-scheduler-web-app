import axios from 'axios';
import { GraphApiClient } from './graphApiClient';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GraphApiClient', () => {
  let client: GraphApiClient;

  beforeEach(() => {
    client = new GraphApiClient();
    jest.clearAllMocks();
  });

  describe('getPages', () => {
    it('should retrieve and format Facebook Pages correctly', async () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: '123456',
              name: 'Test Page 1',
              access_token: 'page_token_1'
            },
            {
              id: '789012',
              name: 'Test Page 2',
              access_token: 'page_token_2'
            }
          ]
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const pages = await client.getPages('user_access_token');

      expect(pages).toHaveLength(2);
      expect(pages[0]).toEqual({
        id: '123456',
        name: 'Test Page 1',
        accessToken: 'page_token_1'
      });
      expect(pages[1]).toEqual({
        id: '789012',
        name: 'Test Page 2',
        accessToken: 'page_token_2'
      });
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/me/accounts',
        {
          params: {
            access_token: 'user_access_token'
          }
        }
      );
    });

    it('should return empty array when user has no pages', async () => {
      const mockResponse = {
        data: {
          data: []
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const pages = await client.getPages('user_access_token');

      expect(pages).toEqual([]);
    });

    it('should throw descriptive error when API request fails', async () => {
      const mockError = {
        response: {
          data: {
            error: {
              message: 'Invalid OAuth access token',
              code: 190
            }
          }
        },
        isAxiosError: true
      };

      mockedAxios.get.mockRejectedValue(mockError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(client.getPages('invalid_token')).rejects.toThrow(
        'Failed to retrieve Facebook Pages: Facebook API Error: Invalid OAuth access token (Code: 190)'
      );
    });

    it('should throw error when response format is invalid', async () => {
      const mockResponse = {
        data: null
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      await expect(client.getPages('user_access_token')).rejects.toThrow(
        'Invalid response from Facebook API'
      );
    });
  });

  describe('publishPhoto', () => {
    it('should successfully publish a single photo', async () => {
      const mockResponse = {
        data: {
          id: 'photo_123456'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await client.publishPhoto(
        'page_123',
        'page_token',
        'https://example.com/photo.jpg',
        'Test caption'
      );

      expect(result).toEqual({
        success: true,
        postId: 'photo_123456'
      });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/page_123/photos',
        {
          url: 'https://example.com/photo.jpg',
          caption: 'Test caption'
        },
        {
          params: {
            access_token: 'page_token'
          }
        }
      );
    });

    it('should return error result when publish fails', async () => {
      const mockError = {
        response: {
          data: {
            error: {
              message: 'Invalid image URL',
              code: 100
            }
          }
        },
        isAxiosError: true
      };

      mockedAxios.post.mockRejectedValue(mockError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const result = await client.publishPhoto(
        'page_123',
        'page_token',
        'invalid_url',
        'Test caption'
      );

      expect(result).toEqual({
        success: false,
        error: 'Facebook API Error: Invalid image URL (Code: 100)'
      });
    });

    it('should include caption in the publish request', async () => {
      const mockResponse = {
        data: { id: 'photo_123' }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await client.publishPhoto(
        'page_123',
        'page_token',
        'https://example.com/photo.jpg',
        'My awesome photo caption'
      );

      const callArgs = mockedAxios.post.mock.calls[0];
      expect(callArgs[1]).toHaveProperty('caption', 'My awesome photo caption');
    });
  });

  describe('publishPhotos', () => {
    it('should successfully publish multiple photos', async () => {
      // Mock responses for photo uploads
      mockedAxios.post
        .mockResolvedValueOnce({ data: { id: 'photo_1' } })
        .mockResolvedValueOnce({ data: { id: 'photo_2' } })
        .mockResolvedValueOnce({ data: { id: 'photo_3' } })
        .mockResolvedValueOnce({ data: { id: 'post_123456' } }); // Final post

      const result = await client.publishPhotos(
        'page_123',
        'page_token',
        [
          'https://example.com/photo1.jpg',
          'https://example.com/photo2.jpg',
          'https://example.com/photo3.jpg'
        ],
        'Multi-photo caption'
      );

      expect(result).toEqual({
        success: true,
        postId: 'post_123456'
      });

      // Verify photo uploads (3 calls)
      expect(mockedAxios.post).toHaveBeenCalledTimes(4);
      
      // Check first photo upload
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        1,
        'https://graph.facebook.com/v18.0/page_123/photos',
        {
          url: 'https://example.com/photo1.jpg',
          published: false
        },
        {
          params: {
            access_token: 'page_token'
          }
        }
      );

      // Check final post creation
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        4,
        'https://graph.facebook.com/v18.0/page_123/feed',
        {
          message: 'Multi-photo caption',
          attached_media: [
            { media_fbid: 'photo_1' },
            { media_fbid: 'photo_2' },
            { media_fbid: 'photo_3' }
          ]
        },
        {
          params: {
            access_token: 'page_token'
          }
        }
      );
    });

    it('should return error result when multi-photo publish fails', async () => {
      const mockError = {
        response: {
          data: {
            error: {
              message: 'Permission denied',
              code: 200
            }
          }
        },
        isAxiosError: true
      };

      mockedAxios.post.mockRejectedValue(mockError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const result = await client.publishPhotos(
        'page_123',
        'page_token',
        ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
        'Test caption'
      );

      expect(result).toEqual({
        success: false,
        error: 'Facebook API Error: Permission denied (Code: 200)'
      });
    });
  });

  describe('publishVideo', () => {
    it('should successfully publish a video', async () => {
      const mockResponse = {
        data: {
          id: 'video_123456'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await client.publishVideo(
        'page_123',
        'page_token',
        'https://example.com/video.mp4',
        'Video caption'
      );

      expect(result).toEqual({
        success: true,
        postId: 'video_123456'
      });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/page_123/videos',
        {
          file_url: 'https://example.com/video.mp4',
          description: 'Video caption'
        },
        {
          params: {
            access_token: 'page_token'
          }
        }
      );
    });

    it('should return error result when video publish fails', async () => {
      const mockError = {
        response: {
          data: {
            error: {
              message: 'Video file too large',
              code: 1000
            }
          }
        },
        isAxiosError: true
      };

      mockedAxios.post.mockRejectedValue(mockError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const result = await client.publishVideo(
        'page_123',
        'page_token',
        'https://example.com/large_video.mp4',
        'Video caption'
      );

      expect(result).toEqual({
        success: false,
        error: 'Facebook API Error: Video file too large (Code: 1000)'
      });
    });

    it('should use description field for video caption', async () => {
      const mockResponse = {
        data: { id: 'video_123' }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await client.publishVideo(
        'page_123',
        'page_token',
        'https://example.com/video.mp4',
        'My video description'
      );

      const callArgs = mockedAxios.post.mock.calls[0];
      expect(callArgs[1]).toHaveProperty('description', 'My video description');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockError = {
        message: 'Network Error',
        isAxiosError: true
      };

      mockedAxios.get.mockRejectedValue(mockError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(client.getPages('token')).rejects.toThrow(
        'Failed to retrieve Facebook Pages: Network error: Network Error'
      );
    });

    it('should handle unknown errors', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Something went wrong'));
      mockedAxios.isAxiosError.mockReturnValue(false);

      const result = await client.publishPhoto(
        'page_123',
        'token',
        'url',
        'caption'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });

    it('should handle errors without response data', async () => {
      const mockError = {
        response: {},
        isAxiosError: true,
        message: 'Request failed'
      };

      mockedAxios.get.mockRejectedValue(mockError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(client.getPages('token')).rejects.toThrow(
        'Failed to retrieve Facebook Pages: Network error: Request failed'
      );
    });
  });
});
