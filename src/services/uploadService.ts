import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

// File validation constants
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes
const IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.gif'];
const VIDEO_FORMATS = ['.mp4', '.mov', '.avi'];
const MAX_IMAGES_PER_POST = 10;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface UploadedFile {
  originalName: string;
  size: number;
  buffer: Buffer;
  mimetype: string;
}

/**
 * Upload Service handles media file uploads with validation
 */
export class UploadService {
  private uploadDirectory: string;

  constructor(uploadDirectory: string = 'uploads') {
    this.uploadDirectory = uploadDirectory;
    this.ensureUploadDirectorySync();
  }

  /**
   * Ensure upload directory exists (synchronous for constructor)
   */
  private ensureUploadDirectorySync(): void {
    try {
      if (!fs.existsSync(this.uploadDirectory)) {
        fs.mkdirSync(this.uploadDirectory, { recursive: true });
      }
    } catch (error) {
      // Directory might already exist, ignore error
    }
  }

  /**
   * Validate a file based on type and size
   * Requirements: 3.1, 3.2, 3.6
   */
  validateFile(file: UploadedFile, mediaType: 'image' | 'video'): FileValidationResult {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds maximum limit of 100MB. File size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`
      };
    }

    // Get file extension
    const ext = path.extname(file.originalName).toLowerCase();

    // Validate based on media type
    if (mediaType === 'image') {
      if (!IMAGE_FORMATS.includes(ext)) {
        return {
          valid: false,
          error: `Invalid image format. Supported formats: ${IMAGE_FORMATS.join(', ')}`
        };
      }
    } else if (mediaType === 'video') {
      if (!VIDEO_FORMATS.includes(ext)) {
        return {
          valid: false,
          error: `Invalid video format. Supported formats: ${VIDEO_FORMATS.join(', ')}`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Upload multiple image files
   * Requirements: 3.1, 3.3, 3.5
   */
  async uploadImages(files: UploadedFile[]): Promise<string[]> {
    // Validate number of images
    if (files.length > MAX_IMAGES_PER_POST) {
      throw new Error(`Maximum ${MAX_IMAGES_PER_POST} images allowed per post. Received: ${files.length}`);
    }

    if (files.length === 0) {
      throw new Error('No image files provided');
    }

    const uploadedPaths: string[] = [];
    const filesToCleanup: string[] = [];

    try {
      for (const file of files) {
        // Validate each file
        const validation = this.validateFile(file, 'image');
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        // Generate unique filename
        const filename = this.generateUniqueFilename(file.originalName);
        const filepath = path.join(this.uploadDirectory, filename);

        // Write file to disk
        await writeFile(filepath, file.buffer);
        
        // Normalize to forward slashes for use as URL paths
        uploadedPaths.push(filepath.replace(/\\/g, '/'));
        filesToCleanup.push(filepath);
      }

      return uploadedPaths;
    } catch (error) {
      // Clean up any files that were uploaded before the error
      await this.cleanupFiles(filesToCleanup);
      throw error;
    }
  }

  /**
   * Upload a single video file
   * Requirements: 3.2, 3.4, 3.5, 7.5
   */
  async uploadVideo(file: UploadedFile): Promise<string> {
    // Validate file
    const validation = this.validateFile(file, 'video');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    let filepath: string | null = null;

    try {
      // Generate unique filename
      const filename = this.generateUniqueFilename(file.originalName);
      filepath = path.join(this.uploadDirectory, filename);

      // Write file to disk
      await writeFile(filepath, file.buffer);

      // Normalize to forward slashes for use as URL paths
      return filepath.replace(/\\/g, '/');
    } catch (error) {
      // Clean up partial upload if file was created
      if (filepath) {
        await this.deleteFile(filepath);
      }
      throw new Error(`Failed to upload video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a file from the upload directory
   * Requirements: 7.5
   */
  async deleteFile(filepath: string): Promise<void> {
    try {
      // Check if file exists before attempting to delete
      if (fs.existsSync(filepath)) {
        await unlink(filepath);
      }
    } catch (error) {
      console.error(`Failed to delete file ${filepath}:`, error);
      // Don't throw error, just log it
    }
  }

  /**
   * Clean up multiple files (used for error recovery)
   * Requirements: 7.5
   */
  private async cleanupFiles(filepaths: string[]): Promise<void> {
    for (const filepath of filepaths) {
      await this.deleteFile(filepath);
    }
  }

  /**
   * Generate a unique filename to avoid collisions
   */
  private generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const ext = path.extname(originalName);
    const basename = path.basename(originalName, ext);
    
    // Sanitize basename to remove special characters
    const sanitized = basename.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    return `${sanitized}_${timestamp}_${random}${ext}`;
  }
}

// Export singleton instance
export const uploadService = new UploadService();
