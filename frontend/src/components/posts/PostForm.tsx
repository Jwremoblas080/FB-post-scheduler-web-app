import { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/client';

interface Page { id: string; name: string; }
interface PostFormProps {
  onSuccess?: () => void;
  onError?: (msg: string) => void;
}
interface FormErrors {
  caption?: string; media?: string; scheduledTime?: string; pageId?: string; submit?: string;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const MAX_IMAGES = 10;

// Feature 14 — quick-pick helpers
function getQuickPicks(): { label: string; value: string }[] {
  const now = new Date();
  const picks: { label: string; value: string }[] = [];

  function fmt(d: Date) {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  // Tomorrow 9am
  const tom9 = new Date(now); tom9.setDate(tom9.getDate() + 1); tom9.setHours(9, 0, 0, 0);
  picks.push({ label: 'Tomorrow 9am', value: fmt(tom9) });

  // Tomorrow 12pm
  const tom12 = new Date(now); tom12.setDate(tom12.getDate() + 1); tom12.setHours(12, 0, 0, 0);
  picks.push({ label: 'Tomorrow 12pm', value: fmt(tom12) });

  // Tomorrow 6pm
  const tom18 = new Date(now); tom18.setDate(tom18.getDate() + 1); tom18.setHours(18, 0, 0, 0);
  picks.push({ label: 'Tomorrow 6pm', value: fmt(tom18) });

  // Next Monday 10am
  const mon = new Date(now);
  const daysUntilMon = (8 - mon.getDay()) % 7 || 7;
  mon.setDate(mon.getDate() + daysUntilMon); mon.setHours(10, 0, 0, 0);
  picks.push({ label: 'Mon 10am', value: fmt(mon) });

  // Next weekend Saturday 11am
  const sat = new Date(now);
  const daysUntilSat = (6 - sat.getDay() + 7) % 7 || 7;
  sat.setDate(sat.getDate() + daysUntilSat); sat.setHours(11, 0, 0, 0);
  picks.push({ label: 'Sat 11am', value: fmt(sat) });

  return picks;
}

export default function PostForm({ onSuccess, onError }: PostFormProps) {
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
    apiClient.get<{ pages: Page[]; hint?: string }>('/auth/pages')
      .then(res => {
        if (res.data.pages.length === 0 && res.data.hint) {
          setPagesError('Pages not loaded. Please click "Connect with Facebook" again to refresh.');
        } else {
          setPages(res.data.pages.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i));
        }
      })
      .catch((err) => {
        const status = err?.response?.status;
        const code = err?.response?.data?.code;
        if (status === 401) {
          localStorage.removeItem('fb_connected');
          setPagesError('Not connected. Please click "Connect with Facebook".');
        } else if (code === 'NETWORK_ERROR' || status === 503) {
          setPagesError('Server has no internet access. Check backend network connection.');
        } else {
          localStorage.removeItem('fb_connected');
          setPagesError('Failed to load pages. Please log in first.');
        }
      });
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
      await apiClient.post('/posts', {
        caption,
        mediaType: mediaType === 'images' ? 'image' : 'video',
        mediaPaths,
        scheduledTime: new Date(scheduledTime).toISOString(),
        pageId,
      });
      setCaption(''); setScheduledTime(''); setPageId('');
      setImageFiles([]); setImagePreviews([]);
      setVideoFile(null); setVideoPreview('');
      onSuccess?.();
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string; error?: string } } })?.response;
      const message = response?.data?.message || response?.data?.error || (err as Error)?.message || 'Failed to create post.';
      console.error('Post creation error:', err);
      setErrors({ submit: message });
      onError?.(message);
    } finally {
      setSubmitting(false);
    }
  }

  // Feature 12 — Ctrl+Enter to submit
  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  const minDateTime = new Date(Date.now() + 60_000).toISOString().slice(0, 16);
  const quickPicks = getQuickPicks();

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

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
        <textarea
          id="caption"
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Write your post caption… (Ctrl+Enter to submit)"
          rows={3}
        />
        <div className="caption-counter-row">
          {errors.caption ? <span className="field-error">{errors.caption}</span> : <span />}
          <span className={`caption-counter${caption.length > 63206 ? ' caption-counter-over' : caption.length > 280 ? ' caption-counter-warn' : ''}`}>
            {caption.length} / 63,206
          </span>
        </div>
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
            <p className="upload-zone-hint">JPEG, PNG, GIF, WebP · max 20 MB each · up to {MAX_IMAGES}</p>
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

      {/* Scheduled time + Feature 14 quick picks */}
      <div className="field">
        <label htmlFor="scheduledTime">Schedule for</label>
        <input
          id="scheduledTime"
          type="datetime-local"
          value={scheduledTime}
          min={minDateTime}
          onChange={e => setScheduledTime(e.target.value)}
        />
        <div className="quick-picks">
          {quickPicks.map(p => (
            <button
              key={p.label}
              type="button"
              className="quick-pick-btn"
              onClick={() => setScheduledTime(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {errors.scheduledTime && <span className="field-error">{errors.scheduledTime}</span>}
      </div>

      {errors.submit && (
        <div className="alert alert-error" style={{ marginTop: 12 }}>{errors.submit}</div>
      )}

      <button type="submit" disabled={submitting} className="btn btn-primary btn-full" style={{ marginTop: 20 }}>
        {submitting ? 'Scheduling…' : 'Schedule Post'}
        {!submitting && <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>Ctrl+↵</span>}
      </button>
    </form>
  );
}
