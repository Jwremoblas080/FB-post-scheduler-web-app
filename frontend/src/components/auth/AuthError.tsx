interface AuthErrorProps {
  message: string;
}

function AuthError({ message }: AuthErrorProps) {
  if (!message) return null;
  return (
    <div role="alert" className="alert alert-error">
      {message}
    </div>
  );
}

export default AuthError;
