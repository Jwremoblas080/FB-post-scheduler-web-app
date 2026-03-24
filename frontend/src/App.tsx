import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import AuthCallback from './components/auth/AuthCallback';
import LoginButton from './components/auth/LoginButton';
import PostForm from './components/posts/PostForm';
import PostList from './components/posts/PostList';
import ErrorMessage from './components/common/ErrorMessage';

function HomePage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [loginError, setLoginError] = useState<string | null>(null);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-logo">F</div>
        <span className="app-header-title">Post Scheduler</span>
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
          <PostForm onSuccess={() => setRefreshKey((k: number) => k + 1)} />
        </div>

        {/* Post list */}
        <div className="card">
          <p className="section-label">Scheduled</p>
          <PostList refreshKey={refreshKey} />
        </div>
      </main>
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
