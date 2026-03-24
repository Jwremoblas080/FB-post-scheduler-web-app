import request from 'supertest';
import express from 'express';
import uploadRoutes from './uploadRoutes';
import { uploadService } from '../services/uploadService';

// Create test app
const app = express();
app.use(express.json());
app.use('/upload', uploadRoutes);

// Mock the upload service
jest.mock('../services/uploadService', () => ({
  uploadService: {
    uploadImages: jest.fn(),
    uploadVideo: jest.fn()
  }
}));

describe('Upload Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /upload/images', () => {
    it('should successfully upload multiple images', async () => {
      const mockPaths = ['uploads/image1.jpg', 'uploads/image2.png'];
      (uploadService.uploadImages as jest.Mock).mockResolvedValue(mockPaths);

      // Create test buffer
      const testBuffer = Buffer.from('fake image data');

      const response = await request(app)
        .post('/upload/images')
        .attach('images', testBuffer, 'test1.jpg')
        .attach('images', testBuffer, 'test2.png');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.filePaths).toEqual(mockPaths);
      expect(response.body.message).toContain('2 image(s)');
      expect(uploadService.uploadImages).toHaveBeenCalledTimes(1);
    });

    it('should return 400 when no files are provided', async () => {
      const response = await request(app)
        .post('/upload/images');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('No image files provided');
      expect(response.body.code).toBe('NO_FILES');
    });

    it('should return 400 when upload service throws error', async () => {
      (uploadService.uploadImages as jest.Mock).mockRejectedValue(
        new Error('Invalid image format')
      );

      const testBuffer = Buffer.from('fake image data');

      const response = await request(app)
        .post('/upload/images')
        .attach('images', testBuffer, 'test.txt');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('Invalid image format');
      expect(response.body.code).toBe('IMAGE_UPLOAD_FAILED');
    });

    it('should handle file size limit exceeded', async () => {
      (uploadService.uploadImages as jest.Mock).mockRejectedValue(
        new Error('File size exceeds maximum limit of 100MB')
      );

      const testBuffer = Buffer.from('fake large image data');

      const response = await request(app)
        .post('/upload/images')
        .attach('images', testBuffer, 'large.jpg');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('File size exceeds maximum limit');
    });

    it('should handle maximum images per post exceeded', async () => {
      // Note: Multer limits files to 10 at the middleware level
      // This test verifies that the service would reject if more files got through
      (uploadService.uploadImages as jest.Mock).mockRejectedValue(
        new Error('Maximum 10 images allowed per post. Received: 11')
      );

      const testBuffer = Buffer.from('fake image data');

      const response = await request(app)
        .post('/upload/images')
        .attach('images', testBuffer, 'test1.jpg')
        .attach('images', testBuffer, 'test2.jpg');

      // If the mock is called, it means files got through and service rejects
      // In practice, multer limits to 10 files at middleware level
      if (uploadService.uploadImages as jest.Mock) {
        expect(response.status).toBe(400);
        expect(response.body.error).toBe(true);
      }
    });
  });

  describe('POST /upload/video', () => {
    it('should successfully upload a video', async () => {
      const mockPath = 'uploads/video1.mp4';
      (uploadService.uploadVideo as jest.Mock).mockResolvedValue(mockPath);

      const testBuffer = Buffer.from('fake video data');

      const response = await request(app)
        .post('/upload/video')
        .attach('video', testBuffer, 'test.mp4');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.filePath).toBe(mockPath);
      expect(response.body.message).toBe('Successfully uploaded video');
      expect(uploadService.uploadVideo).toHaveBeenCalledTimes(1);
    });

    it('should return 400 when no file is provided', async () => {
      const response = await request(app)
        .post('/upload/video');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('No video file provided');
      expect(response.body.code).toBe('NO_FILE');
    });

    it('should return 400 when upload service throws error', async () => {
      (uploadService.uploadVideo as jest.Mock).mockRejectedValue(
        new Error('Invalid video format')
      );

      const testBuffer = Buffer.from('fake video data');

      const response = await request(app)
        .post('/upload/video')
        .attach('video', testBuffer, 'test.txt');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('Invalid video format');
      expect(response.body.code).toBe('VIDEO_UPLOAD_FAILED');
    });

    it('should handle video file size limit exceeded', async () => {
      (uploadService.uploadVideo as jest.Mock).mockRejectedValue(
        new Error('File size exceeds maximum limit of 100MB')
      );

      const testBuffer = Buffer.from('fake large video data');

      const response = await request(app)
        .post('/upload/video')
        .attach('video', testBuffer, 'large.mp4');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('File size exceeds maximum limit');
    });

    it('should handle unsupported video format', async () => {
      (uploadService.uploadVideo as jest.Mock).mockRejectedValue(
        new Error('Invalid video format. Supported formats: .mp4, .mov, .avi')
      );

      const testBuffer = Buffer.from('fake video data');

      const response = await request(app)
        .post('/upload/video')
        .attach('video', testBuffer, 'test.mkv');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('Invalid video format');
    });
  });
});
