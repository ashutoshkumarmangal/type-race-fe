import { useRef } from 'react';
import { useAppSelector } from '../store';
import { gameActions } from '../socket/bridge';

export function RoomPanel() {
  const room = useAppSelector((s) => s.game.room);
  const me = useAppSelector((s) => s.game.me);
  const queue = useAppSelector((s) => s.game.queue);
  const codeRef = useRef<HTMLInputElement>(null);

  const createRoom = async () => {
    try {
      const response = await fetch('/api/rooms/new');
      const data = (await response.json()) as { roomCode: string };
      gameActions.joinRoom(data.roomCode);
    } catch {
      gameActions.joinRoom(randomCode());
    }
  };

  if (!room) {
    return (
      <div className="panel">
        <h3 className="panel-title">Room</h3>
        {queue ? (
          <div className="queue-box">
            <div className="spinner" />
            <p>Looking for an opponent…</p>
            <p className="hint">
              {queue.queued} in queue, need {queue.needed}. Open a second browser window to race yourself.
            </p>
            <button className="btn ghost" onClick={() => gameActions.quickMatch()} disabled>
              searching
            </button>
          </div>
        ) : (
          <>
            <p className="hint">
              No room yet. Quick match pairs you with the next waiting player, or create a room and share the
              code.
            </p>
            <div className="panel-actions">
              <button className="btn btn-primary" onClick={() => gameActions.quickMatch()}>
                Quick match
              </button>
              <button className="btn" onClick={createRoom}>
                Create room
              </button>
            </div>
            <div className="panel-actions">
              <input
                ref={codeRef}
                className="code-input"
                placeholder="CODE"
                maxLength={5}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') gameActions.joinRoom(codeRef.current?.value ?? '');
                }}
              />
              <button className="btn" onClick={() => gameActions.joinRoom(codeRef.current?.value ?? '')}>
                Join
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  const players = room.players;
  return (
    <div className="panel">
      <h3 className="panel-title">
        Room <span className="code-inline">{room.roomCode}</span>
      </h3>
      <ul className="player-list">
        {players.map((player) => (
          <li key={player.id} className={`${player.id === me?.playerId ? 'me' : ''} ${player.connected ? '' : 'gone'}`}>
            <span className="dot" style={{ background: player.avatarColor }} />
            <span className="name">
              {player.nickname}
              {player.host && <span className="you-tag">host</span>}
              {player.spectator && <span className="you-tag">spectator</span>}
            </span>
            <span className={`state ${player.ready ? 'ready' : ''}`}>
              {!player.connected ? 'left' : player.finished ? 'done' : player.ready ? 'ready' : 'typing…'}
            </span>
          </li>
        ))}
      </ul>
      <p className="hint">
        {room.quickMatch
          ? 'Quick match room — the next race starts automatically.'
          : `Share the code so friends can join. ${room.minPlayers}–${room.maxPlayers} racers.`}
      </p>
      <div className="panel-actions">
        <button className="btn" onClick={createRoom}>
          New room
        </button>
      </div>
    </div>
  );
}

function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}