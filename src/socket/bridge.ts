import { gameSocket, type SocketStatus } from './GameSocket';
import { store } from '../store';
import {
  connectionChanged, countdownTick, errorRaised, playerFinished, queueUpdated,
  raceOver, raceStarted, raceStateReceived, roomClosed, roomJoined,
  socketLost, welcomed,
} from '../store/gameSlice';
import { raceTextLoaded, raceSubmitted, typingReset } from '../store/typingSlice';
import { loadProfile } from '../store/profileSlice';
import { getAccessToken } from '../api/session';
import type {
  ClientCommand, Joined, PlayerFinished as PlayerFinishedPayload, Queued,
  RaceOver as RaceOverPayload, RaceStart, RaceState, ServerError, Welcome,
} from '../types/protocol';

const PROGRESS_INTERVAL_MS = 100;

export function sendCommand(command: ClientCommand): void {
  gameSocket.send(command);
}

/**
 * Opens the socket (and keeps it open across reconnects) for the signed-in account.
 *
 * <p>The token is read through a provider rather than captured, because reconnect attempts can happen
 * long after the token that started the session has expired and been replaced.
 */
export function connectSocket(): void {
  gameSocket.setHandlers(handleMessage, handleStatus, handleRefusal);
  gameSocket.connect(getAccessToken);
}

function handleStatus(status: SocketStatus): void {
  store.dispatch(connectionChanged(status));
  if (status === 'closed') {
    store.dispatch(socketLost());
  }
}

/** The server accepted the upgrade but refused the player; retrying will not help. */
function handleRefusal(reason: string): void {
  store.dispatch(errorRaised({ code: 'socket_refused', message: reason }));
}

function handleMessage(type: string, data: unknown): void {
  switch (type) {
    case 'welcome':
      store.dispatch(welcomed(data as Welcome));
      break;
    case 'queued':
      store.dispatch(queueUpdated(data as Queued));
      break;
    case 'left_queue':
      store.dispatch(queueUpdated(null));
      break;
    case 'joined':
      store.dispatch(roomJoined(data as Joined));
      break;
    case 'room_closed':
      store.dispatch(roomClosed());
      // Clear the race buffer too, so a player who leaves mid-race lands on a clean home screen
      // instead of the previous text with a stale cursor.
      store.dispatch(typingReset());
      break;
    case 'countdown': {
      const payload = data as { startsAtEpochMs: number };
      driveCountdown(payload.startsAtEpochMs);
      break;
    }
    case 'race_start': {
      const payload = data as RaceStart;
      store.dispatch(raceStarted(payload));
      store.dispatch(raceTextLoaded({ text: payload.text, totalChars: payload.totalChars }));
      driveCountdown(payload.startAtEpochMs);
      break;
    }
    case 'state':
      store.dispatch(raceStateReceived(data as RaceState));
      break;
    case 'player_finished':
      store.dispatch(playerFinished(data as PlayerFinishedPayload));
      break;
    case 'race_over': {
      const payload = data as RaceOverPayload;
      store.dispatch(raceOver(payload));
      store.dispatch(raceSubmitted());
      // The account is the scope for personal stats, so no nickname has to be threaded through here.
      store.dispatch(loadProfile());
      break;
    }
    case 'error':
      store.dispatch(errorRaised(data as ServerError));
      break;
    default:
      break;
  }
}

/**
 * Both clients see the same absolute start instant, so the countdown is derived from the server
 * clock plus a local skew estimate instead of a plain local timer.
 */
function driveCountdown(startAtEpochMs: number): void {
  const tick = () => {
    const offset = store.getState().game.serverClockOffsetMs;
    const remainingMs = startAtEpochMs - (Date.now() + offset);
    const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
    store.dispatch(countdownTick(remaining));
    if (remaining > 0) {
      window.setTimeout(tick, 120);
    } else {
      store.dispatch(countdownTick(0));
    }
  };
  tick();
}

// ---------------------------------------------------------------- outbound helpers used by the UI

export const gameActions = {
  quickMatch(): void { sendCommand({ type: 'join_quick' }); },
  joinRoom(roomCode: string): void {
    sendCommand({ type: 'join_room', roomCode: roomCode.trim().toUpperCase() });
  },
  setReady(ready: boolean): void { sendCommand({ type: 'ready', ready }); },
  startRace(): void { sendCommand({ type: 'start' }); },
  leaveRoom(): void { sendCommand({ type: 'leave' }); },
  requestRematch(): void { sendCommand({ type: 'rematch', again: true }); },
  cancelRematch(): void { sendCommand({ type: 'rematch', again: false }); },
  ping(): void { sendCommand({ type: 'ping' }); },
};

// ---------------------------------------------------------------- progress reporting

let lastProgressSentAt = 0;
let lastSentCorrect = 0;
let lastSentErrors = 0;
let subscribed = false;

/**
 * Mirrors the local typing buffer to the server at a fixed cadence and submits the finish
 * exactly once when the last character lands.
 */
export function installProgressReporter(): void {
  if (subscribed) { return; }
  subscribed = true;
  store.subscribe(() => {
    const { typing, game } = store.getState();
    if (!game.race || game.room?.phase !== 'RACING') { return; }
    if (typing.keystrokes === 0) { return; }
    const now = Date.now();
    const changed = typing.correctChars !== lastSentCorrect || typing.errors !== lastSentErrors;
    const finished = typing.submitted;
    if (!finished && (!changed || now - lastProgressSentAt < PROGRESS_INTERVAL_MS)) { return; }
    lastProgressSentAt = now;
    lastSentCorrect = typing.correctChars;
    lastSentErrors = typing.errors;
    sendCommand({ type: 'progress', correctChars: typing.correctChars, errors: typing.errors, keystrokes: typing.keystrokes });
    if (finished) {
      sendCommand({ type: 'finish', correctChars: typing.correctChars, errors: typing.errors, keystrokes: typing.keystrokes });
    }
  });
}

export function resetProgressReporter(): void {
  lastProgressSentAt = 0;
  lastSentCorrect = 0;
  lastSentErrors = 0;
}