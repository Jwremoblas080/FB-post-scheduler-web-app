interface ApiError {
  response?: { status?: number; data?: { error?: string } };
  message?: string;
}

interface ErrorMessageProps {
  error?: string | Error | ApiError | null;
  onDismiss?: () => void;
}

const HTTP_STATUS_MESSAGES: Record<number, string> = {
  400: 'Invalid request. Please check your input.',
  401: 'You are not authenticated. Please log in again.',
  403: "You don't have permission to perform this action.",
  404: 'The requested resource was not found.',
  413: 'File is too large. Please use a smaller file.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Server error. Please try again later.',
};

function getErrorMessage(error: string | Error | ApiError): string {
  if (typeof error === 'string') return error;
  const apiError = error as ApiError;
  const apiMessage = apiError.response?.data?.error;
  if (apiMessage) return apiMessage.replace(/Graph API/gi, 'Facebook API');
  const status = apiError.response?.status;
  if (status && HTTP_STATUS_MESSAGES[status]) return HTTP_STATUS_MESSAGES[status];
  if (error instanceof Error && error.message) return error.message;
  return 'An unexpected error occurred. Please try again.';
}

function ErrorMessage({ error, onDismiss }: ErrorMessageProps) {
  if (!error) return null;
  const message = getErrorMessage(error as string | Error | ApiError);

  return (
    <div role="alert" className="alert alert-error">
      <span>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className="alert-dismiss">×</button>
      )}
    </div>
  );
}

export default ErrorMessage;
