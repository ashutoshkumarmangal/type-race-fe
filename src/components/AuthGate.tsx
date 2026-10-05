import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { authErrorCleared, login, register } from '../store/authSlice';

/**
 * Sign-in and account creation.
 *
 * <p>Replaces the old free-text name gate: an account is now what identifies a racer, so the server
 * derives the display name from the credentials instead of trusting the page for one.
 */
export function AuthGate() {
  const dispatch = useAppDispatch();
  const { busy, error } = useAppSelector((s) => s.auth);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) {
      return;
    }
    const credentials = { username: username.trim(), password };
    dispatch(mode === 'login' ? login(credentials) : register(credentials));
  };

  const switchMode = () => {
    dispatch(authErrorCleared());
    setMode(mode === 'login' ? 'register' : 'login');
  };

  return (
    <div className="gate">
      <div className="gate-card">
        <p className="eyebrow">realtime typing races</p>
        <h1 className="logo">
          Type<span>Rush</span>
        </h1>
        <p className="gate-copy">
          Race another human at the same sentence. The server times the race, validates every claim of
          progress and broadcasts everyone's bar in real time.
        </p>

        <form onSubmit={submit}>
          <label className="field">
            <span>Username</span>
            <input
              value={username}
              maxLength={64}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="3–20 characters"
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              maxLength={72}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={mode === 'register' ? 'at least 8 characters' : ''}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error && (
            <p className="hint" role="alert">
              {error.message}
            </p>
          )}

          <div className="gate-actions">
            <button className="btn btn-primary big" type="submit" disabled={busy}>
              {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </div>
        </form>

        <div className="gate-alt">
          <button className="btn" type="button" onClick={switchMode}>
            {mode === 'login' ? 'Need an account? Register' : 'Already registered? Sign in'}
          </button>
        </div>

        <p className="hint center">
          {mode === 'register'
            ? 'Your username is also your racer name; results are tied to your account.'
            : 'Race history and stats are visible only to the signed-in account.'}
        </p>
      </div>
    </div>
  );
}