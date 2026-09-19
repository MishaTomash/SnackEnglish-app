import { create } from "zustand";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const getAuthHeaders = () => {
  const initData =
    window.Telegram?.WebApp?.initData || "mock_hash_for_dev_mode";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${initData}`,
  };
};

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
      const res = await fetch(`${API_URL}/user/leaderboard`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Не вдалося завантажити рейтинг");
      const data = await res.json();

      set({
        topUsers: data.top || [],
        currentUserRank: data.currentUser || null,
        isLoading: false,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Невідома помилка";
      set({ error: message, isLoading: false });
    }
  },
  fetchGiveawayHistory: async () => {
    try {
      const res = await fetch(`${API_URL}/user/giveaway-history`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Не вдалося завантажити історію");
      const data = await res.json();
      set({ giveawayHistory: data });
    } catch (error: unknown) {
      console.error(error);
    }
  },
  forceEndGiveaway: async () => {
    try {
      const res = await fetch(`${API_URL}/user/giveaway/force-end`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Помилка при завершенні розіграшу");
      await get().fetchLeaderboard();
      await get().fetchGiveawayHistory();
    } catch (error: unknown) {
      console.error(error);
    }
  },
}));
