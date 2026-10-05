import { memo } from 'react';
import type { ProgressView } from '../types/protocol';

/**
 * Top-down track: one lane per racer, each car positioned along the road from that racer's
 * authoritative progress. Progress is clamped server-side to correctChars/totalChars, so a wrong
 * keystroke brakes the car rather than pushing it forward.
 */
export const RaceTrack = memo(function RaceTrack({
  racers,
  youId,
  localProgress,
  localBraking,
}: {
  racers: ProgressView[];
  youId: string;
  localProgress: number;
  localBraking: boolean;
}) {
  const lanes = [...racers].sort((a, b) => {
    if (b.progress !== a.progress) return b.progress - a.progress;
    return a.nickname.localeCompare(b.nickname);
  });

  return (
    <div className="track">
      {lanes.map((player) => {
        const you = player.id === youId;
        // Local progress leads the server snapshot by design: it reacts on the keystroke instead
        // of waiting for the next broadcast, then reconciles to the authoritative value.
        const progress = you ? Math.max(player.progress, localProgress) : player.progress;
        const pct = Math.max(0, Math.min(1, progress)) * 100;
        return (
          <div
            key={player.id}
            className={`lane ${you ? 'lane-you' : ''} ${player.finished ? 'lane-done' : ''} ${
              you && localBraking ? 'lane-braking' : ''
            }`}
          >
            <div className="lane-name">
              <span className="dot" style={{ background: player.avatarColor }} />
              <span className="lane-label">{player.nickname}</span>
              {you ? <span className="you-tag">you</span> : null}
              {player.finished ? <span className="done-tag">finished</span> : null}
            </div>

            <div className="lane-road">
              <div className="lane-dashes" aria-hidden="true" />
              <div
                className="lane-fill"
                style={{ width: `${pct}%`, background: player.avatarColor }}
              />
              <div
                className="car"
                style={{ left: `${pct}%`, ['--car-color' as string]: player.avatarColor }}
              >
                <span className="car-body" aria-hidden="true" />
                <span className="car-cabin" aria-hidden="true" />
                <span className="car-wheel car-wheel-fl" aria-hidden="true" />
                <span className="car-wheel car-wheel-fr" aria-hidden="true" />
                <span className="car-light car-light-l" aria-hidden="true" />
                <span className="car-light car-light-r" aria-hidden="true" />
              </div>
              <div className="lane-flag" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="lane-meta">
              <span>{player.wpm.toFixed(0)} wpm</span>
              <span>{player.accuracy.toFixed(0)}%</span>
              {player.place > 0 ? <span>#{player.place}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
});
