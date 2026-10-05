import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { apiGet, apiPost, ApiError } from '../api/client';
import {
  clearSession,
  getRefreshToken,
  onSessionChange,
  restoreSession,
  setSession,
  type AuthSession,
} from '../api/session';

export interface Account {
  id: number | null;
  username: string;
  nickname: string;
  role: string;
}

type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  account: Account | null;
  error: { code: string; message: string } | null;
  busy: boolean;
}

const initialState: AuthState = {
  // 'unknown' until the stored refresh token has had its chance; the UI waits rather than flashing
  // the sign-in form at somebody who is already signed in.
  status: 'unknown',
  account: null,
  error: null,
  busy: false,
};

/** Turns whatever a thunk threw into the server's own code so the form can explain itself. */
function asError(error: unknown): { code: string; message: string } {
  if (error instanceof ApiError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: 'network_error',
    message: error instanceof Error ? error.message : 'Could not reach the server.',
  };
}

interface Credentials {
  username: string;
  password: string;
}

export const register = createAsyncThunk('auth/register', async (body: Credentials) => {
  const session = await apiPost<AuthSession>('/api/auth/register', body);
  setSession(session);
  return session;
});

export const login = createAsyncThunk('auth/login', async (body: Credentials) => {
  const session = await apiPost<AuthSession>('/api/auth/login', body);
  setSession(session);
  return session;
});

export const restore = createAsyncThunk('auth/restore', async () => {
  const ok = await restoreSession();
  if (!ok) {
    return null;
  }
  return apiGet<Account>('/api/me');
});

export const signOut = createAsyncThunk('auth/signOut', async () => {
  const refreshToken = getRefreshToken();
  clearSession();
  // Best effort: the local session is already gone, so a failure here must not block the sign-out or
  // leave the button spinning.
  if (refreshToken) {
    try {
      await apiPost<void>('/api/auth/logout', { refreshToken });
    } catch {
      /* ignore */
    }
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authErrorCleared(state) {
      state.error = null;
    },
    /** A refresh failed or the socket was refused, so the session is gone. */
    sessionDropped(state) {
      state.status = 'anonymous';
      state.account = null;
    },
  },
  extraReducers: (builder) => {
    const pending = (state: AuthState) => {
      state.busy = true;
      state.error = null;
    };
    const failed = (state: AuthState, action: { error: unknown }) => {
      state.busy = false;
      state.status = 'anonymous';
      state.account = null;
      state.error = asError(action.error);
    };
    const authenticated = (state: AuthState, action: { payload: AuthSession }) => {
      state.busy = false;
      state.status = 'authenticated';
      state.error = null;
      state.account = {
        id: null,
        username: action.payload.username,
        nickname: action.payload.nickname,
        role: action.payload.role,
      };
    };

    builder
      .addCase(register.pending, pending)
      .addCase(register.fulfilled, authenticated)
      .addCase(register.rejected, failed)
      .addCase(login.pending, pending)
      .addCase(login.fulfilled, authenticated)
      .addCase(login.rejected, failed)
      .addCase(restore.pending, pending)
      .addCase(restore.fulfilled, (state, action) => {
        state.busy = false;
        if (!action.payload) {
          state.status = 'anonymous';
          return;
        }
        state.status = 'authenticated';
        state.account = action.payload;
      })
      .addCase(restore.rejected, failed)
      .addCase(signOut.fulfilled, (state) => {
        state.status = 'anonymous';
        state.account = null;
        state.error = null;
      });
  },
});

export const { authErrorCleared, sessionDropped } = authSlice.actions;
export default authSlice.reducer;

/**
 * Keeps Redux in step with the token store.
 *
 * <p>The token module is the source of truth because the WebSocket needs a token without going
 * through Redux. It clears itself when a refresh is rejected, and that has to propagate here or the
 * UI would keep showing a signed-in header for a session the server no longer accepts.
 */
export function bindSessionToStore(onDropped: () => void): () => void {
  return onSessionChange(() => {
    if (!getRefreshToken()) {
      onDropped();
    }
  });
}