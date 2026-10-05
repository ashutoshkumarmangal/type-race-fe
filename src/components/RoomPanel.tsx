import { useRef } from 'react';
import { useAppSelector } from '../store';
import { errorRaised } from '../store/gameSlice';
import { useAppDispatch } from '../store';
import { gameActions } from '../socket/bridge';
import { apiGet, ApiError } from '../api/client';

export function RoomPanel() {
  const dispatch = useAppDispatch();
  const room = useAppSelector((s) => s.game.room);
  const me = useAppSelector((s) => s.game.me);
  const queue = useAppSelector((s) => s.game.queue);
  const codeRef = useRef<HTMLInputElement>(null);

  // Room creation is behind auth now, so the code has to come from the server. The old fallback of
  // inventing a code client-side would join a room that does not exist.
  const createRoom = async () => {
    try {
      const data = await apiGet<{ roomCode: string }>('/api/rooms/new');
      gameActions.joinRoom(data.roomCode);
    } catch (error) {
      dispatch(
        errorRaised({
          code: error instanceof ApiError ? error.code : 'room_create_failed',
          message: error instanceof Error ? error.message : 'Could not create a room.',
        }),
      );
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

