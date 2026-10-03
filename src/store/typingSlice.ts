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
  /** Indexes of characters typed incorrectly, so the UI can highlight them. */
  wrongIndexes: number[];
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
  wrongIndexes: [],
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
      state.wrongIndexes = [];
      state.startedAtMs = 0;
      state.finishedAtMs = 0;
      state.submitted = false;
      state.locked = false;
    },
    lockRace(state) {
      state.locked = true;
    },
    /** One keystroke that advances the cursor. */
    charTyped(state, action: PayloadAction<{ char: string; correct: boolean }>) {
      if (state.locked || state.submitted) {
        return;
      }
      if (state.startedAtMs === 0) {
        state.startedAtMs = Date.now();
      }
      state.typedCount += 1;
      state.keystrokes += 1;
      if (action.payload.correct) {
        state.correctChars += 1;
      } else {
        state.errors += 1;
        state.wrongIndexes.push(state.typedCount - 1);
      }
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