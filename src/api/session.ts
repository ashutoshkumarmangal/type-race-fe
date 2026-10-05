/**
 * Token custody for the browser.
 *
 * <p>The split follows what the backend is built to expect: the refresh token is long lived and
 * survives a reload, so it goes to `localStorage`; the access token is short lived and lives only in
 * a module variable. An XSS that steals the access token gains minutes, not weeks.
 *
 * <p>Refresh is single-flight on purpose. The backend rotates refresh tokens and treats a replayed
 * one as theft, revoking the entire family. Two in-flight calls to `/api/me/...` that each saw a
 * 401 would each try to refresh, and the loser would look exactly like an attacker, so every caller
 * awaits the same in-progress refresh instead.
 */

import { apiUrl } from '../config';

const REFRESH_KEY = 'typerush.refreshToken';
const REFRESH_SKEW_MS = 15_000;

export interface AuthSession {
  username: string;
  nickname: string;
  role: string;
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds, as reported by the server. */
  expiresIn: number;
}

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  username: string;
  nickname: string;
  role: string;
  /** Epoch ms at which the access token stops being usable. */
  accessExpiresAt: number;
}

/** Access token in memory only. Never written to storage. */
let accessToken: string | null = null;
let accessExpiresAt = 0;

let inFlightRefresh: Promise<StoredSession> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

/** Notified whenever the session changes or is dropped, so the store can mirror it. */
export function onSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function readStored(): StoredSession | null {
  const raw = localStorage.getItem(REFRESH_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed && typeof parsed.refreshToken === 'string' ? parsed : null;
  } catch {
    localStorage.removeItem(REFRESH_KEY);
    return null;
  }
}

function writeStored(session: StoredSession): void {
  localStorage.setItem(REFRESH_KEY, JSON.stringify(session));
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return readStored()?.refreshToken ?? null;
}

/** True when there is anything to restore a session from after a reload. */
export function hasStoredSession(): boolean {
  return readStored() !== null;
}

export function setSession(session: AuthSession): void {
  const stored: StoredSession = {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    username: session.username,
    nickname: session.nickname,
    role: session.role,
    accessExpiresAt: Date.now() + session.expiresIn * 1000,
  };
  accessToken = stored.accessToken;
  accessExpiresAt = stored.accessExpiresAt;
  writeStored(stored);
  emit();
}

export function clearSession(): void {
  accessToken = null;
  accessExpiresAt = 0;
  localStorage.removeItem(REFRESH_KEY);
  emit();
}

/** The identity details that outlive the access token, for rendering before a refresh lands. */
export function storedIdentity(): { username: string; nickname: string; role: string } | null {
  const stored = readStored();
  return stored ? { username: stored.username, nickname: stored.nickname, role: stored.role } : null;
}

/**
 * Whether the access token is missing or close enough to expiry to be worth replacing.
 *
 * <p>Checking early avoids sending a request that is almost certain to come back 401.
 */
export function accessTokenExpired(skewMs = REFRESH_SKEW_MS): boolean {
  if (!accessToken) {
    return true;
  }
  return Date.now() + skewMs >= accessExpiresAt;
}

/**
 * Trades the stored refresh token for a new pair.
 *
 * <p>Concurrent callers share one request. A failed refresh clears the session, because a refresh
 * token the server will not honour is not worth keeping.
 */
export async function refreshSession(): Promise<StoredSession> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('no refresh token');
  }

  inFlightRefresh = (async () => {
    const response = await fetch(apiUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      clearSession();
      throw new Error(`refresh failed: ${response.status}`);
    }
    const body = (await response.json()) as AuthSession;
    setSession(body);
    return {
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      username: body.username,
      nickname: body.nickname,
      role: body.role,
      accessExpiresAt: Date.now() + body.expiresIn * 1000,
    };
  })();

  try {
    return await inFlightRefresh;
  } finally {
    inFlightRefresh = null;
  }
}

/** Restores an access token from the stored refresh token. Returns false when there is none. */
export async function restoreSession(): Promise<boolean> {
  if (!hasStoredSession()) {
    return false;
  }
  try {
    await refreshSession();
    return true;
  } catch {
    return false;
  }
}