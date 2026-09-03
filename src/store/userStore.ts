import { create } from "zustand";
import { TelegramUser } from "../shared/lib/telegram";

interface UserState {
  user: TelegramUser | null;
  setUser: (user: TelegramUser | null) => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
