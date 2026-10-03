import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { nicknameChanged } from '../store/gameSlice';
import { connectSocket, gameActions, installProgressReporter } from '../socket/bridge';

const STORAGE_KEY = 'typerush.nickname';

export function NameGate() {
  // The draft lives here, in component state: typing must never move the racer into the arena.
  const [draft, setDraft] = useState('');
  const dispatch = useAppDispatch();
  const connection = useAppSelector((s) => s.game.connection);
  const inputRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    setDraft(localStorage.getItem(STORAGE_KEY) ?? '');
    inputRef.current?.focus();
  }, []);

  /** Confirms the name and opens the socket exactly once per page load. */
  const commit = (): boolean => {
    const name = draft.trim();
    if (name.length < 3) {
      inputRef.current?.focus();
      return false;
    }
    localStorage.setItem(STORAGE_KEY, name);
    dispatch(nicknameChanged(name));
    if (!startedRef.current) {
      startedRef.current = true;
      connectSocket(name);
      installProgressReporter();
    }
    return true;
  };

  const createRoom = async () => {
    if (!commit()) {
      return;
    }
    try {
      const response = await fetch('/api/rooms/new');
      const data = (await response.json()) as { roomCode: string };
      gameActions.joinRoom(data.roomCode);
    } catch {
      gameActions.joinRoom(randomCode());
    }
  };

  return (
    <div className="gate">
      <div className="gate-card">
        <p className="eyebrow">realtime typing races</p>
        <h1 className="logo">
          Type<span>Rush</span>
        </h1>
        <p className="gate-copy">
          Race another human at the same sentence. The server times the race, validates every claim of
          progress and broadcasts everyone's bar in real time.
        </p>

        <label className="field">
          <span>Your racer name</span>
          <input
            ref={inputRef}
            value={draft}
            maxLength={16}
            placeholder="e.g. NeonFox"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (commit()) {
                  gameActions.quickMatch();
                }
              }
            }}
          />
        </label>

        <div className="gate-actions">
          <button className="btn btn-primary big" onClick={commit} disabled={connection !== 'closed'}>
            {connection === 'closed' ? 'Enter the arena' : 'Connecting…'}
          </button>
        </div>

        <div className="gate-alt">
          <button className="btn" onClick={() => commit() && gameActions.quickMatch()}>
            Quick match
          </button>
          <button className="btn" onClick={createRoom}>
            Create room
          </button>
        </div>

        <div className="gate-alt">
          <input
            ref={codeRef}
            className="code-input"
            placeholder="ROOM CODE"
            maxLength={5}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (commit()) {
                  gameActions.joinRoom(codeRef.current?.value ?? '');
                }
              }
            }}
          />
          <button
            className="btn"
            onClick={() => {
              if (commit()) {
                gameActions.joinRoom(codeRef.current?.value ?? '');
              }
            }}
          >
            Join room
          </button>
        </div>

        <p className="connection-line">
          <span className={`dot ${connection === 'open' ? 'ok' : connection}`} />
          socket: {connection}
        </p>
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