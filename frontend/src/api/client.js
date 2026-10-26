// All backend calls live here so pages never build URLs or parse responses themselves.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

// Backend waits up to 60 s for Gemini (plus one retry), so allow a little longer here.
const TIMEOUT_MS = 100000;

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new ApiError('The request took too long. Please try again.', 'timeout');
    }
    throw new ApiError('Cannot reach the Food Verse AI server. Start the Flask backend and try again.', 'network_error');
  } finally {
    clearTimeout(timer);
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    /* non-JSON response */
  }
  if (!response.ok || !body?.success) {
    throw new ApiError(body?.error?.message || `The server returned an error (${response.status}).`, body?.error?.code);
  }
  return body;
}

function uploadImage(path, file) {
  const form = new FormData();
  form.append('image', file);
  return request(path, { method: 'POST', body: form }).then((body) => body.data);
}

function postJson(path, payload) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((body) => body.data);
}

export const getHealth = () => request('/api/health').then((body) => body.data);
export const analyzeFood = (file) => uploadImage('/api/food/analyze', file);
export const checkFreshness = (file) => uploadImage('/api/food/freshness', file);
export const analyzeKitchen = (file) => uploadImage('/api/kitchen/analyze', file);
export const generateRecipes = (payload) => postJson('/api/cooking/recipes', payload);
export const planMeals = (payload) => postJson('/api/meals/plan', payload);
