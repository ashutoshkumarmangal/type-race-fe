import { useEffect, useState } from 'react';
import { useAppSelector } from '../store';
import { ResultCard } from './ResultsOverlay';

/**
 * Compact personal result the moment the server counts this player's finish, so a fast racer is
 * not left staring at the clock until the last rival crosses the line. The full standings overlay
 * replaces it when `race_over` arrives.
 */
export function FinishedBanner() {
  const personal = useAppSelector((s) => s.game.personalFinish);
  const raceId = useAppSelector((s) => s.game.race?.raceId);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [raceId]);

  if (!personal || dismissed) {
    return null;
  }

  const placeSuffix = personal.place === 1 ? 'st' : personal.place === 2 ? 'nd' : personal.place === 3 ? 'rd' : 'th';

  return (
    <aside className="finished-banner" aria-live="polite">
      <div className="finished-banner-head">
        <span>
          You finished <strong>#{personal.place}{placeSuffix}</strong>
        </span>
        <button
          className="btn ghost icon"
          aria-label="Dismiss your results"
          onClick={() => setDismissed(true)}
        >
          ×
        </button>
      </div>
      <div className="result-cards compact">
        <ResultCard label="Speed" value={`${personal.wpm.toFixed(1)} wpm`} />
        <ResultCard label="Accuracy" value={`${personal.accuracy.toFixed(1)}%`} />
        <ResultCard label="Time" value={`${(personal.durationMs / 1000).toFixed(2)}s`} />
      </div>
      <p className="hint">Waiting for the rest of the field…</p>
    </aside>
  );
}