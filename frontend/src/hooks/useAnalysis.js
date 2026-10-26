import { useCallback, useRef, useState } from 'react';

// Tracks one async request: idle -> loading -> success | error.
export default function useAnalysis() {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const inFlight = useRef(false);

  const run = useCallback(async (task) => {
    if (inFlight.current) return null; // ignore double clicks / repeated Enter
    inFlight.current = true;
    setState({ status: 'loading', data: null, error: null });
    try {
      const data = await task();
      setState({ status: 'success', data, error: null });
      return data;
    } catch (err) {
      setState({ status: 'error', data: null, error: err.message || 'Something went wrong.' });
      return null;
    } finally {
      inFlight.current = false;
    }
  }, []);

  const reset = useCallback(() => setState({ status: 'idle', data: null, error: null }), []);

  return { ...state, loading: state.status === 'loading', run, reset };
}
