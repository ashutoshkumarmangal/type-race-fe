import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  Joined,
  PlayerFinished,
  Queued,
  RaceOver,
  RaceStart,
  RaceState,
  ServerError,
  Welcome,
} from '../types/protocol';
import type { SocketStatus } from '../socket/GameSocket';

export interface Me {
  playerId: string;
  nickname: string;
  avatarColor: string;
}

export interface GameState {
  connection: SocketStatus;
  /**
   * True once the server has admitted this connection with a welcome.
   *
   * <p>Not on socket open: the server completes the upgrade before it checks the per-account socket
   * cap, so an open socket can still be refused a moment later.
   */
  sessionStarted: boolean;
  me: Me | null;
  queue: Queued | null;
  room: Joined | null;
  race: RaceStart | null;
  live: RaceState | null;
  countdownSeconds: number;
  serverClockOffsetMs: number;
  finishFeed: PlayerFinished[];
  results: RaceOver | null;
  rematchVote: boolean;
  error: { id: number; code: string; message: string } | null;
}

const initialState: GameState = {
  connection: 'closed',
  sessionStarted: false,
  me: null,
  queue: null,
  room: null,
  race: null,
  live: null,
  countdownSeconds: 0,
  serverClockOffsetMs: 0,
  finishFeed: [],
  results: null,
  rematchVote: false,
  error: null,
};

let errorSeq = 0;

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    connectionChanged(state, action: PayloadAction<SocketStatus>) {
      state.connection = action.payload;
    },
    welcomed(state, action: PayloadAction<Welcome>) {
      // Latched here rather than on open: the welcome only arrives for an admitted connection, and
      // it keeps a later socket drop showing the reconnect badge instead of the sign-in gate.
      state.sessionStarted = true;
      state.me = {
        playerId: action.payload.playerId,
        nickname: action.payload.nickname,
        avatarColor: action.payload.avatarColor,
      };
      state.serverClockOffsetMs = action.payload.serverTimeEpochMs - Date.now();
    },
    queueUpdated(state, action: PayloadAction<Queued | null>) {
      state.queue = action.payload;
    },
    roomJoined(state, action: PayloadAction<Joined>) {
      const previousCode = state.room?.roomCode;
      state.room = action.payload;
      state.serverClockOffsetMs = action.payload.serverTimeEpochMs - Date.now();
      if (previousCode !== action.payload.roomCode) {
        state.live = null;
        state.results = null;
        state.finishFeed = [];
        state.race = null;
        state.rematchVote = false;
      }
    },
    roomClosed(state) {
      state.room = null;
      state.race = null;
      state.live = null;
      state.results = null;
      state.queue = null;
      state.finishFeed = [];
      state.rematchVote = false;
    },
    raceStarted(state, action: PayloadAction<RaceStart>) {
      state.race = action.payload;
      state.results = null;
      state.finishFeed = [];
      state.rematchVote = false;
    },
    countdownTick(state, action: PayloadAction<number>) {
      state.countdownSeconds = action.payload;
    },
    raceStateReceived(state, action: PayloadAction<RaceState>) {
      state.live = action.payload;
      state.serverClockOffsetMs = action.payload.serverTimeEpochMs - Date.now();
    },
    playerFinished(state, action: PayloadAction<PlayerFinished>) {
      state.finishFeed.unshift(action.payload);
      state.finishFeed = state.finishFeed.slice(0, 6);
    },
    raceOver(state, action: PayloadAction<RaceOver>) {
      state.results = action.payload;
    },
    rematchVoteSet(state, action: PayloadAction<boolean>) {
      state.rematchVote = action.payload;
    },
    errorRaised(state, action: PayloadAction<ServerError>) {
      errorSeq += 1;
      state.error = { id: errorSeq, code: action.payload.code, message: action.payload.message };
    },
    errorDismissed(state) {
      state.error = null;
    },
    socketLost(state) {
      state.connection = 'closed';
      state.queue = null;
      state.live = null;
    },
  },
});

export const {
  connectionChanged,
  welcomed,
  queueUpdated,
  roomJoined,
  roomClosed,
  raceStarted,
  countdownTick,
  raceStateReceived,
  playerFinished,
  raceOver,
  rematchVoteSet,
  errorRaised,
  errorDismissed,
  socketLost,
} = gameSlice.actions;

export default gameSlice.reducer;