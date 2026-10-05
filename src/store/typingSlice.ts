import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * The client's own typing buffer. This is the only place keystrokes land; the server receives a
 * throttled summary of it via the WebSocket and never trusts it beyond its anti-cheat ceiling.
 */
export interface TypingState {
  text: string;
  totalChars: number;
  typedCount: number;
  correctChars: number;
  errors: number;
  keystrokes: number;
  /**
   * Index the cursor is parked on because the player typed the wrong character. The cursor
   * refuses to advance while this is set, so the racer has to correct it before moving on.
   */
  stuckAtIndex: number | null;
  /** Increments on every wrong keystroke; drives the car braking animation. */
  brakeCount: number;
  /** Timestamp of the most recent wrong keystroke, used to flash the brake glow. */
  lastErrorAtMs: number;
  startedAtMs: number;
  finishedAtMs: number;
  submitted: boolean;
  locked: boolean;
}

const initialState: TypingState = {
  text: '',
  totalChars: 0,
  typedCount: 0,
  correctChars: 0,
  errors: 0,
  keystrokes: 0,
  stuckAtIndex: null,
  brakeCount: 0,
  lastErrorAtMs: 0,
  startedAtMs: 0,
  finishedAtMs: 0,
  submitted: false,
  locked: false,
};

const typingSlice = createSlice({
  name: 'typing',
  initialState,
  reducers: {
    raceTextLoaded(state, action: PayloadAction<{ text: string; totalChars: number }>) {
      state.text = action.payload.text;
      state.totalChars = action.payload.totalChars || action.payload.text.length;
      state.typedCount = 0;
      state.correctChars = 0;
      state.errors = 0;
      state.keystrokes = 0;
      state.stuckAtIndex = null;
      state.brakeCount = 0;
      state.lastErrorAtMs = 0;
      state.startedAtMs = 0;
      state.finishedAtMs = 0;
      state.submitted = false;
      state.locked = false;
    },
    lockRace(state) {
      state.locked = true;
    },
    /**
     * One keystroke. A correct character advances the cursor and the car; a wrong character
     * brakes the car (error counted, no forward progress) and parks the cursor on the offending
     * index until the racer types it correctly.
     */
    charTyped(state, action: PayloadAction<{ char: string; correct: boolean }>) {
      if (state.locked || state.submitted) {
        return;
      }
      if (state.startedAtMs === 0) {
        state.startedAtMs = Date.now();
      }
      state.keystrokes += 1;
      if (!action.payload.correct) {
        state.errors += 1;
        state.brakeCount += 1;
        state.lastErrorAtMs = Date.now();
        state.stuckAtIndex = state.typedCount;
        return;
      }
      state.typedCount += 1;
      state.correctChars += 1;
      state.stuckAtIndex = null;
      if (state.typedCount >= state.totalChars) {
        state.submitted = true;
        state.finishedAtMs = Date.now();
      }
    },
    raceSubmitted(state) {
      state.submitted = true;
      state.locked = true;
      if (state.finishedAtMs === 0) {
        state.finishedAtMs = Date.now();
      }
    },
    raceLocked(state) {
      state.locked = true;
    },
    typingReset() {
      return initialState;
    },
  },
});

export const { raceTextLoaded, lockRace, charTyped, raceSubmitted, raceLocked, typingReset } =
  typingSlice.actions;

export default typingSlice.reducer;

/** Local, optimistic WPM while the race is running. */
export function localWpm(state: TypingState): number {
  if (state.startedAtMs === 0 || state.correctChars === 0) {
    return 0;
  }
  const end = state.finishedAtMs || Date.now();
  const minutes = (end - state.startedAtMs) / 60_000;
  if (minutes <= 0) {
    return 0;
  }
  return Math.round((state.correctChars / 5 / minutes) * 10) / 10;
}

export function localAccuracy(state: TypingState): number {
  const total = state.correctChars + state.errors;
  if (total === 0) {
    return 100;
  }
  return Math.round((state.correctChars / total) * 1000) / 10;
}