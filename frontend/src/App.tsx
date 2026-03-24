import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import AuthCallback from './components/auth/AuthCallback';
import LoginButton from './components/auth/LoginButton';
import PostForm from './components/posts/PostForm';
import PostList from './components/posts/PostList';
import ErrorMessage from './components/common/ErrorMessage';
import Toast from './components/common/Toast';
import apiClient from './api/client';

interface ToastState { type: 'success' | 'error'; message: string; detail?: string; }

function HomePage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isConnected, setIsConnected] = useState(localStorage.getItem('fb_connected') === 'true');
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    function syncConnected() {
      setIsConnected(localStorage.getItem('fb_connected') === 'true');
    }
    window.addEventListener('storage', syncConnected);
    window.addEventListener('focus', syncConnected);
    return () => {
      window.removeEventListener('storage', syncConnected);
      window.removeEventListener('focus', syncConnected);
    };
  }, []);

  function showToast(type: 'success' | 'error', message: string, detail?: string) {
    setToast({ type, message, detail });
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await apiClient.delete('/auth/disconnect');
    } catch { /* best-effort */ } finally {
      localStorage.removeItem('fb_connected');
      setIsConnected(false);
      setDisconnecting(false);
      showToast('success', 'Disconnected', 'You can now connect a different Facebook account.');
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-logo">F</div>
        <span className="app-header-title">Post Scheduler</span>
        {isConnected && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="connected-badge">
              <span className="connected-dot" />
              Connected to Facebook
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        )}
      </header>

      <main className="app-main">
        {/* Account */}
        <div className="card">
          <p className="section-label">Account</p>
          <div className="login-section">
            <LoginButton
              onError={setLoginError}
            />
            {loginError && <ErrorMessage error={loginError} onDismiss={() => setLoginError(null)} />}
          </div>
        </div>

        {/* Create post — only shown when connected */}
        {isConnected ? (
          <div className="card">
            <p className="section-label">New Post</p>
            <PostForm
              onSuccess={() => {
                setRefreshKey(k => k + 1);
                showToast('success', 'Post scheduled!', 'Your post has been added to the queue.');
              }}
              onError={(msg) => showToast('error', 'Failed to schedule post', msg)}
            />
          </div>
        ) : (
          <div className="card">
            <p className="section-label">New Post</p>
            <div className="not-connected-state">
              <span className="not-connected-icon">🔒</span>
              <p>Connect your Facebook account to schedule posts.</p>
            </div>
          </div>
        )}

        {/* Post list — only shown when connected */}
        {isConnected && (
          <div className="card">
            <p className="section-label">Scheduled</p>
            <PostList refreshKey={refreshKey} />
          </div>
        )}
      </main>

      {toast && (
        <Toast type={toast.type} message={toast.message} detail={toast.detail} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
    </Routes>
  );
}

export default App;
