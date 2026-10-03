import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { loadLeaderboard } from '../store/profileSlice';

export function LeaderboardPanel() {
  const dispatch = useAppDispatch();
  const { leaderboard, loading } = useAppSelector((s) => s.profile);
  const me = useAppSelector((s) => s.game.me);

  useEffect(() => {
    dispatch(loadLeaderboard());
  }, [dispatch]);

  return (
    <div className="panel">
      <h3 className="panel-title">Global leaderboard</h3>
      {loading && leaderboard.length === 0 && <p className="hint">Loading…</p>}
      {!loading && leaderboard.length === 0 && (
        <p className="hint">No races recorded yet. Be the first to finish one.</p>
      )}
      <table className="board">
        <thead>
          <tr>
            <th>#</th>
            <th>Racer</th>
            <th>Best</th>
            <th>Avg</th>
            <th>Wins</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((row) => (
            <tr key={row.nickname} className={row.nickname === me?.nickname ? 'me' : ''}>
              <td>{row.rank}</td>
              <td>{row.nickname}</td>
              <td>{row.bestWpm.toFixed(1)}</td>
              <td>{row.avgWpm.toFixed(1)}</td>
              <td>{row.wins}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}