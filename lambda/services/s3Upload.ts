import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomBytes } from 'crypto';
import path from 'path';

const s3 = new S3Client({});
const BUCKET = process.env.S3_BUCKET!;

const IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const VIDEO_FORMATS = ['.mp4', '.mov', '.avi'];
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_IMAGES = 10;

export interface UploadedFile {
  originalName: string;
  size: number;
  buffer: Buffer;
  mimetype: string;
}

function validateFile(file: UploadedFile, mediaType: 'image' | 'video'): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File ${file.originalName} exceeds 100MB limit`);
  }
  const ext = path.extname(file.originalName).toLowerCase();
  if (mediaType === 'image' && !IMAGE_FORMATS.includes(ext)) {
    throw new Error(`Invalid image format: ${ext}. Supported: ${IMAGE_FORMATS.join(', ')}`);
  }
  if (mediaType === 'video' && !VIDEO_FORMATS.includes(ext)) {
    throw new Error(`Invalid video format: ${ext}. Supported: ${VIDEO_FORMATS.join(', ')}`);
  }
}

function generateKey(originalName: string): string {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
  const rand = randomBytes(8).toString('hex');
  return `uploads/${base}_${Date.now()}_${rand}${ext}`;
}

export function getPublicUrl(key: string): string {
  return `https://${BUCKET}.s3.amazonaws.com/${key}`;
}

export async function uploadImages(files: UploadedFile[]): Promise<string[]> {
  if (files.length === 0) throw new Error('No image files provided');
  if (files.length > MAX_IMAGES) throw new Error(`Max ${MAX_IMAGES} images allowed`);

  const urls: string[] = [];
  for (const file of files) {
    validateFile(file, 'image');
    const key = generateKey(file.originalName);
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));
    urls.push(getPublicUrl(key));
  }
  return urls;
}

export async function uploadVideo(file: UploadedFile): Promise<string> {
  validateFile(file, 'video');
  const key = generateKey(file.originalName);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }));
  return getPublicUrl(key);
}
