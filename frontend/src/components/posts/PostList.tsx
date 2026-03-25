import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../../api/client';
import ConfirmModal from '../common/ConfirmModal';

interface Post {
  id: string;
  caption: string;
  mediaType: 'image' | 'video';
  mediaUrls: string[];
  scheduledTime: string;
  pageId: string;
  pageName?: string;
  status: 'pending' | 'posted' | 'failed';
  errorMessage?: string;
  createdAt: string;
}

type StatusFilter = 'all' | 'pending' | 'posted' | 'failed';
type SortDir = 'asc' | 'desc';
interface PostListProps { refreshKey?: number; }

const BADGE: Record<Post['status'], string> = {
  pending: 'badge badge-pending',
  posted:  'badge badge-posted',
  failed:  'badge badge-failed',
};

function parseMediaPaths(mediaUrls: string | string[]): string[] {
  if (Array.isArray(mediaUrls)) return mediaUrls;
  try { const p = JSON.parse(mediaUrls); return Array.isArray(p) ? p : [mediaUrls]; }
  catch { return [mediaUrls]; }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Feature 6 — relative time without date-fns
function formatRelative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const past = diff < 0;
  const mins  = Math.floor(abs / 60_000);
  const hours = Math.floor(abs / 3_600_000);
  const days  = Math.floor(abs / 86_400_000);
  let label: string;
  if (mins < 1)       label = 'just now';
  else if (mins < 60) label = `${mins}m`;
  else if (hours < 24) label = `${hours}h`;
  else                label = `${days}d`;
  if (label === 'just now') return label;
  return past ? `${label} ago` : `in ${label}`;
}

function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  post: Post;
  onSave: (id: string, caption: string, scheduledTime: string) => Promise<void>;
  onClose: () => void;
}

function EditModal({ post, onSave, onClose }: EditModalProps) {
  const [caption, setCaption] = useState(post.caption);
  const [scheduledTime, setScheduledTime] = useState(toLocalDatetimeInput(post.scheduledTime));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const minDateTime = new Date(Date.now() + 60_000).toISOString().slice(0, 16);

  async function handleSave() {
    if (!caption.trim()) { setError('Caption cannot be empty.'); return; }
    if (!scheduledTime) { setError('Scheduled time is required.'); return; }
    if (new Date(scheduledTime) <= new Date()) { setError('Scheduled time must be in the future.'); return; }
    setSaving(true); setError('');
    try {
      await onSave(post.id, caption.trim(), new Date(scheduledTime).toISOString());
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
        <h3 id="edit-modal-title" className="modal-title" style={{ textAlign: 'left', marginBottom: 20 }}>Edit Post</h3>
        <div className="field" style={{ marginBottom: 16 }}>
          <label htmlFor="edit-caption">Caption</label>
          <textarea id="edit-caption" value={caption} onChange={e => setCaption(e.target.value)} rows={4} />
          <span style={{ fontSize: 11, color: 'var(--text-light)', textAlign: 'right', display: 'block' }}>{caption.length} chars</span>
        </div>
        <div className="field" style={{ marginBottom: 20 }}>
          <label htmlFor="edit-time">Scheduled time</label>
          <input id="edit-time" type="datetime-local" value={scheduledTime} min={minDateTime} onChange={e => setScheduledTime(e.target.value)} />
        </div>
        {error && <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} autoFocus>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PostList ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 30_000;

export default function PostList({ refreshKey = 0 }: PostListProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [confirmPost, setConfirmPost] = useState<Post | null>(null);
  const [editPost, setEditPost] = useState<Post | null>(null);
  // Feature 8 — filter + sort
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPosts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await apiClient.get<{ posts: Post[] }>('/posts');
      setPosts(res.data.posts);
    } catch {
      setError('Failed to load posts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts, refreshKey]);

  useEffect(() => {
    pollRef.current = setInterval(() => fetchPosts(true), POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchPosts]);

  async function handleDelete(postId: string) {
    setConfirmPost(null);
    setDeletingId(postId);
    try {
      await apiClient.delete(`/posts/${postId}`);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch {
      setError('Failed to delete post.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRetry(postId: string) {
    setRetryingId(postId);
    try {
      await apiClient.post(`/posts/${postId}/retry`);
      await fetchPosts(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to retry post.');
    } finally {
      setRetryingId(null);
    }
  }

  async function handleEdit(postId: string, caption: string, scheduledTime: string) {
    await apiClient.patch(`/posts/${postId}`, { caption, scheduledTime });
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, caption, scheduledTime } : p));
  }

  // Feature 7 — stats
  const stats = {
    pending: posts.filter(p => p.status === 'pending').length,
    posted:  posts.filter(p => p.status === 'posted').length,
    failed:  posts.filter(p => p.status === 'failed').length,
  };

  // Feature 8 — filter + sort applied
  const visible = posts
    .filter(p => statusFilter === 'all' || p.status === statusFilter)
    .sort((a, b) => {
      const diff = new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime();
      return sortDir === 'asc' ? diff : -diff;
    });

  if (loading) return <p style={{ color: 'var(--text-light)', fontSize: 14 }}>Loading…</p>;
  if (error)   return <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>;

  return (
    <>
      {confirmPost && (
        <ConfirmModal
          title="Delete this post?"
          message={`"${confirmPost.caption.slice(0, 72)}${confirmPost.caption.length > 72 ? '…' : ''}"`}
          onConfirm={() => handleDelete(confirmPost.id)}
          onCancel={() => setConfirmPost(null)}
        />
      )}
      {editPost && (
        <EditModal post={editPost} onSave={handleEdit} onClose={() => setEditPost(null)} />
      )}

      {/* Feature 7 — stats summary */}
      {posts.length > 0 && (
        <div className="stats-row">
          <button
            className={`stats-chip${statusFilter === 'all' ? ' active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            {posts.length} total
          </button>
          <button
            className={`stats-chip stats-chip-pending${statusFilter === 'pending' ? ' active' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          >
            {stats.pending} pending
          </button>
          <button
            className={`stats-chip stats-chip-posted${statusFilter === 'posted' ? ' active' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'posted' ? 'all' : 'posted')}
          >
            {stats.posted} posted
          </button>
          {stats.failed > 0 && (
            <button
              className={`stats-chip stats-chip-failed${statusFilter === 'failed' ? ' active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'failed' ? 'all' : 'failed')}
            >
              {stats.failed} failed
            </button>
          )}
          {/* Feature 8 — sort + refresh */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              title="Toggle sort order"
            >
              {sortDir === 'asc' ? '↑ Oldest' : '↓ Newest'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => fetchPosts(true)} title="Refresh">
              ↻
            </button>
          </div>
        </div>
      )}

      {/* Feature 10 — empty state with CTA */}
      {posts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <p className="empty-state-title">No scheduled posts yet</p>
          <p className="empty-state-hint">Fill in the form above to schedule your first post ↑</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 13 }}>No {statusFilter} posts.</p>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setStatusFilter('all')}>
            Show all
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(post => {
            const paths = parseMediaPaths(post.mediaUrls);
            const firstPath = paths[0];
            const canEdit   = post.status === 'pending';
            const canDelete = post.status === 'pending' || post.status === 'failed';
            const canRetry  = post.status === 'failed';

            return (
              <div key={post.id} className="post-card">
                {/* Thumbnail */}
                <div className="post-thumb">
                  {post.mediaType === 'video' ? (
                    <span className="post-thumb-video">▶</span>
                  ) : (
                    <img src={firstPath?.startsWith('http') ? firstPath : `/${firstPath?.replace(/^\//, '')}`} alt="thumbnail" />
                  )}
                </div>

                {/* Details */}
                <div className="post-body">
                  <div className="post-meta">
                    <span className={BADGE[post.status]}>{post.status}</span>
                    {post.pageName && <span className="post-page">{post.pageName}</span>}
                    {paths.length > 1 && <span style={{ fontSize: 11, color: 'var(--text-light)' }}>+{paths.length - 1} more</span>}
                  </div>
                  <p className="post-caption">{post.caption}</p>
                  {/* Feature 6 — relative + absolute time */}
                  <p className="post-time">
                    {formatDateTime(post.scheduledTime)}
                    <span className="post-time-relative">{formatRelative(post.scheduledTime)}</span>
                  </p>
                  {canRetry && post.errorMessage && (
                    <p className="post-error">{post.errorMessage}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="post-actions">
                  {canEdit && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditPost(post)}>Edit</button>
                  )}
                  {canRetry && (
                    <button
                      className="btn btn-warning btn-sm"
                      onClick={() => handleRetry(post.id)}
                      disabled={retryingId === post.id}
                    >
                      {retryingId === post.id ? '…' : 'Retry'}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      className="btn btn-danger-ghost btn-sm"
                      onClick={() => setConfirmPost(post)}
                      disabled={deletingId === post.id}
                    >
                      {deletingId === post.id ? '…' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
