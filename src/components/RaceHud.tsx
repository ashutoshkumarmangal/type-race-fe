export function RaceHud({
  phase,
  elapsedMs,
  wpm,
  serverWpm,
  accuracy,
  progress,
  timeLimitMs,
}: {
  phase: string;
  elapsedMs: number;
  wpm: number;
  serverWpm: number;
  accuracy: number;
  progress: number;
  timeLimitMs: number;
}) {
  const seconds = elapsedMs / 1000;
  const limitSeconds = timeLimitMs / 1000;
  return (
    <div className="hud">
      <div className="hud-stat">
        <span className="hud-value">{wpm.toFixed(0)}</span>
        <span className="hud-label">wpm</span>
      </div>
      <div className="hud-stat">
        <span className="hud-value">{accuracy.toFixed(1)}%</span>
        <span className="hud-label">accuracy</span>
      </div>
      <div className="hud-stat">
        <span className="hud-value">{seconds.toFixed(2)}</span>
        <span className="hud-label">
          seconds{limitSeconds > 0 ? ` / ${limitSeconds.toFixed(0)}` : ''}
        </span>
      </div>
      <div className="hud-stat">
        <span className="hud-value">{(progress * 100).toFixed(0)}%</span>
        <span className="hud-label">
          {phase === 'RACING' ? 'in the race' : phase.toLowerCase()}
        </span>
      </div>
      {serverWpm > 0 && serverWpm !== wpm && (
        <div className="hud-stat hud-server">
          <span className="hud-value">{serverWpm.toFixed(0)}</span>
          <span className="hud-label">server wpm</span>
        </div>
      )}
    </div>
  );
}