import { useState } from 'react';
import { useAppSelector } from '../store';
import { gameActions } from '../socket/bridge';

export function TopBar({
  tab,
  onTabChange,
  onSignOut,
}: {
  tab: 'race' | 'leaderboard' | 'stats';
  onTabChange: (tab: 'race' | 'leaderboard' | 'stats') => void;
  onSignOut: () => void;
}) {
  const game = useAppSelector((s) => s.game);
  const account = useAppSelector((s) => s.auth.account);
  const queue = game.queue;
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    if (!game.room) return;
    try {
      await navigator.clipboard.writeText(game.room.roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo small">
          Type<span>Rush</span>
        </span>
        <span className={`conn conn-${game.connection}`}>{game.connection}</span>
      </div>

      <nav className="tabs">
        <button
          className={tab === 'race' ? 'tab active' : 'tab'}
          onClick={() => onTabChange('race')}
        >
          Race
        </button>
        <button
          className={tab === 'leaderboard' ? 'tab active' : 'tab'}
          onClick={() => onTabChange('leaderboard')}
        >
          Leaderboard
        </button>
        <button className={tab === 'stats' ? 'tab active' : 'tab'} onClick={() => onTabChange('stats')}>
          My stats
        </button>
      </nav>

      <div className="topbar-right">
        {game.room ? (
          <>
            <button className="code-chip" onClick={copyCode} title="Copy room code">
              {copied ? 'copied' : game.room.roomCode}
            </button>
            <button className="btn ghost" onClick={() => gameActions.leaveRoom()}>
              Leave
            </button>
          </>
        ) : queue ? (
          <span className="queue-chip">
            searching… {queue.queued}/{queue.needed}
          </span>
        ) : null}
        {account && (
          <button className="btn ghost" onClick={onSignOut} title={`Signed in as ${account.username}`}>
            {account.nickname} · sign out
          </button>
        )}
      </div>
    </header>
  );
}