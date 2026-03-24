import { Router, Request, Response } from 'express';
import multer from 'multer';
import { uploadService, UploadedFile } from '../services/uploadService';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

/**
 * POST /upload/images
 * Upload multiple images
 * Requirements: 3.1, 3.3
 */
router.post('/images', upload.array('images', 10), async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({
        error: true,
        message: 'No image files provided',
        code: 'NO_FILES'
      });
      return;
    }

    // Convert multer files to UploadedFile format
    const uploadedFiles: UploadedFile[] = files.map(file => ({
      originalName: file.originalname,
      size: file.size,
      buffer: file.buffer,
      mimetype: file.mimetype
    }));

    // Upload images using the upload service
    const filePaths = await uploadService.uploadImages(uploadedFiles);

    res.json({
      success: true,
      message: `Successfully uploaded ${filePaths.length} image(s)`,
      filePaths: filePaths
    });
  } catch (error: any) {
    res.status(400).json({
      error: true,
      message: error.message || 'Failed to upload images',
      code: 'IMAGE_UPLOAD_FAILED'
    });
  }
});

/**
 * POST /upload/video
 * Upload single video
 * Requirements: 3.2, 3.4
 */
router.post('/video', upload.single('video'), async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file as Express.Multer.File;

    if (!file) {
      res.status(400).json({
        error: true,
        message: 'No video file provided',
        code: 'NO_FILE'
      });
      return;
    }

    // Convert multer file to UploadedFile format
    const uploadedFile: UploadedFile = {
      originalName: file.originalname,
      size: file.size,
      buffer: file.buffer,
      mimetype: file.mimetype
    };

    // Upload video using the upload service
    const filePath = await uploadService.uploadVideo(uploadedFile);

    res.json({
      success: true,
      message: 'Successfully uploaded video',
      filePath: filePath
    });
  } catch (error: any) {
    res.status(400).json({
      error: true,
      message: error.message || 'Failed to upload video',
      code: 'VIDEO_UPLOAD_FAILED'
    });
  }
});

export default router;
