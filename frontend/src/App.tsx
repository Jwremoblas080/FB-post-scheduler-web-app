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

function getInitialTheme(): 'light' | 'dark' | 'system' {
  return (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system';
}

function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

function HomePage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isConnected, setIsConnected] = useState(localStorage.getItem('fb_connected') === 'true');
  const [disconnecting, setDisconnecting] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

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

  function cycleTheme() {
    setTheme(t => t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system');
  }

  const themeIcon = theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '💻';
  const themeTitle = `Theme: ${theme} (click to cycle)`;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-logo">F</div>
        <span className="app-header-title">Post Scheduler</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="theme-toggle" onClick={cycleTheme} title={themeTitle} aria-label={themeTitle}>
            {themeIcon}
          </button>
          {isConnected && (
            <>
              <span className="connected-badge">
                <span className="connected-dot" />
                <span className="connected-badge-text">Connected to Facebook</span>
              </span>
              <button className="btn btn-ghost btn-sm" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? '…' : 'Disconnect'}
              </button>
            </>
          )}
        </div>
      </header>

      <main className="app-main">
        <div className="card">
          <p className="section-label">Account</p>
          <div className="login-section">
            <LoginButton onError={setLoginError} />
            {loginError && <ErrorMessage error={loginError} onDismiss={() => setLoginError(null)} />}
          </div>
        </div>

        {isConnected ? (
          <div className="card" id="new-post-card">
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
