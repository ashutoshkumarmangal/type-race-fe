import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { apiGet, ApiError } from '../api/client';
import { apiUrl } from '../config';

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  racesPlayed: number;
  wins: number;
  podiums: number;
  bestWpm: number;
  avgWpm: number;
  bestAccuracy: number;
}

export interface PlayerStats {
  nickname: string;
  racesPlayed: number;
  wins: number;
  podiums: number;
  bestWpm: number;
  bestAccuracy: number;
  avgWpm: number;
  totalCharsTyped: number;
  bestPlace: number;
}

export interface RaceHistoryItem {
  raceId: string;
  place: number;
  finished: boolean;
  flagged: boolean;
  wpm: number;
  accuracy: number;
  correctChars: number;
  errorChars: number;
  durationMs: number;
  finishedAt: string;
}

interface ProfileState {
  leaderboard: LeaderboardEntry[];
  stats: PlayerStats | null;
  history: RaceHistoryItem[];
  loading: boolean;
  error: string | null;
}

const initialState: ProfileState = {
  leaderboard: [],
  stats: null,
  history: [],
  loading: false,
  error: null,
};

export const loadLeaderboard = createAsyncThunk('profile/loadLeaderboard', async () => {
  const response = await fetch(apiUrl('/api/leaderboard?limit=20'));
  if (!response.ok) {
    throw new Error(`leaderboard ${response.status}`);
  }
  return (await response.json()) as LeaderboardEntry[];
});

/**
 * The signed-in player's own stats and recent races.
 *
 * <p>No nickname argument: the server derives the account from the verified bearer token, which is
 * what keeps one player from reading another's history by changing a path segment.
 */
export const loadProfile = createAsyncThunk('profile/loadProfile', async () => {
  try {
    const [stats, history] = await Promise.all([
      apiGet<PlayerStats>('/api/me/stats'),
      apiGet<RaceHistoryItem[]>('/api/me/races?limit=8'),
    ]);
    return { stats, history, error: null as string | null };
  } catch (error) {
    // Surfaced rather than swallowed, so a 401 does not read as "no stats yet".
    const message =
      error instanceof ApiError ? error.message : 'Could not load your stats.';
    return { stats: null, history: [] as RaceHistoryItem[], error: message };
  }
});

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    profileCleared() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadLeaderboard.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadLeaderboard.fulfilled, (state, action: PayloadAction<LeaderboardEntry[]>) => {
        state.leaderboard = action.payload;
        state.loading = false;
      })
      .addCase(loadLeaderboard.rejected, (state) => {
        state.loading = false;
      })
      .addCase(loadProfile.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload.stats;
        state.history = action.payload.history;
        state.error = action.payload.error;
      });
  },
});

export const { profileCleared } = profileSlice.actions;
export default profileSlice.reducer;