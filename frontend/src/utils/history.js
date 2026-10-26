// Recent activity is kept in this browser only (titles and short summaries, never images).
const KEY = 'foodverse.history';
const LIMIT = 8;

export function getHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function addHistory(entry) {
  try {
    const next = [{ ...entry, at: Date.now() }, ...getHistory()].slice(0, LIMIT);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: history is optional */
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
