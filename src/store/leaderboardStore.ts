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
  score: number; // Або wordsLearnedCount, залежно від того, що повертає бекенд
  customAvatarUrl?: string;
  telegramPhotoUrl?: string;
  position: number;
}

interface LeaderboardState {
  topUsers: LeaderboardUser[];
  currentUserRank: LeaderboardUser | null;
  isLoading: boolean;
  error: string | null;
  fetchLeaderboard: () => Promise<void>;
}

export const useLeaderboardStore = create<LeaderboardState>((set) => ({
  topUsers: [],
  currentUserRank: null,
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
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
}));
