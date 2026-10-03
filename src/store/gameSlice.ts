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
  /** Draft text in the name field. Typing here must never navigate away. */
  nickname: string;
  /** True once the racer has confirmed a name and the socket has opened at least once. */
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
  nickname: '',
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
    nicknameChanged(state, action: PayloadAction<string>) {
      state.nickname = action.payload;
    },
    connectionChanged(state, action: PayloadAction<SocketStatus>) {
      state.connection = action.payload;
      if (action.payload === 'open') {
        // Latches so a later socket drop shows the reconnect badge instead of the name gate.
        state.sessionStarted = true;
      }
    },
    welcomed(state, action: PayloadAction<Welcome>) {
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
  nicknameChanged,
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