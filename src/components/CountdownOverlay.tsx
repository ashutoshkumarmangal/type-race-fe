export function CountdownOverlay({ seconds, phase }: { seconds: number; phase: string }) {
  const show = phase === 'COUNTDOWN' && seconds > 0;
  if (!show) {
    return null;
  }
  return (
    <div className="countdown">
      <div className="countdown-ring" key={seconds}>
        <span>{seconds}</span>
      </div>
    </div>
  );
}