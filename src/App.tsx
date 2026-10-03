import { useState } from 'react';
import { useAppSelector } from './store';
import { NameGate } from './components/NameGate';
import { TopBar } from './components/TopBar';
import { RoomPanel } from './components/RoomPanel';
import { RaceArena } from './components/RaceArena';
import { LeaderboardPanel } from './components/LeaderboardPanel';
import { StatsPanel, Toasts } from './components/StatsPanel';
import { FinishFeed } from './components/FinishFeed';

type Tab = 'race' | 'leaderboard' | 'stats';

export default function App() {
  // Stays on the name gate until the racer confirms a name AND the socket has opened at least once.
  const sessionStarted = useAppSelector((s) => s.game.sessionStarted);
  const room = useAppSelector((s) => s.game.room);
  const [tab, setTab] = useState<Tab>('race');

  if (!sessionStarted) {
    return (
      <>
        <NameGate />
        <Toasts />
      </>
    );
  }

  return (
    <div className="app">
      <TopBar tab={tab} onTabChange={setTab} />
      <main className="layout">
        <aside className="sidebar">
          <RoomPanel />
          <FinishFeed />
        </aside>
        <section className="stage">
          {tab === 'race' && <RaceArena />}
          {tab === 'leaderboard' && (
            <div className="panel wide">
              <LeaderboardPanel />
            </div>
          )}
          {tab === 'stats' && (
            <div className="panel wide">
              <StatsPanel />
            </div>
          )}
        </section>
      </main>
      {!room && (
        <footer className="hint center footer-hint">
          Not in a room? Pick “quick match” in the room panel or create a room and share the code.
        </footer>
      )}
      <Toasts />
    </div>
  );
}