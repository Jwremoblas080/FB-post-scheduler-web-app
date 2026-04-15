import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type CallbackState = 'loading' | 'success' | 'error';

function AuthCallback() {
  const [state, setState] = useState<CallbackState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    const token = params.get('token');

    if (error) {
      const message = errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
        : 'Authentication was denied or failed. Please try again.';
      setErrorMessage(message);
      setState('error');
      return;
    }

    // Store the JWT token if present
    if (token) {
      localStorage.setItem('auth_token', token);
    }

    setState('success');
    localStorage.setItem('fb_connected', 'true');
    
    // Use React Router navigation instead of window.location
    const timer = setTimeout(() => { 
      navigate('/', { replace: true });
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        {state === 'loading' && (
          <>
            <div className="auth-spinner" />
            <h2>Connecting…</h2>
            <p>Completing authentication with Facebook.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✓</div>
            <h2 style={{ color: 'var(--success-text)' }}>Connected</h2>
            <p>Authentication successful. Redirecting you now…</p>
          </>
        )}

        {state === 'error' && (
          <>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✕</div>
            <h2 style={{ color: 'var(--danger)' }}>Authentication Failed</h2>
            <p>{errorMessage}</p>
            <a href="/" className="btn btn-ghost" style={{ display: 'inline-flex' }}>
              Back to Home
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default AuthCallback;
