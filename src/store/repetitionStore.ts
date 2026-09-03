import { create } from "zustand";
import { persist } from "zustand/middleware";
import { calculateNextReview } from "../shared/lib/spaced-repetition";
import type { ReviewQuality } from "../shared/lib/spaced-repetition";

export interface RepetitionItem {
  wordId: string;
  nextReviewDate: string;
  interval: number;
  easinessFactor: number;
  repetitions: number;
}

interface RepetitionStore {
  items: Record<string, RepetitionItem>;
  initWordsFromCompletedUnits: (wordIds: string[]) => void;
  recordReview: (wordId: string, quality: ReviewQuality) => void;
}

export const useRepetitionStore = create<RepetitionStore>()(
  persist(
    (set) => ({
      items: {},

      initWordsFromCompletedUnits: (wordIds: string[]) => {
        set((state) => {
          const now = new Date().toISOString();
          const updatedItems = { ...state.items };
          let hasChanges = false;

          wordIds.forEach((id) => {
            if (!updatedItems[id]) {
              hasChanges = true;
              updatedItems[id] = {
                wordId: id,
                nextReviewDate: now,
                interval: 1,
                easinessFactor: 2.5,
                repetitions: 0,
              };
            }
          });

          return hasChanges ? { items: updatedItems } : state;
        });
      },

      recordReview: (wordId: string, quality: ReviewQuality) => {
        set((state) => {
          const currentItem = state.items[wordId] ?? {
            wordId,
            interval: 1,
            easinessFactor: 2.5,
            repetitions: 0,
            nextReviewDate: new Date().toISOString(),
          };

          const result = calculateNextReview(quality, currentItem);

          return {
            items: {
              ...state.items,
              [wordId]: {
                wordId,
                ...result,
              },
            },
          };
        });
      },
    }),
    {
      name: "snack_repetition_storage",
    },
  ),
);
