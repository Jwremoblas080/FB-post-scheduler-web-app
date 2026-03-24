import { useEffect } from 'react';

interface ToastProps {
  type: 'success' | 'error';
  message: string;
  detail?: string;
  onDismiss: () => void;
}

export default function Toast({ type, message, detail, onDismiss }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const isSuccess = type === 'success';

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9999,
      minWidth: 280,
      maxWidth: 380,
      background: isSuccess ? '#e8f5e9' : '#fdecea',
      border: `1px solid ${isSuccess ? '#a5d6a7' : '#f5c6cb'}`,
      borderLeft: `4px solid ${isSuccess ? '#43a047' : '#e53935'}`,
      borderRadius: 8,
      padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>{isSuccess ? '✓' : '✕'}</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: isSuccess ? '#2e7d32' : '#c62828' }}>
          {message}
        </p>
        {detail && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: isSuccess ? '#388e3c' : '#d32f2f' }}>
            {detail}
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#999', padding: 0, lineHeight: 1 }}
        aria-label="Dismiss"
      >×</button>
    </div>
  );
}
