import { memo } from 'react';

export const PlayerProgress = memo(function PlayerProgress({
  nickname,
  color,
  progress,
  wpm,
  accuracy,
  finished,
  you,
}: {
  nickname: string;
  color: string;
  progress: number;
  wpm: number;
  accuracy: number;
  finished: boolean;
  you: boolean;
}) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <div className={`pbar ${you ? 'pbar-you' : ''} ${finished ? 'pbar-done' : ''}`}>
      <div className="pbar-head">
        <span className="pbar-name">
          <span className="dot" style={{ background: color }} />
          {nickname}
          {you ? <span className="you-tag">you</span> : null}
          {finished ? <span className="done-tag">finished</span> : null}
        </span>
        <span className="pbar-meta">
          <span>{wpm.toFixed(0)} wpm</span>
          <span>{accuracy.toFixed(0)}%</span>
        </span>
      </div>
      <div className="pbar-track">
        <div className="pbar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
});