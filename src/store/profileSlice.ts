import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
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
}

const initialState: ProfileState = {
  leaderboard: [],
  stats: null,
  history: [],
  loading: false,
};

export const loadLeaderboard = createAsyncThunk('profile/loadLeaderboard', async () => {
  const response = await fetch(apiUrl('/api/leaderboard?limit=20'));
  if (!response.ok) {
    throw new Error(`leaderboard ${response.status}`);
  }
  return (await response.json()) as LeaderboardEntry[];
});

export const loadProfile = createAsyncThunk(
  'profile/loadProfile',
  async (nickname: string) => {
    const response = await fetch(apiUrl(`/api/players/${encodeURIComponent(nickname)}`));
    if (!response.ok) {
      return { stats: null, history: [] as RaceHistoryItem[] };
    }
    const stats = (await response.json()) as PlayerStats;
    const historyResponse = await fetch(
      apiUrl(`/api/players/${encodeURIComponent(nickname)}/races?limit=8`),
    );
    const history = historyResponse.ok
      ? ((await historyResponse.json()) as RaceHistoryItem[])
      : [];
    return { stats, history };
  },
);

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
      .addCase(loadProfile.fulfilled, (state, action) => {
        state.stats = action.payload.stats;
        state.history = action.payload.history;
      });
  },
});

export const { profileCleared } = profileSlice.actions;
export default profileSlice.reducer;