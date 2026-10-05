import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { errorDismissed } from '../store/gameSlice';
import { loadProfile } from '../store/profileSlice';

export function StatsPanel() {
  const dispatch = useAppDispatch();
  const me = useAppSelector((s) => s.game.me);
  const { stats, history, error } = useAppSelector((s) => s.profile);

  useEffect(() => {
    // No nickname to pass: the server scopes this to the bearer token's account.
    dispatch(loadProfile());
  }, [dispatch]);

  if (!me) {
    return null;
  }

  return (
    <div className="panel">
      <h3 className="panel-title">
        {me.nickname}
        <span className="dot inline" style={{ background: me.avatarColor }} />
      </h3>
      {error && <p className="hint">{error}</p>}
      {!stats && !error && <p className="hint">No stats yet — finish a race.</p>}
      {stats && (
        <>
          <div className="stat-grid">
            <Stat label="Races" value={String(stats.racesPlayed)} />
            <Stat label="Wins" value={String(stats.wins)} />
            <Stat label="Podiums" value={String(stats.podiums)} />
            <Stat label="Best WPM" value={stats.bestWpm.toFixed(1)} />
            <Stat label="Avg WPM" value={stats.avgWpm.toFixed(1)} />
            <Stat label="Best accuracy" value={`${stats.bestAccuracy.toFixed(1)}%`} />
            <Stat label="Best place" value={stats.bestPlace ? `#${stats.bestPlace}` : '—'} />
            <Stat label="Characters" value={stats.totalCharsTyped.toLocaleString()} />
          </div>

          <h4 className="panel-sub">Recent races</h4>
          {history.length === 0 ? (
            <p className="hint">No finished races yet.</p>
          ) : (
            <table className="board">
              <thead>
                <tr>
                  <th>Race</th>
                  <th>Place</th>
                  <th>WPM</th>
                  <th>Acc</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.raceId}>
                    <td>{row.raceId}</td>
                    <td>{row.finished ? `#${row.place}` : 'DNF'}</td>
                    <td>{row.wpm.toFixed(1)}</td>
                    <td>{row.accuracy.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export function Toasts() {
  const dispatch = useAppDispatch();
  const error = useAppSelector((s) => s.game.error);

  useEffect(() => {
    if (!error) {
      return;
    }
    const timer = window.setTimeout(() => dispatch(errorDismissed()), 4200);
    return () => window.clearTimeout(timer);
  }, [dispatch, error]);

  if (!error) {
    return null;
  }
  return (
    <div className="toast-wrap">
      <div className="toast">
        <strong>{error.code.replace(/_/g, ' ')}</strong>
        <span>{error.message}</span>
        <button className="btn ghost tiny" onClick={() => dispatch(errorDismissed())}>
          close
        </button>
      </div>
    </div>
  );
}