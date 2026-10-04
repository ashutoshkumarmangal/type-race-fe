/**
 * Where the backend lives.
 *
 * In local dev Vite proxies /api and /ws to localhost:8081, so everything is relative and these
 * values are empty. Once the app is deployed separately from the API (e.g. a static site in front of
 * a Render web service) the browser needs the real origin, so set VITE_API_BASE / VITE_WS_URL at
 * BUILD time — they are baked into the bundle, not read at runtime.
 */
const configuredBase = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '');

export const apiBase = configuredBase ?? '';

/** Builds an absolute API URL when a backend origin is configured, else a same-origin path. */
export function apiUrl(path: string): string {
  return `${apiBase}${path}`;
}

/** WebSocket URL for the game socket; falls back to the page origin (dev proxy / single-service). */
export function gameSocketUrl(): string {
  const configured = import.meta.env.VITE_WS_URL as string | undefined;
  if (configured) {
    return configured;
  }
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${location.host}/ws/game`;
}