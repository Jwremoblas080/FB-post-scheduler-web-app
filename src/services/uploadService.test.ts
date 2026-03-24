import { UploadService, UploadedFile } from './uploadService';
import * as fs from 'fs';
import * as path from 'path';

describe('UploadService', () => {
  let uploadService: UploadService;
  const testUploadDir = 'uploads-test';

  beforeEach(() => {
    uploadService = new UploadService(testUploadDir);
  });

  afterEach(async () => {
    // Clean up test directory
    if (fs.existsSync(testUploadDir)) {
      const files = fs.readdirSync(testUploadDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testUploadDir, file));
      }
      fs.rmdirSync(testUploadDir);
    }
  });

  describe('validateFile', () => {
    it('should accept valid JPEG image', () => {
      const file: UploadedFile = {
        originalName: 'test.jpg',
        size: 1024 * 1024, // 1MB
        buffer: Buffer.from('fake-image-data'),
        mimetype: 'image/jpeg'
      };

      const result = uploadService.validateFile(file, 'image');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid PNG image', () => {
      const file: UploadedFile = {
        originalName: 'test.png',
        size: 1024 * 1024,
        buffer: Buffer.from('fake-image-data'),
        mimetype: 'image/png'
      };

      const result = uploadService.validateFile(file, 'image');
      expect(result.valid).toBe(true);
    });

    it('should accept valid GIF image', () => {
      const file: UploadedFile = {
        originalName: 'test.gif',
        size: 1024 * 1024,
        buffer: Buffer.from('fake-image-data'),
        mimetype: 'image/gif'
      };

      const result = uploadService.validateFile(file, 'image');
      expect(result.valid).toBe(true);
    });

    it('should accept valid MP4 video', () => {
      const file: UploadedFile = {
        originalName: 'test.mp4',
        size: 10 * 1024 * 1024, // 10MB
        buffer: Buffer.from('fake-video-data'),
        mimetype: 'video/mp4'
      };

      const result = uploadService.validateFile(file, 'video');
      expect(result.valid).toBe(true);
    });

    it('should accept valid MOV video', () => {
      const file: UploadedFile = {
        originalName: 'test.mov',
        size: 10 * 1024 * 1024,
        buffer: Buffer.from('fake-video-data'),
        mimetype: 'video/quicktime'
      };

      const result = uploadService.validateFile(file, 'video');
      expect(result.valid).toBe(true);
    });

    it('should accept valid AVI video', () => {
      const file: UploadedFile = {
        originalName: 'test.avi',
        size: 10 * 1024 * 1024,
        buffer: Buffer.from('fake-video-data'),
        mimetype: 'video/x-msvideo'
      };

      const result = uploadService.validateFile(file, 'video');
      expect(result.valid).toBe(true);
    });

    it('should reject file exceeding 100MB size limit', () => {
      const file: UploadedFile = {
        originalName: 'large.jpg',
        size: 101 * 1024 * 1024, // 101MB
        buffer: Buffer.from('fake-data'),
        mimetype: 'image/jpeg'
      };

      const result = uploadService.validateFile(file, 'image');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum limit of 100MB');
    });

    it('should accept file exactly at 100MB size limit', () => {
      const file: UploadedFile = {
        originalName: 'exact.jpg',
        size: 100 * 1024 * 1024, // Exactly 100MB
        buffer: Buffer.from('fake-data'),
        mimetype: 'image/jpeg'
      };

      const result = uploadService.validateFile(file, 'image');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid image format', () => {
      const file: UploadedFile = {
        originalName: 'test.bmp',
        size: 1024 * 1024,
        buffer: Buffer.from('fake-data'),
        mimetype: 'image/bmp'
      };

      const result = uploadService.validateFile(file, 'image');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid image format');
    });

    it('should reject invalid video format', () => {
      const file: UploadedFile = {
        originalName: 'test.wmv',
        size: 10 * 1024 * 1024,
        buffer: Buffer.from('fake-data'),
        mimetype: 'video/x-ms-wmv'
      };

      const result = uploadService.validateFile(file, 'video');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid video format');
    });

    it('should handle case-insensitive file extensions', () => {
      const file: UploadedFile = {
        originalName: 'test.JPG',
        size: 1024 * 1024,
        buffer: Buffer.from('fake-data'),
        mimetype: 'image/jpeg'
      };

      const result = uploadService.validateFile(file, 'image');
      expect(result.valid).toBe(true);
    });
  });

  describe('uploadImages', () => {
    it('should successfully upload a single image', async () => {
      const file: UploadedFile = {
        originalName: 'test.jpg',
        size: 1024,
        buffer: Buffer.from('test-image-data'),
        mimetype: 'image/jpeg'
      };

      const paths = await uploadService.uploadImages([file]);
      
      expect(paths).toHaveLength(1);
      expect(paths[0]).toContain(testUploadDir);
      expect(fs.existsSync(paths[0])).toBe(true);
    });

    it('should successfully upload multiple images', async () => {
      const files: UploadedFile[] = [
        {
          originalName: 'test1.jpg',
          size: 1024,
          buffer: Buffer.from('test-image-1'),
          mimetype: 'image/jpeg'
        },
        {
          originalName: 'test2.png',
          size: 2048,
          buffer: Buffer.from('test-image-2'),
          mimetype: 'image/png'
        },
        {
          originalName: 'test3.gif',
          size: 3072,
          buffer: Buffer.from('test-image-3'),
          mimetype: 'image/gif'
        }
      ];

      const paths = await uploadService.uploadImages(files);
      
      expect(paths).toHaveLength(3);
      paths.forEach(p => {
        expect(fs.existsSync(p)).toBe(true);
      });
    });

    it('should upload up to 10 images', async () => {
      const files: UploadedFile[] = Array.from({ length: 10 }, (_, i) => ({
        originalName: `test${i}.jpg`,
        size: 1024,
        buffer: Buffer.from(`test-image-${i}`),
        mimetype: 'image/jpeg'
      }));

      const paths = await uploadService.uploadImages(files);
      
      expect(paths).toHaveLength(10);
      paths.forEach(p => {
        expect(fs.existsSync(p)).toBe(true);
      });
    });

    it('should reject more than 10 images', async () => {
      const files: UploadedFile[] = Array.from({ length: 11 }, (_, i) => ({
        originalName: `test${i}.jpg`,
        size: 1024,
        buffer: Buffer.from(`test-image-${i}`),
        mimetype: 'image/jpeg'
      }));

      await expect(uploadService.uploadImages(files)).rejects.toThrow('Maximum 10 images allowed');
    });

    it('should reject empty file array', async () => {
      await expect(uploadService.uploadImages([])).rejects.toThrow('No image files provided');
    });

    it('should clean up files on validation failure', async () => {
      const files: UploadedFile[] = [
        {
          originalName: 'valid.jpg',
          size: 1024,
          buffer: Buffer.from('valid-image'),
          mimetype: 'image/jpeg'
        },
        {
          originalName: 'invalid.bmp',
          size: 1024,
          buffer: Buffer.from('invalid-image'),
          mimetype: 'image/bmp'
        }
      ];

      await expect(uploadService.uploadImages(files)).rejects.toThrow('Invalid image format');
      
      // Check that no files remain in upload directory
      const remainingFiles = fs.readdirSync(testUploadDir);
      expect(remainingFiles).toHaveLength(0);
    });

    it('should clean up files on size limit failure', async () => {
      const files: UploadedFile[] = [
        {
          originalName: 'valid.jpg',
          size: 1024,
          buffer: Buffer.from('valid-image'),
          mimetype: 'image/jpeg'
        },
        {
          originalName: 'toolarge.jpg',
          size: 101 * 1024 * 1024,
          buffer: Buffer.from('large-image'),
          mimetype: 'image/jpeg'
        }
      ];

      await expect(uploadService.uploadImages(files)).rejects.toThrow('exceeds maximum limit');
      
      // Check that no files remain in upload directory
      const remainingFiles = fs.readdirSync(testUploadDir);
      expect(remainingFiles).toHaveLength(0);
    });

    it('should generate unique filenames for uploaded files', async () => {
      const files: UploadedFile[] = [
        {
          originalName: 'test.jpg',
          size: 1024,
          buffer: Buffer.from('image-1'),
          mimetype: 'image/jpeg'
        },
        {
          originalName: 'test.jpg', // Same name
          size: 1024,
          buffer: Buffer.from('image-2'),
          mimetype: 'image/jpeg'
        }
      ];

      const paths = await uploadService.uploadImages(files);
      
      expect(paths[0]).not.toBe(paths[1]);
      expect(fs.existsSync(paths[0])).toBe(true);
      expect(fs.existsSync(paths[1])).toBe(true);
    });
  });

  describe('uploadVideo', () => {
    it('should successfully upload a video', async () => {
      const file: UploadedFile = {
        originalName: 'test.mp4',
        size: 10 * 1024 * 1024,
        buffer: Buffer.from('test-video-data'),
        mimetype: 'video/mp4'
      };

      const path = await uploadService.uploadVideo(file);
      
      expect(path).toContain(testUploadDir);
      expect(fs.existsSync(path)).toBe(true);
    });

    it('should reject invalid video format', async () => {
      const file: UploadedFile = {
        originalName: 'test.wmv',
        size: 10 * 1024 * 1024,
        buffer: Buffer.from('test-video-data'),
        mimetype: 'video/x-ms-wmv'
      };

      await expect(uploadService.uploadVideo(file)).rejects.toThrow('Invalid video format');
      
      // Verify no files remain in upload directory
      const remainingFiles = fs.readdirSync(testUploadDir);
      expect(remainingFiles).toHaveLength(0);
    });

    it('should reject oversized video', async () => {
      const file: UploadedFile = {
        originalName: 'large.mp4',
        size: 101 * 1024 * 1024,
        buffer: Buffer.from('large-video-data'),
        mimetype: 'video/mp4'
      };

      await expect(uploadService.uploadVideo(file)).rejects.toThrow('exceeds maximum limit');
      
      // Verify no files remain in upload directory
      const remainingFiles = fs.readdirSync(testUploadDir);
      expect(remainingFiles).toHaveLength(0);
    });
  });

  describe('deleteFile', () => {
    it('should delete an existing file', async () => {
      // First upload a file
      const file: UploadedFile = {
        originalName: 'test.jpg',
        size: 1024,
        buffer: Buffer.from('test-data'),
        mimetype: 'image/jpeg'
      };

      const paths = await uploadService.uploadImages([file]);
      const filepath = paths[0];
      
      expect(fs.existsSync(filepath)).toBe(true);

      // Delete the file
      await uploadService.deleteFile(filepath);
      
      expect(fs.existsSync(filepath)).toBe(false);
    });

    it('should not throw error when deleting non-existent file', async () => {
      const nonExistentPath = path.join(testUploadDir, 'nonexistent.jpg');
      
      await expect(uploadService.deleteFile(nonExistentPath)).resolves.not.toThrow();
    });
  });
});
