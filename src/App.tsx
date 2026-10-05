import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from './store';
import { AuthGate } from './components/AuthGate';
import { TopBar } from './components/TopBar';
import { RoomPanel } from './components/RoomPanel';
import { RaceArena } from './components/RaceArena';
import { LeaderboardPanel } from './components/LeaderboardPanel';
import { StatsPanel, Toasts } from './components/StatsPanel';
import { FinishFeed } from './components/FinishFeed';
import { bindSessionToStore, restore, sessionDropped, signOut } from './store/authSlice';
import { connectSocket, installProgressReporter } from './socket/bridge';
import { gameSocket } from './socket/GameSocket';

type Tab = 'race' | 'leaderboard' | 'stats';

export default function App() {
  const dispatch = useAppDispatch();
  const authStatus = useAppSelector((s) => s.auth.status);
  // Stays on the sign-in gate until an account is signed in AND the socket has been admitted, which
  // the server signals with a welcome rather than with the socket merely opening.
  const sessionStarted = useAppSelector((s) => s.game.sessionStarted);
  const room = useAppSelector((s) => s.game.room);
  const [tab, setTab] = useState<Tab>('race');

  // A reload only has the refresh token, so recover the session before deciding what to render.
  useEffect(() => {
    dispatch(restore());
    return bindSessionToStore(() => dispatch(sessionDropped()));
  }, [dispatch]);

  // Open the socket once an account exists, and tear it down on sign-out so the next account cannot
  // inherit the previous one's live connection.
  useEffect(() => {
    if (authStatus === 'authenticated' && !sessionStarted) {
      connectSocket();
      installProgressReporter();
    }
    return () => {
      if (authStatus !== 'authenticated') {
        gameSocket.close();
      }
    };
  }, [authStatus, sessionStarted]);

  if (authStatus === 'unknown') {
    return <Toasts />;
  }

  if (authStatus !== 'authenticated' || !sessionStarted) {
    return (
      <>
        <AuthGate />
        <Toasts />
      </>
    );
  }

  return (
    <div className="app">
      <TopBar tab={tab} onTabChange={setTab} onSignOut={() => dispatch(signOut())} />
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