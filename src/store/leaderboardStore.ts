import { create } from "zustand";
import { apiClient } from "../shared/api/apiClient";

export interface LeaderboardUser {
  _id: string;
  nickname: string;
  score: number;
  customAvatarUrl?: string;
  telegramPhotoUrl?: string;
  position: number;
}

export interface GiveawayWinner {
  userId: string;
  nickname: string;
  score: number;
  avatarUrl?: string;
  position: number;
}

export interface GiveawayHistoryData {
  _id: string;
  weekNumber: number;
  endDate: string;
  winners: GiveawayWinner[];
}

interface LeaderboardResponse {
  top?: LeaderboardUser[];
  currentUserRank?: LeaderboardUser | null;
}

interface LeaderboardState {
  topUsers: LeaderboardUser[];
  currentUserRank: LeaderboardUser | null;
  giveawayHistory: GiveawayHistoryData[];
  isLoading: boolean;
  error: string | null;
  fetchLeaderboard: () => Promise<void>;
  fetchGiveawayHistory: () => Promise<void>;
  forceEndGiveaway: () => Promise<void>;
}

export const useLeaderboardStore = create<LeaderboardState>((set, get) => ({
  topUsers: [],
  currentUserRank: null,
  giveawayHistory: [],
  isLoading: false,
  error: null,
  fetchLeaderboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await apiClient.get<LeaderboardResponse>("/user/leaderboard");
      set({
        topUsers: data.top || [],
        // ВИПРАВЛЕНО: сервер повертає currentUserRank, а читалось data.currentUser —
        // тому місце юзера ніколи не показувалось, а замість балів тижня брався totalScore
        currentUserRank: data.currentUserRank ?? null,
        isLoading: false,
      });
    } catch (error: unknown) {
      console.error(error);
      set({ error: "Не вдалося завантажити рейтинг", isLoading: false });
    }
  },
  fetchGiveawayHistory: async () => {
    try {
      const { data } = await apiClient.get<GiveawayHistoryData[]>("/user/giveaway-history");
      set({ giveawayHistory: Array.isArray(data) ? data : [] });
    } catch (error: unknown) {
      console.error(error);
    }
  },
  forceEndGiveaway: async () => {
    try {
      await apiClient.post("/user/giveaway/force-end");
      await get().fetchLeaderboard();
      await get().fetchGiveawayHistory();
    } catch (error: unknown) {
      console.error(error);
      throw new Error("Помилка при завершенні розіграшу");
    }
  },
}));