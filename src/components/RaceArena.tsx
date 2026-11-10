import { useEffect, useMemo, useRef, useState, memo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { charTyped, localAccuracy, localWpm } from '../store/typingSlice';
import { gameActions, resetProgressReporter } from '../socket/bridge';
import { soundEngine } from '../audio/soundEngine';
import { RaceHud } from './RaceHud';
import { RaceTrack } from './RaceTrack';
import { CountdownOverlay } from './CountdownOverlay';
import { ResultsOverlay } from './ResultsOverlay';

const WORD_COLORS = ['var(--accent)', 'var(--accent-2)', 'var(--accent-3)'];

export function RaceArena() {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game);
  const typing = useAppSelector((s) => s.typing);
  const inputRef = useRef<HTMLInputElement>(null);
  const [braking, setBraking] = useState(false);

  const phase = game.room?.phase ?? 'LOBBY';
  const racers = useMemo(() => game.live?.players ?? [], [game.live]);
  const youId = game.me?.playerId ?? '';

  const canType = phase === 'RACING' && !typing.submitted && !typing.locked;

  /**
   * A correct character advances the cursor and the car. A wrong character brakes: it is counted
   * as an error, plays a realistic screeching brake sound, ducks the race music momentarily,
   * the car does not move, and the cursor parks on the offending index until typed correctly.
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
    const isCorrect = typed === expected;
    if (!isCorrect) {
      soundEngine.playBrakeSound();
    }
    dispatch(charTyped({ char: typed, correct: isCorrect }));
  };

  useEffect(() => {
    if (canType) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [canType]);

  useEffect(() => {
    resetProgressReporter();
    setBraking(false);
  }, [game.race?.raceId]);

  // Flash the brake glow for a moment after each wrong keystroke.
  useEffect(() => {
    if (typing.brakeCount === 0 || typing.lastErrorAtMs === 0) {
      return;
    }
    setBraking(true);
    const timer = window.setTimeout(() => setBraking(false), 260);
    return () => window.clearTimeout(timer);
  }, [typing.brakeCount, typing.lastErrorAtMs]);

  // Play background racing ringtone/music while racing is actively on
  useEffect(() => {
    if (phase === 'RACING' && !typing.submitted && !typing.locked) {
      soundEngine.startRaceMusic();
    } else {
      soundEngine.stopRaceMusic();
    }
    return () => {
      soundEngine.stopRaceMusic();
    };
  }, [phase, typing.submitted, typing.locked]);

  // Play finish sound when completing the race
  useEffect(() => {
    if (typing.submitted) {
      soundEngine.playFinishSound();
    }
  }, [typing.submitted]);

  // Word boundaries let the text render in alternating accent colours.
  const wordIndexAt = useMemo(() => {
    const text = typing.text;
    const indexes = new Map<number, number>();
    if (text) {
      const re = /\S+/g;
      let match: RegExpExecArray | null;
      let i = 0;
      while ((match = re.exec(text)) !== null) {
        indexes.set(match.index, i);
        i += 1;
        if (i > 500) break;
      }
    }
    return indexes;
  }, [typing.text]);

  const chars = useMemo(() => typing.text.split(''), [typing.text]);

  const wpm = localWpm(typing);
  const accuracy = localAccuracy(typing);
  const progress = typing.totalChars ? typing.typedCount / typing.totalChars : 0;
  const hasFinished = Boolean(
    game.results ||
    game.personalFinish ||
    (typing.submitted && (phase === 'RACING' || phase === 'FINISHED'))
  );

  return (
    <section className="arena">
      <RaceHud
        phase={phase}
        elapsedMs={game.live?.elapsedMs ?? 0}
        wpm={wpm}
        accuracy={accuracy}
        progress={progress}
        timeLimitMs={game.race?.timeLimitMs ?? 0}
      />

      <RaceTrack
        racers={racers}
        youId={youId}
        localProgress={progress}
        localBraking={braking}
      />

      <div className={`text-shell phase-${phase.toLowerCase()}`}>
        <div className="race-text" onClick={() => canType && inputRef.current?.focus({ preventScroll: true })}>
          {chars.map((char, index) => {
            const status =
              index === typing.stuckAtIndex
                ? 'wrong'
                : index < typing.typedCount
                ? 'typed'
                : index === typing.typedCount
                ? 'cursor'
                : 'pending';
            return (
              <Char
                key={index}
                char={char}
                status={status}
                wordIndex={wordIndexAt.get(index)}
              />
            );
          })}
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
      {hasFinished && <ResultsOverlay />}
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

type CharStatus = 'typed' | 'cursor' | 'wrong' | 'pending';

const Char = memo(function Char({
  char,
  status,
  wordIndex,
}: {
  char: string;
  status: CharStatus;
  wordIndex?: number;
}) {
  let cls = 'char';
  if (char === ' ') {
    cls += ' char-space';
  }
  if (wordIndex !== undefined) {
    cls += ` w${wordIndex % WORD_COLORS.length}`;
  }
  if (status === 'wrong') {
    cls += ' char-wrong char-cursor';
  } else if (status === 'typed') {
    cls += ' char-typed';
  } else if (status === 'cursor') {
    cls += ' char-cursor';
  }
  return (
    <span className={cls} data-char={char}>
      {char === ' ' ? '\u00a0' : char}
    </span>
  );
});