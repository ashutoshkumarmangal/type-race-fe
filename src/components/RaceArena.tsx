import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { charTyped, localAccuracy, localWpm } from '../store/typingSlice';
import { gameActions, resetProgressReporter } from '../socket/bridge';
import { RaceHud } from './RaceHud';
import { PlayerProgress } from './PlayerProgress';
import { CountdownOverlay } from './CountdownOverlay';
import { ResultsOverlay } from './ResultsOverlay';

const WORD_COLORS = ['var(--accent)', 'var(--accent-2)', 'var(--accent-3)'];

export function RaceArena() {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game);
  const typing = useAppSelector((s) => s.typing);
  const inputRef = useRef<HTMLInputElement>(null);
  const [wordAt, setWordAt] = useState<Set<number>>(new Set());
  const [wordIndexAt, setWordIndexAt] = useState<Map<number, number>>(new Map());

  const phase = game.room?.phase ?? 'LOBBY';
  const racers = useMemo(() => game.live?.players ?? [], [game.live]);
  const youId = game.me?.playerId;

  const canType = phase === 'RACING' && !typing.submitted && !typing.locked;

  /**
   * A single keystroke always advances the cursor. A wrong character is recorded as an error and
   * highlighted, which keeps the local buffer trivially in sync with the server's counters.
   */
  const handleInput = (value: string) => {
    if (!canType || value.length === 0) {
      return;
    }
    const typed = value.length === 1 ? value : value[value.length - 1];
    if (value.length > 2) {
      // Injected text (paste/autofill): only honour one character.
      return;
    }
    const expected = typing.text[typing.typedCount];
    dispatch(charTyped({ char: typed, correct: typed === expected }));
  };

  useEffect(() => {
    if (canType) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [canType]);

  useEffect(() => {
    resetProgressReporter();
  }, [game.race?.raceId]);

  // Word boundaries let the text render in alternating accent colours.
  useEffect(() => {
    const text = typing.text;
    const starts = new Set<number>();
    const indexes = new Map<number, number>();
    if (text) {
      const re = /\S+/g;
      let match: RegExpExecArray | null;
      let i = 0;
      while ((match = re.exec(text)) !== null) {
        starts.add(match.index);
        indexes.set(match.index, i);
        i += 1;
        if (i > 500) break;
      }
    }
    setWordAt(starts);
    setWordIndexAt(indexes);
  }, [typing.text]);

  const wpm = localWpm(typing);
  const accuracy = localAccuracy(typing);
  const progress = typing.totalChars ? typing.typedCount / typing.totalChars : 0;
  const myView = racers.find((p) => p.id === youId) ?? racers.find((p) => p.you) ?? null;

  return (
    <section className="arena">
      <RaceHud
        phase={phase}
        elapsedMs={game.live?.elapsedMs ?? 0}
        wpm={wpm}
        serverWpm={myView?.wpm ?? 0}
        accuracy={accuracy}
        progress={progress}
        timeLimitMs={game.race?.timeLimitMs ?? 0}
      />

      <div className="track">
        {racers
          .slice()
          .sort((a, b) => b.progress - a.progress)
          .map((player) => (
            <PlayerProgress
              key={player.id}
              nickname={player.nickname}
              color={player.avatarColor}
              progress={player.id === youId ? Math.max(player.progress, progress) : player.progress}
              wpm={player.id === youId ? Math.max(player.wpm, wpm) : player.wpm}
              accuracy={player.accuracy}
              finished={player.finished}
              you={player.id === youId}
            />
          ))}
      </div>

      <div className={`text-shell phase-${phase.toLowerCase()}`}>
        <div className="race-text" onClick={() => canType && inputRef.current?.focus()}>
          {typing.text.split('').map((char, index) => (
            <Char
              key={index}
              char={char}
              index={index}
              typedCount={typing.typedCount}
              wrongIndexes={typing.wrongIndexes}
              wordStart={wordAt.has(index)}
              wordIndex={wordIndexAt.get(index) ?? 0}
            />
          ))}
        </div>
        <input
          ref={inputRef}
          className="hidden-input"
          value=""
          onChange={(event) => handleInput(event.target.value)}
          onPaste={(event) => event.preventDefault()}
          onDrop={(event) => event.preventDefault()}
          disabled={!canType}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Type the race text here"
        />
        {phase === 'LOBBY' && <div className="text-overlay">Waiting for the race to start…</div>}
        {phase === 'COUNTDOWN' && <div className="text-overlay">Get ready…</div>}
        {typing.submitted && (
          <div className="text-overlay subtle">Waiting for the room to finish…</div>
        )}
      </div>

      <div className="arena-footer">
        {phase === 'LOBBY' ? (
          <LobbyControls />
        ) : (
          <button className="btn ghost" onClick={() => gameActions.leaveRoom()}>
            Leave race
          </button>
        )}
      </div>

      <CountdownOverlay seconds={game.countdownSeconds} phase={phase} />
      {game.results && <ResultsOverlay />}
    </section>
  );
}

function LobbyControls() {
  const game = useAppSelector((s) => s.game);
  const me = game.me;
  const room = game.room;
  if (!room || !me) {
    return null;
  }
  const myView = room.players.find((p) => p.id === me.playerId);
  const enough = room.players.filter((p) => p.connected && !p.spectator).length >= room.minPlayers;

  return (
    <div className="lobby-controls">
      <button
        className={`btn ${myView?.ready ? 'btn-active' : 'btn-primary'}`}
        onClick={() => gameActions.setReady(!myView?.ready)}
      >
        {myView?.ready ? 'Not ready' : "I'm ready"}
      </button>
      {room.host && (
        <button className="btn btn-primary" disabled={!enough} onClick={() => gameActions.startRace()}>
          Start now{enough ? '' : ` (need ${room.minPlayers})`}
        </button>
      )}
      <span className="hint">
        {enough
          ? 'Race begins when everyone is ready.'
          : `Waiting for ${room.minPlayers - room.players.filter((p) => p.connected).length} more player(s).`}
      </span>
    </div>
  );
}

const Char = ({
  char,
  index,
  typedCount,
  wrongIndexes,
  wordStart,
  wordIndex,
}: {
  char: string;
  index: number;
  typedCount: number;
  wrongIndexes: number[];
  wordStart: boolean;
  wordIndex: number;
}) => {
  let cls = 'char';
  if (char === ' ') {
    cls += ' char-space';
  }
  if (wordStart) {
    cls += ` w${wordIndex % WORD_COLORS.length}`;
  }
  if (index < typedCount) {
    cls += wrongIndexes.includes(index) ? ' char-wrong' : ' char-typed';
  }
  if (index === typedCount) {
    cls += ' char-cursor';
  }
  if (index > typedCount + 90) {
    cls += ' char-far';
  }
  return (
    <span className={cls} data-char={char}>
      {char === ' ' ? '\u00a0' : char}
    </span>
  );
}