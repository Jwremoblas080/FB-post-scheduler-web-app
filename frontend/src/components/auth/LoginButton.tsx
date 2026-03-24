import { useState } from 'react';
import apiClient from '../../api/client';

interface LoginButtonProps {
  onError?: (message: string) => void;
}

function LoginButton({ onError }: LoginButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await apiClient.post<{ redirectUrl: string }>('/auth/login');
      window.location.href = response.data.redirectUrl;
    } catch (err: unknown) {
      setLoading(false);
      const message =
        err instanceof Error ? err.message : 'Failed to initiate login. Please try again.';
      onError?.(message);
    }
  };

  return (
    <button
      onClick={handleLogin}
      disabled={loading}
      className="btn btn-primary"
    >
      {loading ? (
        <>
          <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
          Redirecting…
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
          </svg>
          Connect with Facebook
        </>
      )}
    </button>
  );
}

export default LoginButton;
