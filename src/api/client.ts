/**
 * The one place the app talks to the backend.
 *
 * <p>Two behaviours live here rather than at each call site: the bearer header, and recovering from
 * an expired access token exactly once per request. Every 401 triggers a refresh and one retry, so a
 * fifteen-minute-old tab keeps working without ever storing an access token.
 */

import { accessTokenExpired, getAccessToken, refreshSession } from './session';
import { apiUrl } from '../config';

export interface ApiErrorBody {
  code: string;
  message: string;
}

/** Error carrying the server's own `code`/`message`, so the UI can show something meaningful. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  // The backend always answers errors with {code, message}, but a proxy or a crash can produce an
  // HTML page, so parsing must not be allowed to throw its own error.
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    return new ApiError(
      response.status,
      body?.code ?? `http_${response.status}`,
      body?.message ?? `request failed (${response.status})`,
    );
  } catch {
    return new ApiError(response.status, `http_${response.status}`, `request failed (${response.status})`);
  }
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(apiUrl(path), { ...init, headers });
}

/** GETs JSON, refreshing once if the access token has expired. */
export async function apiGet<T>(path: string): Promise<T> {
  if (accessTokenExpired()) {
    await refreshSession();
  }
  let response = await send(path, { method: 'GET' });
  if (response.status === 401) {
    await refreshSession();
    response = await send(path, { method: 'GET' });
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as T;
}

/** POSTs JSON without auth. Used for the unauthenticated auth endpoints. */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}