import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';

interface Post {
  id: number;
  userId: number;
  caption: string;
  mediaType: 'image' | 'video';
  mediaPaths: string;
  scheduledTime: string;
  pageId: string;
  pageName?: string;
  status: 'pending' | 'posted' | 'failed';
  errorMessage?: string;
  createdAt: string;
}

interface PostListProps { refreshKey?: number; }

const BADGE: Record<Post['status'], string> = {
  pending: 'badge badge-pending',
  posted: 'badge badge-posted',
  failed: 'badge badge-failed',
};

function parseMediaPaths(mediaPaths: string): string[] {
  try {
    const parsed = JSON.parse(mediaPaths);
    return Array.isArray(parsed) ? parsed : [mediaPaths];
  } catch { return [mediaPaths]; }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function PostList({ refreshKey = 0 }: PostListProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await apiClient.get<{ posts: Post[] }>('/posts');
      const sorted = [...res.data.posts].sort(
        (a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
      );
      setPosts(sorted);
    } catch {
      setError('Failed to load posts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts, refreshKey]);

  async function handleDelete(postId: number) {
    if (!window.confirm('Delete this post?')) return;
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

  if (loading) return <p style={{ color: 'var(--text-light)', fontSize: 14 }}>Loading…</p>;
  if (error) return <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>;
  if (posts.length === 0) return <div className="empty-state">No scheduled posts yet.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {posts.map(post => {
        const paths = parseMediaPaths(post.mediaPaths);
        const canDelete = post.status === 'pending' || post.status === 'failed';
        const firstPath = paths[0];

        return (
          <div key={post.id} className="post-card">
            {/* Thumbnail */}
            <div className="post-thumb">
              {post.mediaType === 'video' ? (
                <span className="post-thumb-video">Vid</span>
              ) : (
                <img src={`http://localhost:3000${firstPath}`} alt="thumbnail" />
              )}
            </div>

            {/* Details */}
            <div className="post-body">
              <div className="post-meta">
                <span className={BADGE[post.status]}>{post.status}</span>
                {post.pageName && <span className="post-page">{post.pageName}</span>}
                {paths.length > 1 && (
                  <span style={{ fontSize: 11, color: 'var(--text-light)' }}>+{paths.length - 1} more</span>
                )}
              </div>
              <p className="post-caption">{post.caption}</p>
              <p className="post-time">{formatDateTime(post.scheduledTime)}</p>
              {post.status === 'failed' && post.errorMessage && (
                <p className="post-error">{post.errorMessage}</p>
              )}
            </div>

            {/* Delete */}
            {canDelete && (
              <button
                onClick={() => handleDelete(post.id)}
                disabled={deletingId === post.id}
                className="btn btn-danger-ghost"
                aria-label={`Delete post ${post.id}`}
              >
                {deletingId === post.id ? '…' : 'Delete'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
