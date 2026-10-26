import { Loader2 } from 'lucide-react';

export default function LoadingState({ message = 'Working on it…' }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <Loader2 className="spin" size={26} aria-hidden="true" />
      <p>{message}</p>
      <span className="muted small">Gemini can take 5–20 seconds to respond.</span>
    </div>
  );
}
