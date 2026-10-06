import { useAppSelector } from '../store';
import { gameActions } from '../socket/bridge';

export function ResultsOverlay() {
  const results = useAppSelector((s) => s.game.results);
  const rematchVote = useAppSelector((s) => s.game.rematchVote);
  const me = useAppSelector((s) => s.game.me);
  const stats = useAppSelector((s) => s.profile.stats);
  const room = useAppSelector((s) => s.game.room);

  if (!results) {
    return null;
  }
  const standings = results.standings
    .slice()
    .sort((a, b) => (a.place || 99) - (b.place || 99) || b.wpm - a.wpm || b.accuracy - a.accuracy);
  const mine = standings.find((s) => s.id === me?.playerId);
  const youWon = mine?.place === 1 && !mine.dnf;
  // A solo run still gets full scoring, but calling it a win over nobody reads oddly.
  const solo = standings.filter((s) => !s.dnf).length <= 1;
  const personalBest = stats && mine ? mine.wpm >= stats.bestWpm && !mine.dnf : false;

  return (
    <div className="results-backdrop">
      <div className="results">
        <header className="results-head">
          <div>
            <p className="eyebrow">race {results.raceId}</p>
            <h2>
              {mine?.dnf ? 'Race over' : solo ? 'Race complete' : youWon ? 'You won the race' : 'Race complete'}
            </h2>
          </div>
          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => gameActions.requestRematch()}>
              {rematchVote ? 'Waiting for rivals…' : 'Race again'}
            </button>
            {rematchVote && (
              <button className="btn ghost" onClick={() => gameActions.cancelRematch()}>
                Cancel
              </button>
            )}
            <button className="btn ghost" onClick={() => gameActions.leaveRoom()}>
              Back to home
            </button>
          </div>
        </header>

        {mine && (
          <div className="result-cards">
            <ResultCard label="Place" value={mine.dnf ? 'DNF' : `#${mine.place}`} highlight={youWon && !solo} />
            <ResultCard label="Speed" value={`${mine.wpm.toFixed(1)} wpm`} highlight={youWon} />
            <ResultCard label="Accuracy" value={`${mine.accuracy.toFixed(1)}%`} />
            <ResultCard
              label="Time"
              value={mine.dnf ? '—' : `${(mine.durationMs / 1000).toFixed(2)}s`}
            />
            <ResultCard label="Errors" value={String(mine.errors)} />
            {personalBest && <ResultCard label="Personal best" value="new PB" highlight />}
          </div>
        )}

        <table className="standings">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>WPM</th>
              <th>Accuracy</th>
              <th>Errors</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr
                key={row.id}
                className={`${row.id === me?.playerId ? 'me' : ''} ${row.bestInRoom ? 'best' : ''}`}
              >
                <td>{row.dnf ? '—' : row.place}</td>
                <td>
                  <span className="dot" style={{ background: row.avatarColor }} />
                  {row.nickname}
                  {row.bestInRoom ? <span className="you-tag">fastest</span> : null}
                  {row.flagged ? <span className="flag-tag">flagged</span> : null}
                </td>
                <td>{row.wpm.toFixed(1)}</td>
                <td>{row.accuracy.toFixed(1)}%</td>
                <td>{row.errors}</td>
                <td>{row.dnf ? 'DNF' : `${(row.durationMs / 1000).toFixed(2)}s`}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {mine?.flagged && (
          <p className="flag-note">
            Your run was flagged: the server clamped your progress because it arrived faster than any human
            could type it. The score is not counted towards your stats.
          </p>
        )}

        {room && (
          <p className="hint center">
            Everyone must pick “race again” to start the next race.
          </p>
        )}
      </div>
    </div>
  );
}

export function ResultCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`result-card ${highlight ? 'highlight' : ''}`}>
      <span className="result-value">{value}</span>
      <span className="result-label">{label}</span>
    </div>
  );
}