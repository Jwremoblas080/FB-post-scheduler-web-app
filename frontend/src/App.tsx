import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import AuthCallback from './components/auth/AuthCallback';
import LoginButton from './components/auth/LoginButton';
import PostForm from './components/posts/PostForm';
import PostList from './components/posts/PostList';
import ErrorMessage from './components/common/ErrorMessage';
import Toast from './components/common/Toast';

interface ToastState {
  type: 'success' | 'error';
  message: string;
  detail?: string;
}

function HomePage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isConnected, setIsConnected] = useState(localStorage.getItem('fb_connected') === 'true');

  // Keep connected state in sync with localStorage (e.g. after OAuth redirect)
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-logo">F</div>
        <span className="app-header-title">Post Scheduler</span>
        {isConnected && (
          <span style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: '#2e7d32',
            background: '#e8f5e9',
            borderRadius: 20,
            padding: '4px 12px',
            fontWeight: 500,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#43a047', display: 'inline-block' }} />
            Connected to Facebook
          </span>
        )}
      </header>

      <main className="app-main">
        {/* Login */}
        <div className="card">
          <p className="section-label">Account</p>
          <div className="login-section">
            <LoginButton onError={setLoginError} />
            {loginError && (
              <ErrorMessage error={loginError} onDismiss={() => setLoginError(null)} />
            )}
          </div>
        </div>

        {/* Create post */}
        <div className="card">
          <p className="section-label">New Post</p>
          <PostForm
            onSuccess={() => {
              setRefreshKey((k: number) => k + 1);
              showToast('success', 'Post scheduled!', 'Your post has been added to the queue.');
            }}
            onError={(msg) => showToast('error', 'Failed to schedule post', msg)}
          />
        </div>

        {/* Post list */}
        <div className="card">
          <p className="section-label">Scheduled</p>
          <PostList refreshKey={refreshKey} />
        </div>
      </main>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          detail={toast.detail}
          onDismiss={() => setToast(null)}
        />
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
