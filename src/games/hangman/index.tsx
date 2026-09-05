import type { FC } from "react";
import type { GameProps } from "../types";

export const HangmanGame: FC<GameProps> = () => {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center h-full">
      <h2 className="text-2xl font-bold text-[var(--text-main)]">Шибениця</h2>
      <p className="text-[var(--text-muted)]">
        Гра в розробці. Бережи печиво від монстра!
      </p>
    </div>
  );
};
