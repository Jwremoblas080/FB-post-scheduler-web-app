import { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/client';

interface Page { id: string; name: string; }
interface PostFormProps { onSuccess?: () => void; }
interface FormErrors {
  caption?: string; media?: string; scheduledTime?: string; pageId?: string; submit?: string;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const MAX_IMAGES = 10;

export default function PostForm({ onSuccess }: PostFormProps) {
  const [pages, setPages] = useState<Page[]>([]);
  const [pagesError, setPagesError] = useState('');
  const [mediaType, setMediaType] = useState<'images' | 'video'>('images');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState('');
  const [caption, setCaption] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [pageId, setPageId] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiClient.get<{ pages: Page[] }>('/auth/pages')
      .then(res => setPages(res.data.pages))
      .catch(() => setPagesError('Failed to load pages. Please log in first.'));
  }, []);

  function handleMediaTypeChange(type: 'images' | 'video') {
    setMediaType(type);
    setImageFiles([]); setImagePreviews([]);
    setVideoFile(null); setVideoPreview('');
    setErrors(prev => ({ ...prev, media: undefined }));
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    const errs: string[] = [];
    const valid = selected.filter(f => {
      if (!IMAGE_TYPES.includes(f.type)) { errs.push(`${f.name}: unsupported format`); return false; }
      if (f.size > MAX_IMAGE_SIZE) { errs.push(`${f.name}: exceeds 4 MB`); return false; }
      return true;
    });
    const combined = [...imageFiles, ...valid].slice(0, MAX_IMAGES);
    if (imageFiles.length + valid.length > MAX_IMAGES) errs.push(`Max ${MAX_IMAGES} images`);
    setImageFiles(combined);
    setImagePreviews(combined.map(f => URL.createObjectURL(f)));
    setErrors(prev => ({ ...prev, media: errs.length ? errs.join(' · ') : undefined }));
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  function removeImage(index: number) {
    const updated = imageFiles.filter((_, i) => i !== index);
    setImageFiles(updated);
    setImagePreviews(updated.map(f => URL.createObjectURL(f)));
  }

  function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!VIDEO_TYPES.includes(file.type)) {
      setErrors(prev => ({ ...prev, media: 'Unsupported format. Use MP4, MOV, or AVI.' }));
      return;
    }
    if (file.size > MAX_VIDEO_SIZE) {
      setErrors(prev => ({ ...prev, media: 'Video exceeds 100 MB limit.' }));
      return;
    }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setErrors(prev => ({ ...prev, media: undefined }));
  }

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!caption.trim()) errs.caption = 'Caption is required.';
    if (mediaType === 'images' && imageFiles.length === 0) errs.media = 'Select at least one image.';
    if (mediaType === 'video' && !videoFile) errs.media = 'Select a video file.';
    if (!scheduledTime) errs.scheduledTime = 'Scheduled time is required.';
    else if (new Date(scheduledTime) <= new Date()) errs.scheduledTime = 'Must be in the future.';
    if (!pageId) errs.pageId = 'Select a page.';
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true); setErrors({});
    try {
      let mediaPaths: string[] = [];
      if (mediaType === 'images') {
        const fd = new FormData();
        imageFiles.forEach(f => fd.append('images', f));
        const res = await apiClient.post<{ filePaths: string[] }>('/upload/images', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        mediaPaths = res.data.filePaths;
      } else {
        const fd = new FormData();
        fd.append('video', videoFile!);
        const res = await apiClient.post<{ filePath: string }>('/upload/video', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        mediaPaths = [res.data.filePath];
      }
      await apiClient.post('/posts', { caption, mediaType, mediaPaths, scheduledTime: new Date(scheduledTime).toISOString(), pageId });
      setCaption(''); setScheduledTime(''); setPageId('');
      setImageFiles([]); setImagePreviews([]);
      setVideoFile(null); setVideoPreview('');
      onSuccess?.();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create post.';
      setErrors({ submit: message });
    } finally {
      setSubmitting(false);
    }
  }

  const minDateTime = new Date(Date.now() + 60_000).toISOString().slice(0, 16);

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Page */}
      <div className="field">
        <label htmlFor="pageId">Facebook Page</label>
        {pagesError && <span className="field-error">{pagesError}</span>}
        <select id="pageId" value={pageId} onChange={e => setPageId(e.target.value)}>
          <option value="">Select a page…</option>
          {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {errors.pageId && <span className="field-error">{errors.pageId}</span>}
      </div>

      {/* Caption */}
      <div className="field">
        <label htmlFor="caption">Caption</label>
        <textarea id="caption" value={caption} onChange={e => setCaption(e.target.value)} placeholder="Write your post caption…" rows={3} />
        {errors.caption && <span className="field-error">{errors.caption}</span>}
      </div>

      {/* Media type */}
      <div className="field">
        <label>Media</label>
        <div className="media-toggle">
          <button type="button" className={`media-toggle-btn${mediaType === 'images' ? ' active' : ''}`} onClick={() => handleMediaTypeChange('images')}>
            Images
          </button>
          <button type="button" className={`media-toggle-btn${mediaType === 'video' ? ' active' : ''}`} onClick={() => handleMediaTypeChange('video')}>
            Video
          </button>
        </div>
      </div>

      {/* Image upload */}
      {mediaType === 'images' && (
        <div className="field">
          <div className="upload-zone">
            <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={handleImageChange} />
            <p className="upload-zone-text">Click or drag images here</p>
            <p className="upload-zone-hint">JPEG, PNG, GIF, WebP · max 4 MB each · up to {MAX_IMAGES}</p>
          </div>
          {imagePreviews.length > 0 && (
            <div className="preview-grid">
              {imagePreviews.map((src, i) => (
                <div key={i} className="preview-item">
                  <img src={src} alt={`preview ${i + 1}`} />
                  <button type="button" className="preview-remove" onClick={() => removeImage(i)} aria-label={`Remove image ${i + 1}`}>×</button>
                </div>
              ))}
            </div>
          )}
          {errors.media && <span className="field-error">{errors.media}</span>}
        </div>
      )}

      {/* Video upload */}
      {mediaType === 'video' && (
        <div className="field">
          <div className="upload-zone">
            <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,video/x-msvideo" onChange={handleVideoChange} />
            <p className="upload-zone-text">Click or drag video here</p>
            <p className="upload-zone-hint">MP4, MOV, AVI · max 100 MB</p>
          </div>
          {videoPreview && (
            <div className="video-preview">
              <video src={videoPreview} controls />
            </div>
          )}
          {errors.media && <span className="field-error">{errors.media}</span>}
        </div>
      )}

      {/* Scheduled time */}
      <div className="field">
        <label htmlFor="scheduledTime">Schedule for</label>
        <input id="scheduledTime" type="datetime-local" value={scheduledTime} min={minDateTime} onChange={e => setScheduledTime(e.target.value)} />
        {errors.scheduledTime && <span className="field-error">{errors.scheduledTime}</span>}
      </div>

      {errors.submit && (
        <div className="alert alert-error" style={{ marginTop: 12 }}>{errors.submit}</div>
      )}

      <button type="submit" disabled={submitting} className="btn btn-primary btn-full" style={{ marginTop: 20 }}>
        {submitting ? 'Scheduling…' : 'Schedule Post'}
      </button>
    </form>
  );
}
