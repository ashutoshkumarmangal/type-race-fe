/**
 * TypeScript mirror of the Java `com.typerush.protocol` payloads.
 * Keep in sync with backend/src/main/java/com/typerush/protocol.
 */

export type Phase = 'LOBBY' | 'COUNTDOWN' | 'RACING' | 'FINISHED' | 'DISSOLVED';

export interface Welcome {
  playerId: string;
  nickname: string;
  avatarColor: string;
  serverTimeEpochMs: number;
}

export interface Queued {
  queued: number;
  needed: number;
  waitMs: number;
}

export interface PlayerView {
  id: string;
  nickname: string;
  avatarColor: string;
  ready: boolean;
  connected: boolean;
  finished: boolean;
  host: boolean;
  spectator: boolean;
  place: number;
}

export interface Joined {
  roomCode: string;
  host: boolean;
  players: PlayerView[];
  phase: Phase;
  minPlayers: number;
  maxPlayers: number;
  quickMatch: boolean;
  serverTimeEpochMs: number;
}

export interface RaceStart {
  roomCode: string;
  text: string;
  totalChars: number;
  startAtEpochMs: number;
  timeLimitMs: number;
  raceId: string;
}

export interface ProgressView {
  id: string;
  nickname: string;
  avatarColor: string;
  correctChars: number;
  errors: number;
  progress: number;
  wpm: number;
  accuracy: number;
  finished: boolean;
  place: number;
  you: boolean;
}

export interface RaceState {
  roomCode: string;
  phase: Phase;
  serverTimeEpochMs: number;
  elapsedMs: number;
  totalChars: number;
  players: ProgressView[];
}

export interface PlayerFinished {
  id: string;
  nickname: string;
  place: number;
  wpm: number;
  accuracy: number;
  durationMs: number;
}

export interface Standing {
  id: string;
  nickname: string;
  avatarColor: string;
  place: number;
  dnf: boolean;
  wpm: number;
  accuracy: number;
  correctChars: number;
  errors: number;
  durationMs: number;
  bestInRoom: boolean;
  /** True when the server clamped this run for claiming impossible progress. */
  flagged: boolean;
}

export interface RaceOver {
  raceId: string;
  roomCode: string;
  endedAtEpochMs: number;
  standings: Standing[];
}

export interface ServerError {
  code: string;
  message: string;
}

export interface Envelope<T> {
  type: string;
  data: T | null;
}

export type ClientCommand =
  | { type: 'join_quick' }
  | { type: 'join_room'; roomCode: string }
  | { type: 'ready'; ready: boolean }
  | { type: 'start' }
  | { type: 'progress'; correctChars: number; errors: number; keystrokes: number }
  | { type: 'finish'; correctChars: number; errors: number; keystrokes: number }
  | { type: 'rematch'; again: boolean }
  | { type: 'leave' }
  | { type: 'ping' };