import { useAppSelector } from '../store';

/** Live ticker of what just happened in the room. */
export function FinishFeed() {
  const feed = useAppSelector((s) => s.game.finishFeed);
  const phase = useAppSelector((s) => s.game.room?.phase ?? 'LOBBY');

  if (feed.length === 0 && phase !== 'RACING') {
    return null;
  }

  return (
    <div className="panel">
      <h3 className="panel-title">Race feed</h3>
      <ul className="feed">
        {phase === 'RACING' && feed.length === 0 && <li className="hint">typing in progress…</li>}
        {feed.map((item) => (
          <li key={`${item.id}-${item.durationMs}`}>
            <span className="place">P{item.place}</span>
            <span className="name">{item.nickname}</span>
            <span className="meta">
              {item.wpm.toFixed(0)} wpm · {item.accuracy.toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}