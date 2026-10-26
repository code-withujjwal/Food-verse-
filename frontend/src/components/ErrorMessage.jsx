import { AlertTriangle } from 'lucide-react';

export default function ErrorMessage({ message, onRetry }) {
  return (
    <div className="notice notice-error" role="alert">
      <AlertTriangle size={20} aria-hidden="true" />
      <div>
        <strong>That didn’t work</strong>
        <p>{message}</p>
        {onRetry && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
