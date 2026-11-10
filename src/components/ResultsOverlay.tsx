import { useMemo } from 'react';
import { useAppSelector } from '../store';
import { gameActions } from '../socket/bridge';

export function ResultsOverlay() {
  const results = useAppSelector((s) => s.game.results);
  const personal = useAppSelector((s) => s.game.personalFinish);
  const finishFeed = useAppSelector((s) => s.game.finishFeed);
  const live = useAppSelector((s) => s.game.live);
  const rematchVote = useAppSelector((s) => s.game.rematchVote);
  const me = useAppSelector((s) => s.game.me);
  const stats = useAppSelector((s) => s.profile.stats);
  const room = useAppSelector((s) => s.game.room);
  const typing = useAppSelector((s) => s.typing);

  // If this user has not finished and the official race is not over, do not show overlay.
  // This allows late racers to keep typing without interruption!
  const myFinish = personal ?? finishFeed.find((f) => f.id === me?.playerId);
  const hasFinished = Boolean(results || myFinish || typing.submitted);

  if (!hasFinished) {
    return null;
  }

  // Build standings: official if race is closed, or live if still in progress
  const standings = useMemo(() => {
    if (results) {
      return results.standings
        .slice()
        .sort((a, b) => (a.place || 99) - (b.place || 99) || b.wpm - a.wpm || b.accuracy - a.accuracy)
        .map((s) => ({
          ...s,
          finished: !s.dnf,
          progress: s.dnf ? 0 : 1,
        }));
    }

    const livePlayers = live?.players ?? [];
    return livePlayers
      .map((p) => {
        const feedItem = finishFeed.find((f) => f.id === p.id);
        const isMe = p.id === me?.playerId || p.you;
        const isFinished = p.finished || (isMe && (personal !== null || typing.submitted));
        const finishedBeforeCount = livePlayers.filter(
          (other) => other.id !== p.id && (other.finished || finishFeed.some((f) => f.id === other.id))
        ).length;
        const fallbackPlace = isFinished ? finishedBeforeCount + 1 : 0;
        const place = p.place > 0 ? p.place : isMe && personal ? personal.place : feedItem?.place ?? fallbackPlace;
        const wpm = isMe && personal ? personal.wpm : feedItem?.wpm ?? p.wpm;
        const accuracy = isMe && personal ? personal.accuracy : feedItem?.accuracy ?? p.accuracy;
        const durationMs = isMe && personal ? personal.durationMs : feedItem?.durationMs ?? 0;

        return {
          id: p.id,
          nickname: p.nickname,
          avatarColor: p.avatarColor,
          place,
          dnf: false,
          wpm,
          accuracy,
          correctChars: p.correctChars,
          errors: p.errors,
          durationMs,
          progress: p.progress,
          finished: isFinished,
          bestInRoom: false,
          flagged: false,
        };
      })
      .sort((a, b) => {
        if (a.finished && !b.finished) return -1;
        if (!a.finished && b.finished) return 1;
        if (a.finished && b.finished) return (a.place || 99) - (b.place || 99) || b.wpm - a.wpm;
        return b.progress - a.progress;
      });
  }, [results, live, finishFeed, me, personal, typing.submitted]);

  const mine =
    standings.find((s) => s.id === me?.playerId) ??
    (personal
      ? {
          id: me?.playerId ?? '',
          nickname: me?.nickname ?? 'You',
          avatarColor: me?.avatarColor ?? 'var(--accent)',
          place: personal.place,
          dnf: false,
          wpm: personal.wpm,
          accuracy: personal.accuracy,
          correctChars: typing.correctChars,
          errors: typing.errors,
          durationMs: personal.durationMs,
          finished: true,
          bestInRoom: false,
          flagged: false,
          progress: 1,
        }
      : null);

  const youWon = mine?.place === 1 && !mine.dnf;
  const stillRacingCount = standings.filter((s) => !s.finished && !s.dnf).length;
  const isAllFinished = Boolean(results || (standings.length > 0 && stillRacingCount === 0));
  const solo = standings.length <= 1;
  const personalBest = stats && mine ? mine.wpm >= stats.bestWpm && !mine.dnf : false;

  const placeSuffix =
    mine?.place === 1 ? 'st' : mine?.place === 2 ? 'nd' : mine?.place === 3 ? 'rd' : 'th';

  return (
    <div className="results-backdrop">
      <div className="results">
        <header className="results-head">
          <div>
            <p className="eyebrow">{results ? `race ${results.raceId}` : 'live race standings'}</p>
            <h2>
              {mine?.dnf
                ? 'Race over'
                : youWon && !solo
                ? '🏆 1st Place! You won!'
                : mine?.place
                ? `🏁 You finished #${mine.place}${placeSuffix}`
                : 'Race complete'}
            </h2>
          </div>
          <div className="results-actions">
            <button
              className="btn btn-primary"
              onClick={() => gameActions.requestRematch()}
              disabled={rematchVote || !isAllFinished}
            >
              {rematchVote ? 'Waiting for rivals…' : !isAllFinished ? 'Waiting for rivals to finish…' : 'Race again'}
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

        {stillRacingCount > 0 && (
          <div className="waiting-banner">
            <span className="pulse-dot" />
            <span>
              Waiting for {stillRacingCount} other racer{stillRacingCount > 1 ? 's' : ''} to cross the finish line…
            </span>
          </div>
        )}

        {mine && (
          <div className="result-cards">
            <ResultCard
              label="Place"
              value={mine.dnf ? 'DNF' : `#${mine.place}`}
              highlight={youWon && !solo}
            />
            <ResultCard label="Speed" value={`${mine.wpm.toFixed(1)} wpm`} highlight={youWon} />
            <ResultCard label="Accuracy" value={`${mine.accuracy.toFixed(1)}%`} />
            <ResultCard
              label="Time"
              value={mine.dnf || mine.durationMs === 0 ? '—' : `${(mine.durationMs / 1000).toFixed(2)}s`}
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
              <th>Status</th>
              <th>WPM</th>
              <th>Accuracy</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr
                key={row.id}
                className={`${row.id === me?.playerId ? 'me' : ''} ${row.bestInRoom ? 'best' : ''}`}
              >
                <td>{row.dnf ? '—' : row.place > 0 ? `#${row.place}` : '—'}</td>
                <td>
                  <span className="dot" style={{ background: row.avatarColor }} />
                  {row.nickname}
                  {row.id === me?.playerId ? <span className="you-tag">you</span> : null}
                  {row.bestInRoom ? <span className="you-tag">fastest</span> : null}
                  {row.flagged ? <span className="flag-tag">flagged</span> : null}
                </td>
                <td>
                  {row.finished ? (
                    <span className="status-tag tag-finished">Finished</span>
                  ) : (
                    <span className="status-tag tag-racing">
                      <span className="mini-pbar">
                        <span
                          className="mini-pbar-fill"
                          style={{ width: `${Math.round((row.progress ?? 0) * 100)}%` }}
                        />
                      </span>
                      {Math.round((row.progress ?? 0) * 100)}%
                    </span>
                  )}
                </td>
                <td>{row.wpm.toFixed(1)}</td>
                <td>{row.accuracy.toFixed(1)}%</td>
                <td>
                  {row.finished
                    ? row.durationMs > 0
                      ? `${(row.durationMs / 1000).toFixed(2)}s`
                      : 'Done'
                    : 'Typing…'}
                </td>
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

        {room && isAllFinished && (
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
